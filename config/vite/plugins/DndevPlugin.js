/**
 * @fileoverview DndevPlugin — PathResolver-based file API + terminal over Vite HMR
 * @description Single opt-in Vite plugin for the dndev dashboard.
 * File I/O via PathResolver (read/write/readSync).
 * Terminal via node sidecar (node-pty + ws).
 * File watcher pushes HMR events to the browser.
 *
 * @version 0.3.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import { execSync, execFileSync, spawn as nodeSpawn } from 'node:child_process';

import { PathResolver } from '../../utils/PathResolver.js';

const API_PREFIX = '/api/dndev';

/** @returns {PathResolver} */
function pr() {
  return PathResolver.getInstance();
}

// ============================================================================
// UTILITIES
// ============================================================================

function getProjectRoot() {
  return pr().getRepoRoot();
}

function getDndevDir() {
  return pr().resolveRepoPath('.dndev');
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/** Max request body size (5 MB) */
const MAX_BODY_BYTES = 5 * 1024 * 1024;

/**
 * Read the request body as a string, with a size limit to prevent memory DoS.
 * @param {import('http').IncomingMessage} req
 * @param {number} [maxBytes=MAX_BODY_BYTES]
 * @returns {Promise<string>}
 */
function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Get file extension from a path (lowercase, includes dot).
 * @param {string} filePath
 * @returns {string} e.g. '.json', '.png'
 */
function getExtension(filePath) {
  const dot = filePath.lastIndexOf('.');
  return dot === -1 ? '' : filePath.slice(dot).toLowerCase();
}

// ============================================================================
// NODE RESOLUTION — find real node binary (not bun's shim)
// ============================================================================

/**
 * Resolve the REAL system Node binary, skipping bun's fake shim.
 *
 * WHY: When bun runs a process (bun run dev, turbo under bun), it creates
 * a fake "node" at /tmp/bun-node-{hash}/node and prepends it to PATH.
 * This shim is actually bun pretending to be node. For 99% of JS this is
 * invisible, but node-pty (native C++ addon) requires real Node — PTYs
 * spawned under bun die immediately with exit code 1 or SIGHUP.
 *
 * STRATEGY:
 * 1. Try `which node` — verify via realpathSync it does not resolve to bun
 * 2. Scan NVM_DIR/versions/node for installed versions (Linux/macOS)
 * 3. Check NVM_BIN (nvm-windows)
 * 4. Fall back to common system paths (/usr/local/bin/node, /usr/bin/node)
 * 5. Last resort: use 'node' (likely bun's shim — sidecar will detect and exit)
 *
 * Cross-platform: Linux, macOS, Windows (nvm-windows, system install).
 */
function resolveRealNode() {
  const p = pr();
  const candidates = [];
  const home = process.env.HOME || process.env.USERPROFILE || '';

  // 1. `which node` — might be bun's shim, check it
  try {
    const cmd = process.platform === 'win32' ? 'where node' : 'which node';
    const whichNode = execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0];
    candidates.push(whichNode);
  } catch {
    /* not found */
  }

  // 2. NVM — scan installed versions directly from disk.
  // GOTCHA: turbo strips NVM_DIR/NVM_BIN env vars, so always check $HOME/.nvm too.
  const nvmDirs = [process.env.NVM_DIR, p.resolvePath('.nvm', home)].filter(
    Boolean
  );
  for (const nvmDir of nvmDirs) {
    try {
      const versionsDir = p.resolvePath('versions/node', nvmDir);
      const versions = p
        .readdirSync(versionsDir)
        .filter((v) => v.startsWith('v'))
        .sort()
        .reverse();
      for (const v of versions) {
        candidates.push(p.resolvePath(`${v}/bin/node`, versionsDir));
      }
    } catch {
      /* no nvm versions */
    }
  }
  if (process.env.NVM_BIN) {
    candidates.push(p.resolvePath('node', process.env.NVM_BIN));
  }

  // 3. Common system paths
  if (process.platform === 'win32') {
    candidates.push('C:\\Program Files\\nodejs\\node.exe');
    // nvm-windows
    const appData = process.env.APPDATA || '';
    if (appData) {
      try {
        const nvmWinDir = p.resolvePath('nvm', appData);
        const versions = p
          .readdirSync(nvmWinDir)
          .filter((v) => v.startsWith('v'))
          .sort()
          .reverse();
        for (const v of versions) {
          candidates.push(p.resolvePath(`${v}/node.exe`, nvmWinDir));
        }
      } catch {
        /* no nvm-windows */
      }
    }
  } else {
    candidates.push('/usr/local/bin/node', '/usr/bin/node');
  }

  // Pick the first candidate that's NOT bun's shim
  for (const candidate of candidates) {
    try {
      const resolved = p.realpathSync(candidate);
      // Bun shim lives at /tmp/bun-node-* or resolves to bun binary
      if (resolved.includes('bun')) continue;
      if (!p.pathExists(resolved)) continue;

      console.log(`[dndev] sidecar node: ${candidate} (real: ${resolved})`);
      return candidate;
    } catch {
      continue;
    }
  }

  // Last resort — warn and use 'node' (will likely be bun's shim)
  console.warn(
    '[dndev] WARNING: could not find real node binary — terminal may not work'
  );
  console.warn('[dndev] candidates tried:', candidates.join(', '));
  return 'node';
}

