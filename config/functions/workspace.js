/**
 * @fileoverview Workspace detection and path resolution utilities
 * @description Detects workspace environment and resolves @donotdev/* package paths.
 * Bootstrap utility — runs BEFORE PathResolver exists (finds workspace root).
 * Uses native node:fs/node:path for the same reason as esbuildShim.js.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Detect the current workspace environment
 * @returns {Object} Workspace information
 */
export function detectWorkspace() {
  let currentDir = process.cwd();

  // Walk up directory tree to find monorepo root
  const maxDepth = 10;
  for (let i = 0; i < maxDepth; i++) {
    const packageJsonPath = path.join(currentDir, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf8')
        );
        const hasWorkspaces =
          packageJson.workspaces && Array.isArray(packageJson.workspaces);

        // Check for dndev monorepo (packages/** pattern + packages/core exists)
        const hasDndevPackages =
          hasWorkspaces &&
          packageJson.workspaces.some(
            (workspace) =>
              workspace === 'packages/**' || workspace.startsWith('packages/')
          );
        const isDndevRepo =
          hasDndevPackages &&
          (fs.existsSync(path.join(currentDir, 'packages', 'core')) ||
            fs.existsSync(path.join(currentDir, 'packages', 'functions')));

        if (isDndevRepo) {
          return {
            type: 'dndev',
            root: currentDir,
          };
        }

        // Check for consumer project linked to dndev (../dndev/packages/** pattern)
        const hasLinkedDndev =
          hasWorkspaces &&
          packageJson.workspaces.some((workspace) =>
            workspace.includes('dndev/packages')
          );
        if (hasLinkedDndev) {
          // Find the dndev root from the workspace pattern
          const dndevPattern = packageJson.workspaces.find((workspace) =>
            workspace.includes('dndev/packages')
          );
          // Extract path before 'packages' (e.g., '../dndev' from '../dndev/packages/**')
          const dndevRelPath = dndevPattern.replace(/\/packages.*$/, '');
          const dndevRoot = path.resolve(currentDir, dndevRelPath);

          if (fs.existsSync(path.join(dndevRoot, 'packages', 'core'))) {
            return {
              type: 'dndev',
              root: dndevRoot,
            };
          }
        }
      } catch (error) {
        console.warn(
          'Could not parse package.json for workspace detection:',
          error.message
        );
      }
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
  }

  // Fallback to npm packages (bundled)
  return {
    type: 'npm',
    root: process.cwd(),
  };
}

/**
 * Resolve the monorepo root path
 * @param {Object} workspace - Workspace information
 * @returns {string|null} Resolved monorepo root or null
 */
export function resolveDndevPath(workspace) {
  if (workspace.type === 'dndev') {
    return workspace.root;
  }

  return null;
}

/**
 * Get workspace package aliases for esbuild
 * @param {Object} workspace - Workspace information
 * @returns {Object} Package aliases
 */
export function getWorkspaceAliases(workspace) {
  const aliases = {};

  if (workspace.type === 'dndev') {
    const monorepoRoot = resolveDndevPath(workspace);
    if (monorepoRoot) {
      // Map @donotdev/* packages to their source directories
      aliases['@donotdev/types'] = path.join(
        monorepoRoot,
        'packages',
        'core',
        'types',
        'src'
      );
      aliases['@donotdev/functions'] = path.join(
        monorepoRoot,
        'packages',
        'functions',
        'src'
      );
      aliases['@donotdev/utils'] = path.join(
        monorepoRoot,
        'packages',
        'core',
        'utils',
        'src'
      );
      aliases['@donotdev/schemas'] = path.join(
        monorepoRoot,
        'packages',
        'core',
        'schemas',
        'src'
      );
      // Map @donotdev/core to core package root (for subpath exports like /server)
      aliases['@donotdev/core'] = path.join(monorepoRoot, 'packages', 'core');
    }
  }

  return aliases;
}

/**
 * Check if a package should be externalized
 * @param {string} packageName - Package name
 * @returns {boolean} Whether to externalize the package
 */
export function shouldExternalizePackage(packageName) {
  // Firebase packages should be externalized
  const externalPackages = [
    'firebase-admin',
    'firebase-functions',
    'firebase-functions/v2',
    'firebase-functions/v1',
  ];

  return externalPackages.some(
    (pkg) => packageName === pkg || packageName.startsWith(pkg + '/')
  );
}

/**
 * Get cross-platform path for esbuild
 * @param {string} filePath - File path
 * @returns {string} Cross-platform path
 */
export function getCrossPlatformPath(filePath) {
  // Convert Windows paths to Unix-style for esbuild
  return filePath.replace(/\\/g, '/');
}
