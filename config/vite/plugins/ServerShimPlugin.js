/**
 * @fileoverview ServerShim Plugin - Server-only Import Blocking
 * @description Vite plugin to block server-only imports in client-side code to prevent runtime errors.
 *
 * @version 0.0.1
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

// config/src/vite/server-shim-plugin.js

import { SERVER_ONLY_PACKAGES, SERVER_ONLY_SUBPATHS } from '../../constants.js';
import { createLogger } from '../../utils/debugLog.js';

/**
 * Vite plugin to block server-only imports
 */
export function createServerShimPlugin(options = {}) {
  // Trust merged config - defaults come from DEFAULT_OPTIONS.serverShim
  // Note: serverShim cannot be disabled - framework would crash without it
  const { debug } = options; // Already merged from DEFAULT_OPTIONS.serverShim

  return {
    name: 'dndev-server-shim',
    enforce: 'pre',

    resolveId(id, importer) {
      // Block Node.js built-in modules (node:*) in client code
      // This MUST run before any other plugin to catch all node: imports
      if (id.startsWith('node:')) {
        const logger = createLogger('server-shim', debug, true);
        logger.warn(
          `Blocking Node.js built-in module import: ${id}${importer ? ` from ${importer}` : ''}`
        );
        return '\0virtual:empty-server-module';
      }

      // Block server-only subpath exports from @donotdev/core
      // These are config files that should never be bundled into client code
      if (
        SERVER_ONLY_SUBPATHS.includes(id) ||
        SERVER_ONLY_SUBPATHS.some((subpath) => id.startsWith(`${subpath}/`))
      ) {
        const logger = createLogger('server-shim', debug, true);
        logger.warn(
          `Blocking server-only subpath import: ${id}${importer ? ` from ${importer}` : ''}`
        );
        return '\0virtual:empty-server-module';
      }

      // Strict equality matching - exact package name only
      if (SERVER_ONLY_PACKAGES.includes(id)) {
        const logger = createLogger('server-shim', debug, true);
        logger.warn(
          `Blocking server-only import: ${id}${importer ? ` from ${importer}` : ''}`
        );
        return '\0virtual:empty-server-module';
      }
      return null;
    },

    load(id) {
      if (id === '\0virtual:empty-server-module') {
        return `
          // Node.js built-in modules shims for browser compatibility
          export const URL = globalThis.URL;
          export const URLSearchParams = globalThis.URLSearchParams;
          export default {};
          
          // Firebase shims
          export const getFirestore = () => ({});
          export const collection = () => ({});
          export const doc = () => ({});
          export const getDoc = async () => ({});
          export const getDocs = async () => ({ docs: [] });
          export const setDoc = async () => {};
          export const updateDoc = async () => {};
          export const deleteDoc = async () => {};
          export const query = () => ({});
          export const where = () => ({});
          export const orderBy = () => ({});
          export const limit = () => ({});
          export const serverTimestamp = () => new Date();
          export const arrayUnion = (...items) => items;
          export const arrayRemove = (...items) => items;
          
          // Payload CMS shims
          export const fileTypeFromFile = async () => ({ ext: 'unknown', mime: 'application/octet-stream' });
          export const fileTypeFromBuffer = async () => ({ ext: 'unknown', mime: 'application/octet-stream' });
          export const fileTypeFromStream = async () => ({ ext: 'unknown', mime: 'application/octet-stream' });
          export const fileTypeFromBlob = async () => ({ ext: 'unknown', mime: 'application/octet-stream' });
          export const fileTypeFromUint8Array = async () => ({ ext: 'unknown', mime: 'application/octet-stream' });
          export const fileType = { fileTypeFromFile, fileTypeFromBuffer, fileTypeFromStream, fileTypeFromBlob, fileTypeFromUint8Array };
          
          // Undici HTTP client shims
          export const undiciRequest = () => ({});
          export const fetch = globalThis.fetch;
          export const Headers = globalThis.Headers;
          export const Request = globalThis.Request;
          export const Response = globalThis.Response;
          
          // Fastify Busboy multipart parsing shims
          export const Busboy = class Busboy {};
          export const createReadStream = () => ({});
          
          // Image-size shims
          export const imageSize = () => ({ width: 0, height: 0, type: 'unknown' });
          export const imageSizeFromFile = () => ({ width: 0, height: 0, type: 'unknown' });
          export const imageSizeFromBuffer = () => ({ width: 0, height: 0, type: 'unknown' });
          
          // Node.js crypto shims
          export const createHash = () => ({ update: () => {}, digest: () => '' });
          export const randomBytes = () => new Uint8Array(16);
          
          // Node.js path shims
          export const join = (...args) => args.join('/');
          export const resolve = (...args) => args.join('/');
          export const dirname = (path) => path.split('/').slice(0, -1).join('/') || '.';
          export const basename = (path) => path.split('/').pop() || '';
          export const extname = (path) => {
            const parts = path.split('.');
            return parts.length > 1 ? '.' + parts.pop() : '';
          };
          
          // Node.js fs shims
          export const readFileSync = () => '';
          export const writeFileSync = () => {};
          export const existsSync = () => false;
          export const mkdirSync = () => {};
          export const statSync = () => ({ isDirectory: () => false, isFile: () => false });
          export const readdirSync = () => [];
          
          // Node.js os shims
          export const platform = () => 'browser';
          export const arch = () => 'x64';
          export const homedir = () => '/';
          export const tmpdir = () => '/tmp';
          
          // Node.js util shims
          export const promisify = (fn) => fn;
          export const inspect = (obj) => JSON.stringify(obj);
          export const format = (...args) => args.join(' ');
          
          // Node.js stream shims
          export const Readable = class Readable {};
          export const Writable = class Writable {};
          export const Transform = class Transform {};
          
          // Node.js buffer shims
          export const Buffer = globalThis.ArrayBuffer;
          
          // Node.js events shims
          export const EventEmitter = class EventEmitter {
            on() { return this; }
            emit() { return false; }
            once() { return this; }
            off() { return this; }
            removeListener() { return this; }
            addListener() { return this; }
          };
          
          // Node.js http shims
          export const createServer = () => ({ listen: () => {}, close: () => {} });
          export const request = () => ({ end: () => {} });
          export const get = () => ({ end: () => {} });
          
          // Node.js https shims (re-export http shims)
          // createServer, request, get already exported above
          
          // Node.js querystring shims
          export const parse = (str) => {
            const params = new URLSearchParams(str);
            const result = {};
            for (const [key, value] of params) {
              result[key] = value;
            }
            return result;
          };
          export const stringify = (obj) => new URLSearchParams(obj).toString();
          
          // Node.js zlib shims
          export const gzip = (data) => Promise.resolve(data);
          export const gunzip = (data) => Promise.resolve(data);
          export const deflate = (data) => Promise.resolve(data);
          export const inflate = (data) => Promise.resolve(data);
          
          // Node.js assert shims
          export const assert = (value, message) => {
            if (!value) throw new Error(message || 'Assertion failed');
          };
          
          // Node.js constants shims
          export const F_OK = 0;
          export const R_OK = 4;
          export const W_OK = 2;
          export const X_OK = 1;
          
          // Node.js domain shims
          export const create = () => ({ run: (fn) => fn(), dispose: () => {} });
          export const createDomain = create;
          
          // Node.js punycode shims
          export const encode = (str) => str;
          export const decode = (str) => str;
          export const toASCII = (str) => str;
          export const toUnicode = (str) => str;
          
          // Node.js string_decoder shims
          export const StringDecoder = class StringDecoder {
            write() { return ''; }
            end() { return ''; }
          };
          
          // Node.js timers shims
          export const setTimeout = globalThis.setTimeout;
          export const clearTimeout = globalThis.clearTimeout;
          export const setInterval = globalThis.setInterval;
          export const clearInterval = globalThis.clearInterval;
          export const setImmediate = (fn) => setTimeout(fn, 0);
          export const clearImmediate = clearTimeout;
          
          // Node.js tty shims
          export const isatty = () => false;
          export const ReadStream = class ReadStream {};
          export const WriteStream = class WriteStream {};
          
          // Node.js vm shims
          export const createContext = (sandbox) => sandbox || {};
          export const runInContext = (code, context) => eval(code);
          export const runInNewContext = (code, sandbox) => eval(code);
          export const runInThisContext = (code) => eval(code);
          
          // Node.js worker_threads shims
          export const Worker = class Worker {};
          export const isMainThread = true;
          export const parentPort = null;
          export const workerData = null;
          
          // Node.js cluster shims
          export const isMaster = true;
          export const isWorker = false;
          export const fork = () => ({});
          export const setupMaster = () => {};
          
          // Node.js dgram shims
          export const createSocket = () => ({ bind: () => {}, close: () => {} });
          
          // Node.js dns shims
          export const lookup = (hostname, callback) => callback(null, '127.0.0.1', 4);
          export const dnsResolve = (hostname, callback) => callback(null, ['127.0.0.1']);
          export const resolve4 = dnsResolve;
          export const resolve6 = dnsResolve;
          
          // Node.js http2 shims
          export const createSecureServer = () => ({ listen: () => {}, close: () => {} });
          export const connect = () => ({});
          
          // Node.js inspector shims
          export const open = () => {};
          export const close = () => {};
          export const url = () => null;
          
          // Node.js module shims
          export const createRequire = () => {
            // Return a require-like function that returns empty objects
            // This prevents "createRequire is not a function" errors
            const requireFn = (id) => {
              console.warn(\`[ServerShim] Attempted to require "\${id}" in browser context. This is a server-only operation.\`);
              return {};
            };
            requireFn.resolve = () => '';
            return requireFn;
          };
          export const _cache = {};
          export const _extensions = {};
          
          // Node.js perf_hooks shims
          export const performance = globalThis.performance;
          export const PerformanceObserver = globalThis.PerformanceObserver;
          
          // Node.js process shims
          export const process = {
            env: {},
            argv: [],
            cwd: () => '/',
            chdir: () => {},
            exit: () => {},
            nextTick: (fn) => setTimeout(fn, 0),
            platform: 'browser',
            arch: 'x64',
            version: 'v18.0.0',
            versions: { node: '18.0.0' },
            uptime: () => 0,
            memoryUsage: () => ({ rss: 0, heapTotal: 0, heapUsed: 0, external: 0 }),
            cpuUsage: () => ({ user: 0, system: 0 }),
            hrtime: () => [0, 0],
            hrtimeBigInt: () => 0n,
            send: () => {},
            disconnect: () => {},
            kill: () => {},
            title: 'browser',
            pid: 1,
            ppid: 0,
            stdin: { isTTY: false },
            stdout: { isTTY: false },
            stderr: { isTTY: false },
            mainModule: null,
            module: { exports: {} },
            require: () => ({}),
          };
          
          // Node.js readline shims
          export const createInterface = () => ({
            question: (query, callback) => callback(''),
            close: () => {},
            on: () => {},
            write: () => {},
          });
          
          // Node.js repl shims
          export const start = () => ({});
          export const repl = { start };
          
          // Node.js trace_events shims
          export const createTracing = () => ({ enable: () => {}, disable: () => {} });
          
          // Node.js v8 shims
          export const getHeapStatistics = () => ({});
          export const getHeapSpaceStatistics = () => [];
          export const setFlagsFromString = () => {};
          
          // Node.js wasi shims
          export const WASI = class WASI {};
          
          // GCP Metadata shims
          export const instance = () => Promise.resolve({});
          export const project = () => Promise.resolve('demo-project');
          export const getProjectId = () => Promise.resolve('demo-project');
          
          // Google Logging Utils shims
          export const LoggingWinston = class LoggingWinston {};
          export const LoggingBunyan = class LoggingBunyan {};
        `;
      }
      return null;
    },
  };
}