// ============================================================================
// SECURITY
// ============================================================================

/**
 * Validate a relative file path is safe to access.
 * Rejects traversal attacks, null bytes, and access to protected directories.
 * @param {string} filePath - Relative path from project root
 * @returns {boolean}
 */
function isPathSafe(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  if (filePath.includes('\0')) return false;
  const segments = filePath.split(/[/\\]/).filter(Boolean);
  for (const seg of segments) {
    if (seg === '.' || seg === '..') return false;
    if (seg === 'node_modules' || seg === '.git') return false;
    if (seg.startsWith('.') && seg !== '.dndev') return false;
  }
  return true;
}

/**
 * Check if a file path is in a writable directory.
 * @param {string} filePath - Relative path from project root
 * @returns {boolean}
 */
function isWriteAllowed(filePath) {
  if (filePath.includes('..')) return false;
  return (
    filePath.startsWith('.dndev/') ||
    filePath.startsWith('docs/') ||
    filePath.startsWith('guides/')
  );
}

/**
 * Resolve a relative path safely within project root.
 * Returns null if path escapes project boundaries.
 * @param {string} filePath - Relative path from project root
 * @returns {string|null}
 */
function resolveSafe(filePath) {
  const p = pr();
  const projectRoot = p.getRepoRoot();
  const resolved = p.resolvePath(filePath, projectRoot);
  // PathResolver.normalizePath already uses forward slashes
  const normRoot = p.normalizePath(projectRoot);
  const normResolved = p.normalizePath(resolved);
  if (!normResolved.startsWith(normRoot + '/') && normResolved !== normRoot)
    return null;
  return resolved;
}

const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

const BINARY_EXTS = new Set(Object.keys(MIME_MAP));

// ============================================================================
// GET /api/dndev/file?path=<relative-path>
// ============================================================================

async function handleFileRead(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const filePath = url.searchParams.get('path');
  if (!filePath)
    return sendJson(res, { error: 'path parameter required' }, 400);

  if (!isPathSafe(filePath))
    return sendJson(res, { error: 'Access denied' }, 403);

  const resolved = resolveSafe(filePath);
  if (!resolved) return sendJson(res, { error: 'Access denied' }, 403);

  const p = pr();
  if (!p.pathExists(resolved))
    return sendJson(res, { error: 'File not found' }, 404);

  const ext = getExtension(resolved);

  // Binary files (images)
  if (BINARY_EXTS.has(ext)) {
    const buffer = p.readSync(resolved, { format: 'buffer' });
    if (!buffer) return sendJson(res, { error: 'Failed to read file' }, 500);
    res.writeHead(200, {
      'Content-Type': MIME_MAP[ext] || 'application/octet-stream',
      'Content-Length': buffer.byteLength,
    });
    return void res.end(Buffer.from(buffer));
  }

  // JSON
  if (ext === '.json') {
    try {
      const content = await p.read(resolved); // auto-detects json from extension
      if (content === null)
        return sendJson(res, { error: 'Failed to read file' }, 500);
      return sendJson(res, { path: filePath, content });
    } catch {
      return sendJson(res, { error: 'Invalid JSON' }, 500);
    }
  }

  // Text
  try {
    const content = await p.read(resolved, { format: 'text' });
    if (content === null)
      return sendJson(res, { error: 'Failed to read file' }, 500);
    sendJson(res, { path: filePath, content });
  } catch {
    sendJson(res, { error: 'Failed to read file' }, 500);
  }
}

// ============================================================================
// GET /api/dndev/tree?dir=<relative-dir>
// ============================================================================

function handleTreeRead(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const dirParam = url.searchParams.get('dir');
  const p = pr();
  const root = p.getRepoRoot();
  const results = [];
  const SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.expo',
  ]);

  function walk(dir, relativePath) {
    try {
      const entries = p.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
        if (entry.isDirectory()) {
          results.push({ path: rel, name: entry.name, isDirectory: true });
          walk(p.resolvePath(entry.name, dir), rel);
        } else if (entry.name.endsWith('.md')) {
          results.push({ path: rel, name: entry.name, isDirectory: false });
        }
      }
    } catch {
      // Permission denied — skip
    }
  }

  const ALLOWED_DIRS = ['.dndev', 'docs', 'guides'];

  if (dirParam) {
    if (dirParam.includes('..') || dirParam.includes('\0')) {
      return sendJson(res, { error: 'Access denied' }, 403);
    }
    if (
      !ALLOWED_DIRS.includes(dirParam) &&
      !ALLOWED_DIRS.some((d) => dirParam.startsWith(d + '/'))
    ) {
      return sendJson(res, { error: 'Directory not allowed' }, 403);
    }
    // Resolve and verify the path stays within project root
    const dirPath = p.resolvePath(dirParam, root);
    const normRoot = p.normalizePath(root);
    const normDir = p.normalizePath(dirPath);
    if (!normDir.startsWith(normRoot + '/')) {
      return sendJson(res, { error: 'Access denied' }, 403);
    }
    if (p.pathExists(dirPath)) {
      results.push({
        path: dirParam,
        name: p.getBasename(dirParam),
        isDirectory: true,
      });
      walk(dirPath, dirParam);
    }
  } else {
    for (const d of ALLOWED_DIRS) {
      const dirPath = p.resolveRepoPath(d);
      if (p.pathExists(dirPath)) {
        results.push({ path: d, name: d, isDirectory: true });
        walk(dirPath, d);
      }
    }
    try {
      const rootEntries = p.readdirSync(root, { withFileTypes: true });
      for (const entry of rootEntries) {
        if (!entry.isDirectory() && entry.name.endsWith('.md')) {
          results.push({
            path: entry.name,
            name: entry.name,
            isDirectory: false,
          });
        }
      }
    } catch {
      /* skip */
    }
  }

  sendJson(res, { entries: results });
}

// ============================================================================
// POST /api/dndev/file?path=<relative-path>
// ============================================================================

async function handleFileWrite(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const filePath = url.searchParams.get('path');
  if (!filePath)
    return sendJson(res, { error: 'path parameter required' }, 400);

  if (!isPathSafe(filePath))
    return sendJson(res, { error: 'Access denied' }, 403);
  if (!isWriteAllowed(filePath))
    return sendJson(res, { error: 'Write not allowed to this path' }, 403);

  const resolved = resolveSafe(filePath);
  if (!resolved) return sendJson(res, { error: 'Access denied' }, 403);

  try {
    const body = await readBody(req);
    const { content } = JSON.parse(body);
    if (content === undefined)
      return sendJson(res, { error: 'content field required' }, 400);

    const output =
      typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    await pr().write(resolved, output, { overwrite: true });
    sendJson(res, { ok: true });
  } catch {
    sendJson(res, { error: 'Failed to write file' }, 500);
  }
}

// ============================================================================
// POST /api/dndev/progress/toggle
// ============================================================================

async function handleProgressToggle(req, res) {
  try {
    const body = await readBody(req);
    const { line, checked } = JSON.parse(body);
    if (typeof line !== 'number')
      return sendJson(res, { error: 'line number required' }, 400);

    const p = pr();
    const filePath = p.resolveRepoPath('.dndev/implementation.md');
    if (!p.pathExists(filePath))
      return sendJson(res, { error: 'implementation.md not found' }, 404);

    const content = await p.read(filePath, { format: 'text' });
    if (content === null)
      return sendJson(res, { error: 'Failed to read file' }, 500);

    const lines = content.split('\n');
    if (line < 0 || line >= lines.length)
      return sendJson(res, { error: 'Line out of range' }, 400);

    const currentLine = lines[line];
    lines[line] = checked
      ? currentLine.replace('- [ ]', '- [x]')
      : currentLine.replace('- [x]', '- [ ]');

    await p.write(filePath, lines.join('\n'), { overwrite: true });
    sendJson(res, { ok: true, line: lines[line] });
  } catch {
    sendJson(res, { error: 'Failed to update progress' }, 500);
  }
}

// ============================================================================
// POST /api/dndev/bugs/screenshot
// ============================================================================

async function handleBugScreenshotSave(req, res) {
  try {
    const body = await readBody(req);
    const { id, data } = JSON.parse(body);
    if (!id || !data)
      return sendJson(res, { error: 'id and data required' }, 400);

    if (!/^[\w-]+$/.test(id))
      return sendJson(res, { error: 'Invalid screenshot ID' }, 400);

    const p = pr();
    const bugsDir = p.resolveRepoPath('.dndev/bugs');
    p.ensureDirSync(bugsDir);

    const buffer = Buffer.from(data, 'base64');
    const screenshotPath = p.resolvePath(`${id}.png`, bugsDir);
    await p.write(screenshotPath, buffer, { overwrite: true });
    sendJson(res, { ok: true, path: `.dndev/bugs/${id}.png` });
  } catch {
    sendJson(res, { error: 'Failed to save screenshot' }, 500);
  }
}

// ============================================================================
// POST /api/dndev/phase
// ============================================================================

async function handlePhaseAction(req, res) {
  try {
    const body = await readBody(req);
    const { action, phase } = JSON.parse(body);
    if (!action || typeof phase !== 'number')
      return sendJson(res, { error: 'action and phase required' }, 400);

    const p = pr();
    const dndevDir = getDndevDir();
    p.ensureDirSync(dndevDir);

    const filePath = p.resolvePath('protocol.json', dndevDir);
    let protocol = { currentPhase: 0, phases: {} };
    if (p.pathExists(filePath)) {
      try {
        const data = await p.read(filePath); // auto-detects json
        if (data) protocol = data;
      } catch {
        /* reset */
      }
    }

    if (action === 'start') {
      protocol.currentPhase = phase;
      if (!protocol.phases[phase]) protocol.phases[phase] = {};
      protocol.phases[phase].status = 'active';
      protocol.phases[phase].startedAt = new Date().toISOString();
    } else if (action === 'complete') {
      if (!protocol.phases[phase]) protocol.phases[phase] = {};
      protocol.phases[phase].status = 'completed';
      protocol.phases[phase].completedAt = new Date().toISOString();
    }

    await p.write(filePath, protocol, { overwrite: true });
    sendJson(res, { ok: true, protocol });
  } catch {
    sendJson(res, { error: 'Failed to update phase' }, 500);
  }
}

// ============================================================================
// GET /api/dndev/git/head
// ============================================================================

function handleGitHead(_req, res) {
  try {
    const root = getProjectRoot();
    const commit = execSync('git rev-parse --short HEAD', {
      cwd: root,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: root,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    sendJson(res, { commit, branch });
  } catch {
    sendJson(res, { commit: 'unknown', branch: 'unknown' });
  }
}

// ============================================================================
// POST /api/dndev/actions/append
// ============================================================================

async function handleActionsAppend(req, res) {
  try {
    const body = await readBody(req);
    const entry = JSON.parse(body);
    if (!entry.id || !entry.type || !entry.result) {
      return sendJson(res, { error: 'id, type, and result required' }, 400);
    }

    const p = pr();
    const dndevDir = getDndevDir();
    p.ensureDirSync(dndevDir);

    const filePath = p.resolvePath('health.json', dndevDir);
    let health = { actions: [] };
    if (p.pathExists(filePath)) {
      try {
        const data = await p.read(filePath); // auto-detects json
        if (data) health = data;
      } catch {
        /* reset */
      }
    }
    if (!Array.isArray(health.actions)) health.actions = [];

    // Upsert by id
    const idx = health.actions.findIndex((a) => a.id === entry.id);
    if (idx >= 0) {
      health.actions[idx] = { ...health.actions[idx], ...entry };
    } else {
      health.actions.unshift(entry);
    }

    await p.write(filePath, health, { overwrite: true });
    sendJson(res, { ok: true });
  } catch {
    sendJson(res, { error: 'Failed to append action' }, 500);
  }
}

// ============================================================================
// GET /api/dndev/apps — list consumer apps in the monorepo
// ============================================================================

function handleAppsDiscovery(_req, res) {
  const p = pr();
  const appsDir = p.resolveRepoPath('apps');
  try {
    const entries = p.readdirSync(appsDir);
    const apps = entries
      .filter((name) => {
        if (name === 'dndev') return false;
        const dir = p.resolvePath(name, appsDir);
        const stat = p.statSync(dir);
        return (
          stat?.isDirectory() &&
          p.pathExists(p.resolvePath('package.json', dir))
        );
      })
      .map((name) => {
        try {
          const pkgPath = p.resolvePath(`${name}/package.json`, appsDir);
          const pkg = p.readSync(pkgPath); // auto-detects json
          return { name, packageName: pkg?.name || name };
        } catch {
          return { name, packageName: name };
        }
      });
    sendJson(res, { apps });
  } catch {
    sendJson(res, { apps: [] });
  }
}

// ============================================================================
// WORKTREE API
// ============================================================================

function handleWorktreeList(_req, res) {
  try {
    const root = getProjectRoot();
    const raw = execSync('git worktree list --porcelain', {
      cwd: root,
      encoding: 'utf-8',
      timeout: 5000,
    });

    const worktrees = [];
    let current = {};
    for (const line of raw.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current);
        current = { path: line.slice(9) };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.slice(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.slice(7);
        current.shortBranch = current.branch.replace('refs/heads/', '');
      } else if (line === 'detached') {
        current.detached = true;
      }
    }
    if (current.path) worktrees.push(current);

    sendJson(res, { worktrees });
  } catch (err) {
    sendJson(res, { error: err.message }, 500);
  }
}

async function handleWorktreeAdd(req, res) {
  try {
    const body = await readBody(req);
    const { branch } = JSON.parse(body);
    if (!branch || typeof branch !== 'string')
      return sendJson(res, { error: 'branch required' }, 400);
    if (!/^[\w][\w./-]*$/.test(branch))
      return sendJson(res, { error: 'Invalid branch name' }, 400);

    const root = getProjectRoot();
    const p = pr();
    const parentDir = p.resolvePath('..', root);
    const repoName = p.getBasename(root);
    const worktreePath = p.resolvePath(
      `${repoName}-${branch.replace(/\//g, '-')}`,
      parentDir
    );

    execFileSync('git', ['worktree', 'add', worktreePath, '-b', branch], {
      cwd: root,
      encoding: 'utf-8',
      timeout: 30000,
    });

    sendJson(res, { ok: true, path: worktreePath, branch });
  } catch (err) {
    sendJson(res, { error: err.message }, 500);
  }
}

async function handleWorktreeRemove(req, res) {
  try {
    const body = await readBody(req);
    const { path: wtPath } = JSON.parse(body);
    if (!wtPath || typeof wtPath !== 'string')
      return sendJson(res, { error: 'path required' }, 400);

    const root = getProjectRoot();
    execFileSync('git', ['worktree', 'remove', wtPath, '--force'], {
      cwd: root,
      encoding: 'utf-8',
      timeout: 10000,
    });

    sendJson(res, { ok: true });
  } catch (err) {
    sendJson(res, { error: err.message }, 500);
  }
}

function handleWorktreeDiff(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const branch = url.searchParams.get('branch');
    if (!branch) return sendJson(res, { error: 'branch required' }, 400);
    if (!/^[\w][\w./-]*$/.test(branch))
      return sendJson(res, { error: 'Invalid branch name' }, 400);

    const root = getProjectRoot();
    const stat = execFileSync('git', ['diff', `main...${branch}`, '--stat'], {
      cwd: root,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();

    const diff = execFileSync('git', ['diff', `main...${branch}`], {
      cwd: root,
      encoding: 'utf-8',
      timeout: 30000,
    });

    sendJson(res, { stat, diff });
  } catch (err) {
    sendJson(res, { error: err.message }, 500);
  }
}

async function handleWorktreePr(req, res) {
  try {
    const body = await readBody(req);
    const { branch, title, bodyText } = JSON.parse(body);
    if (!branch) return sendJson(res, { error: 'branch required' }, 400);

    const root = getProjectRoot();
    const args = ['pr', 'create', '--head', branch];
    if (title) args.push('--title', title);
    if (bodyText) args.push('--body', bodyText);

    const result = execFileSync('gh', args, {
      cwd: root,
      encoding: 'utf-8',
      timeout: 30000,
    }).trim();

    sendJson(res, { ok: true, url: result });
  } catch (err) {
    sendJson(res, { error: err.message }, 500);
  }
}

// ============================================================================
// GIT PLATFORM API
// ============================================================================

function handleGitPlatform(_req, res) {
  try {
    const root = getProjectRoot();
    const remoteUrl = execSync('git remote get-url origin', {
      cwd: root,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    let platform = null;
    if (remoteUrl.includes('github.com')) platform = 'github';
    else if (remoteUrl.includes('gitlab')) platform = 'gitlab';

    sendJson(res, { platform, remoteUrl });
  } catch {
    sendJson(res, { platform: null, remoteUrl: null });
  }
}

function handleGitPrs(_req, res) {
  try {
    const root = getProjectRoot();
    const raw = execSync(
      'gh pr list --json number,title,state,author,headRefName,url,isDraft,reviewDecision,statusCheckRollup --limit 50',
      { cwd: root, encoding: 'utf-8', timeout: 15000 }
    );
    sendJson(res, { prs: JSON.parse(raw) });
  } catch (err) {
    sendJson(res, { prs: [], error: err.message });
  }
}

function handleGitIssues(_req, res) {
  try {
    const root = getProjectRoot();
    const raw = execSync(
      'gh issue list --json number,title,state,labels,assignees --limit 50',
      { cwd: root, encoding: 'utf-8', timeout: 15000 }
    );
    sendJson(res, { issues: JSON.parse(raw) });
  } catch (err) {
    sendJson(res, { issues: [], error: err.message });
  }
}

function handleGitPrDiff(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const prNumber = url.searchParams.get('number');
    if (!prNumber || !/^\d+$/.test(prNumber))
      return sendJson(res, { error: 'PR number required' }, 400);

    const root = getProjectRoot();
    const diff = execSync(`gh pr diff ${prNumber}`, {
      cwd: root,
      encoding: 'utf-8',
      timeout: 30000,
    });
    sendJson(res, { diff });
  } catch (err) {
    sendJson(res, { error: err.message }, 500);
  }
}

function handleGitPrChecks(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const prNumber = url.searchParams.get('number');
    if (!prNumber || !/^\d+$/.test(prNumber))
      return sendJson(res, { error: 'PR number required' }, 400);

    const root = getProjectRoot();
    const raw = execSync(`gh pr checks ${prNumber} --json name,state,status`, {
      cwd: root,
      encoding: 'utf-8',
      timeout: 15000,
    });
    sendJson(res, { checks: JSON.parse(raw) });
  } catch (err) {
    sendJson(res, { checks: [], error: err.message });
  }
}

async function handleGitPrReview(req, res) {
  try {
    const body = await readBody(req);
    const { number, action, comment } = JSON.parse(body);
    if (!number || !action)
      return sendJson(res, { error: 'number and action required' }, 400);

    const validActions = ['approve', 'request-changes', 'comment'];
    if (!validActions.includes(action))
      return sendJson(
        res,
        { error: `Invalid action. Use: ${validActions.join(', ')}` },
        400
      );

    const root = getProjectRoot();
    const args = [`pr`, `review`, String(number), `--${action}`];
    if (comment) args.push('--body', comment);

    execFileSync('gh', args, {
      cwd: root,
      encoding: 'utf-8',
      timeout: 15000,
    });

    sendJson(res, { ok: true });
  } catch (err) {
    sendJson(res, { error: err.message }, 500);
  }
}

// ============================================================================
// TERMINAL — node-pty + ws WebSocket (cross-platform)
// ============================================================================

/**
 * Real PTY via node-pty, WebSocket via ws.
 * Protocol: JSON control messages + raw data.
 *
 * Client -> Server:
 *   { type: 'start', tab, cols, rows }
 *   { type: 'input', tab, data }
 *   { type: 'resize', tab, cols, rows }
 *   { type: 'kill', tab }
 *
 * Server -> Client:
 *   { type: 'started', tab }
 *   { type: 'output', tab, data }
 *   { type: 'exit', tab, code }
 *   { type: 'error', tab, message }
 */

const TERMINAL_PORT = 24681;

let sidecarSpawned = false;

function setupTerminal(server) {
  if (sidecarSpawned) return; // Already running (HMR restart)

  const p = pr();
  const appRoot = p.normalizePath(server.config.root);
  const sidecarPath = p.resolvePath('terminal-sidecar.cjs', appRoot);

  if (!p.pathExists(sidecarPath)) {
    console.warn('[dndev] terminal-sidecar.cjs not found — terminal disabled.');
    return;
  }

  // Kill any zombie sidecar from a previous run still holding the port
  try {
    const pid = execSync(`fuser ${TERMINAL_PORT}/tcp 2>/dev/null`, {
      encoding: 'utf8',
    }).trim();
    if (pid) {
      console.log(
        `[dndev] killing zombie sidecar (pid=${pid}) on port ${TERMINAL_PORT}`
      );
      process.kill(Number(pid), 'SIGKILL');
    }
  } catch {
    /* no process on port — good */
  }

  sidecarSpawned = true;
  const repoRoot = p.getRepoRoot();

  // Resolve REAL system node — bun injects a fake node shim into PATH
  // that resolves to /tmp/bun-node-*/node (actually bun). node-pty requires real Node.
  const nodeBin = resolveRealNode();

  const sidecar = nodeSpawn(nodeBin, [sidecarPath], {
    cwd: repoRoot,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    env: {
      ...process.env,
      TERMINAL_PORT: String(TERMINAL_PORT),
      TERMINAL_CWD: repoRoot,
    },
  });

  sidecar.on('message', (msg) => {
    if (msg.type === 'ready') {
      console.log(`[dndev] terminal ready on ws://localhost:${msg.port}`);
    }
  });

  sidecar.on('exit', (code) => {
    sidecarSpawned = false;
    if (code !== 0)
      console.warn(`[dndev] terminal sidecar exited (code=${code})`);
  });

  // Kill sidecar on process exit (Ctrl+C), NOT on httpServer close (HMR restart)
  process.on('exit', () => {
    sidecar.kill();
  });
}

// ============================================================================
// FILE WATCHER — .dndev/, docs/, guides/
// ============================================================================

const debounceMap = new Map();

function setupFileWatcher(server) {
  const p = pr();
  const projectRoot = p.getRepoRoot();
  const watchDirs = ['.dndev', 'docs', 'guides'];

  for (const dir of watchDirs) {
    const dirPath = p.resolveRepoPath(dir);
    if (!p.pathExists(dirPath)) continue;

    const watcher = p.watch(
      dirPath,
      { recursive: true },
      (_eventType, filename) => {
        if (!filename) return;
        // dashboard.json is written by the app itself (panel sizes, mode).
        // Watching it creates a loop: write -> HMR -> re-render -> write.
        if (filename === 'dashboard.json') return;
        const relativePath = `${dir}/${filename}`;
        const key = `change:${relativePath}`;
        if (debounceMap.has(key)) return;
        debounceMap.set(key, true);
        setTimeout(() => debounceMap.delete(key), 300);

        server.hot.send('dndev:file-changed', {
          path: relativePath,
          timestamp: Date.now(),
        });
      }
    );

    server.httpServer?.on('close', () => watcher.close());
  }
}

// ============================================================================
// PLUGIN
// ============================================================================

/**
 * Unified Vite plugin for the dndev dashboard.
 * File API via PathResolver + terminal (node-pty + ws) + file watcher.
 *
 * @param {Object} [options]
 * @param {boolean} [options.debug] - Log resolved paths
 * @returns {import('vite').Plugin}
 */
export function createDndevPlugin(options = {}) {
  return {
    name: 'dndev',

    configureServer(server) {
      const root = getProjectRoot();
      if (options.debug) {
        console.log(`[dndev] repo root: ${root}`);
      }

      // REST API middleware
      server.middlewares.use((req, res, next) => {
        const url = req.url;
        if (!url?.startsWith(API_PREFIX)) return next();

        const parsedUrl = new URL(url, `http://${req.headers.host}`);
        const route = parsedUrl.pathname.slice(API_PREFIX.length);
        const method = req.method?.toUpperCase();

        if (method === 'GET') {
          if (route === '/file') return void handleFileRead(req, res);
          if (route === '/tree') return void handleTreeRead(req, res);
          if (route === '/git/head') return void handleGitHead(req, res);
          if (route === '/apps') return void handleAppsDiscovery(req, res);
          // Worktree API
          if (route === '/worktrees') return void handleWorktreeList(req, res);
          if (route === '/worktrees/diff')
            return void handleWorktreeDiff(req, res);
          // Git platform API
          if (route === '/git/platform')
            return void handleGitPlatform(req, res);
          if (route === '/git/prs') return void handleGitPrs(req, res);
          if (route === '/git/issues') return void handleGitIssues(req, res);
          if (route === '/git/pr/diff') return void handleGitPrDiff(req, res);
          if (route === '/git/pr/checks')
            return void handleGitPrChecks(req, res);
          return sendJson(res, { error: 'Not found' }, 404);
        }

        if (method === 'POST') {
          if (route === '/file') return void handleFileWrite(req, res);
          if (route === '/progress/toggle')
            return void handleProgressToggle(req, res);
          if (route === '/bugs/screenshot')
            return void handleBugScreenshotSave(req, res);
          if (route === '/phase') return void handlePhaseAction(req, res);
          if (route === '/actions/append')
            return void handleActionsAppend(req, res);
          // Worktree API
          if (route === '/worktrees/add')
            return void handleWorktreeAdd(req, res);
          if (route === '/worktrees/remove')
            return void handleWorktreeRemove(req, res);
          if (route === '/worktrees/pr') return void handleWorktreePr(req, res);
          // Git platform API
          if (route === '/git/pr/review')
            return void handleGitPrReview(req, res);
          return sendJson(res, { error: 'Not found' }, 404);
        }

        sendJson(res, { error: 'Method not allowed' }, 405);
      });

      // Terminal: self-contained node sidecar (node-pty + ws on port 24681)
      setupTerminal(server);

      // HMR file watcher
      setupFileWatcher(server);

      console.log('[dndev] ready');
    },
  };
}
