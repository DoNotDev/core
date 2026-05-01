import nodeCrypto from 'node:crypto';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Web Crypto API mock ────────────────────────────────────────────
// happy-dom does not provide a full crypto.subtle implementation,
// so we build a lightweight mock backed by Node's built-in crypto.

function buildSubtleMock() {
  return {
    generateKey: vi.fn(
      async (
        algorithm: AesKeyGenParams,
        extractable: boolean,
        usages: KeyUsage[]
      ) => {
        const raw = nodeCrypto.randomBytes(algorithm.length / 8);
        return {
          __raw: raw,
          algorithm,
          extractable,
          usages,
          type: 'secret' as const,
        };
      }
    ),

    exportKey: vi.fn(async (_format: string, key: any) => {
      return key.__raw.buffer.slice(
        key.__raw.byteOffset,
        key.__raw.byteOffset + key.__raw.byteLength
      );
    }),

    importKey: vi.fn(
      async (
        _format: string,
        keyData: ArrayBuffer | Uint8Array,
        algorithm: AesKeyGenParams,
        extractable: boolean,
        usages: KeyUsage[]
      ) => {
        const buf =
          keyData instanceof Uint8Array
            ? keyData
            : new Uint8Array(keyData as ArrayBuffer);
        return {
          __raw: Buffer.from(buf),
          algorithm,
          extractable,
          usages,
          type: 'secret' as const,
        };
      }
    ),

    encrypt: vi.fn(
      async (
        algorithm: { name: string; iv: Uint8Array },
        key: any,
        data: ArrayBuffer
      ) => {
        const cipher = nodeCrypto.createCipheriv(
          'aes-256-gcm',
          key.__raw,
          algorithm.iv
        );
        const encrypted = Buffer.concat([
          cipher.update(Buffer.from(data)),
          cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        // AES-GCM output = ciphertext + 16-byte auth tag
        const result = new Uint8Array(encrypted.length + tag.length);
        result.set(encrypted, 0);
        result.set(tag, encrypted.length);
        return result.buffer;
      }
    ),

    decrypt: vi.fn(
      async (
        algorithm: { name: string; iv: Uint8Array },
        key: any,
        data: ArrayBuffer
      ) => {
        const buf = Buffer.from(data);
        const ciphertext = buf.subarray(0, buf.length - 16);
        const tag = buf.subarray(buf.length - 16);
        const decipher = nodeCrypto.createDecipheriv(
          'aes-256-gcm',
          key.__raw,
          algorithm.iv
        );
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);
        return decrypted.buffer.slice(
          decrypted.byteOffset,
          decrypted.byteOffset + decrypted.byteLength
        );
      }
    ),
  };
}

// Install mock before module import
const subtleMock = buildSubtleMock();

vi.stubGlobal('crypto', {
  subtle: subtleMock,
  getRandomValues: (arr: Uint8Array) => {
    const bytes = nodeCrypto.randomBytes(arr.length);
    arr.set(bytes);
    return arr;
  },
});

// ── IndexedDB mock ────────────────────────────────────────────────
// exportEncryptionKey / importEncryptionKey are removed — keys are now
// stored as native CryptoKey objects in IndexedDB (non-extractable).
// Provide a minimal IDB mock so getEncryptionKey can persist the key.

let idbStore: Map<IDBValidKey, unknown> = new Map();

function buildIdbMock() {
  const makeRequest = <T>(
    result: T,
    error: DOMException | null = null
  ): IDBRequest<T> => {
    const req = {
      result,
      error,
      onsuccess: null as ((this: IDBRequest<T>, ev: Event) => void) | null,
      onerror: null as ((this: IDBRequest<T>, ev: Event) => void) | null,
    } as unknown as IDBRequest<T>;
    // Resolve asynchronously
    Promise.resolve().then(() => {
      if (error && req.onerror) {
        req.onerror.call(req, new Event('error'));
      } else if (req.onsuccess) {
        req.onsuccess.call(req, new Event('success'));
      }
    });
    return req;
  };

  const makeObjectStore = () => ({
    put: vi.fn((value: unknown, key: IDBValidKey) => {
      idbStore.set(key, value);
      return makeRequest<undefined>(undefined);
    }),
    get: vi.fn((key: IDBValidKey) => makeRequest<unknown>(idbStore.get(key))),
  });

  const mockStore = makeObjectStore();

  const makeTx = (): IDBTransaction => {
    const tx = {
      objectStore: vi.fn(() => mockStore),
    } as unknown as IDBTransaction;
    // Simulate oncomplete being fired asynchronously
    Object.defineProperty(tx, 'oncomplete', {
      set(cb: (() => void) | null) {
        if (typeof cb === 'function') {
          Promise.resolve().then(cb);
        }
      },
      get() {
        return null;
      },
      configurable: true,
    });
    Object.defineProperty(tx, 'onerror', {
      set(_cb: unknown) {},
      get() {
        return null;
      },
      configurable: true,
    });
    return tx;
  };

  const makeDb = () =>
    ({
      transaction: vi.fn(() => makeTx()),
      createObjectStore: vi.fn(() => mockStore),
      objectStoreNames: { contains: vi.fn(() => false) },
    }) as unknown as IDBDatabase;

  const makeOpenRequest = (): IDBOpenDBRequest => {
    const req = {
      result: makeDb(),
      error: null,
      onupgradeneeded: null as
        | ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => void)
        | null,
      onsuccess: null as
        | ((this: IDBRequest<IDBDatabase>, ev: Event) => void)
        | null,
      onerror: null as
        | ((this: IDBRequest<IDBDatabase>, ev: Event) => void)
        | null,
    } as unknown as IDBOpenDBRequest;

    Promise.resolve().then(() => {
      if (req.onupgradeneeded) {
        req.onupgradeneeded.call(
          req,
          new Event('upgradeneeded') as IDBVersionChangeEvent
        );
      }
      if (req.onsuccess) {
        req.onsuccess.call(req, new Event('success'));
      }
    });
    return req;
  };

  return { open: vi.fn(() => makeOpenRequest()) };
}

const idbMock = buildIdbMock();
vi.stubGlobal('indexedDB', idbMock);

// Must import AFTER mocking globals
import {
  generateEncryptionKey,
  getEncryptionKey,
  encryptData,
  decryptData,
} from '../StorageEncryption';

// ── Helpers ────────────────────────────────────────────────────────

/** Reset the module-level encryptionKey singleton between tests. */
async function resetEncryptionKeyState() {
  // Clear localStorage so getEncryptionKey generates fresh keys
  localStorage.clear();
  // Re-import won't reset the module-level `let encryptionKey` variable,
  // so we call getEncryptionKey after clearing localStorage.
  // The module caches the key; we must force a fresh key by using
  // a direct vi.resetModules approach — but that complicates the suite.
  // Instead we accept that getEncryptionKey may reuse a cached key within
  // a single test file and test key generation/import separately.
}

// ── Tests ──────────────────────────────────────────────────────────

describe('StorageEncryption', () => {
  beforeEach(() => {
    localStorage.clear();
    idbStore.clear();
    vi.clearAllMocks();
    // Rebuild the IDB mock fresh for each test so calls reset
    const fresh = buildIdbMock();
    vi.stubGlobal('indexedDB', fresh);
  });

  // ── Key generation ────────────────────────────────────────────

  describe('generateEncryptionKey', () => {
    it('generates a non-extractable CryptoKey', async () => {
      const key = await generateEncryptionKey();
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      // C-OLD-2 fix: key must be non-extractable
      expect(subtleMock.generateKey).toHaveBeenCalledWith(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    });

    it('throws a handled error when generation fails', async () => {
      subtleMock.generateKey.mockRejectedValueOnce(new Error('mock failure'));
      await expect(generateEncryptionKey()).rejects.toThrow();
    });
  });

  // ── getEncryptionKey ──────────────────────────────────────────
  // Note: exportEncryptionKey / importEncryptionKey are removed.
  // Keys are now stored as native CryptoKey objects in IndexedDB
  // (non-extractable) — raw key bytes never leave the engine.

  describe('getEncryptionKey', () => {
    it('returns a CryptoKey on first call', async () => {
      const key = await getEncryptionKey();
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      // Key material must NOT appear in localStorage
      expect(localStorage.getItem('dndev:encryptionKey')).toBeNull();
    });
  });

  // ── Encrypt / Decrypt roundtrip ───────────────────────────────

  describe('encryptData / decryptData', () => {
    it('roundtrips a plain string', async () => {
      const input = 'hello world';
      const encrypted = await encryptData(input);
      expect(typeof encrypted).toBe('string');
      // Encrypted output must differ from plaintext
      expect(encrypted).not.toBe(input);

      const decrypted = await decryptData(encrypted);
      expect(decrypted).toBe(input);
    });

    it('roundtrips an object', async () => {
      const input = { name: 'test', count: 42, nested: { ok: true } };
      const encrypted = await encryptData(input);
      const decrypted = await decryptData(encrypted);
      expect(decrypted).toEqual(input);
    });

    it('roundtrips an array', async () => {
      const input = [1, 'two', { three: 3 }];
      const encrypted = await encryptData(input);
      const decrypted = await decryptData(encrypted);
      expect(decrypted).toEqual(input);
    });

    it('roundtrips a number (serialized via JSON)', async () => {
      const input = 12345;
      const encrypted = await encryptData(input);
      const decrypted = await decryptData(encrypted);
      expect(decrypted).toBe(input);
    });

    it('roundtrips a boolean', async () => {
      const encrypted = await encryptData(true);
      const decrypted = await decryptData(encrypted);
      expect(decrypted).toBe(true);
    });

    it('roundtrips a JSON-serializable object (null value in object)', async () => {
      // null is not a valid top-level value for encryptData (not string|object|number|boolean)
      // Wrap it in an object to test null handling through JSON serialization
      const input = { value: null as null };
      const encrypted = await encryptData(input);
      const decrypted = await decryptData(encrypted);
      expect(decrypted).toEqual(input);
    });

    it('roundtrips an empty string', async () => {
      const encrypted = await encryptData('');
      const decrypted = await decryptData(encrypted);
      expect(decrypted).toBe('');
    });

    it('handles special characters (unicode, emoji, RTL)', async () => {
      const input =
        'Hello \u00e9\u00e0\u00fc \u4e16\u754c \ud83d\ude80 \u0645\u0631\u062d\u0628\u0627';
      const encrypted = await encryptData(input);
      const decrypted = await decryptData(encrypted);
      expect(decrypted).toBe(input);
    });

    it('handles a large payload', async () => {
      const input = 'x'.repeat(100_000);
      const encrypted = await encryptData(input);
      const decrypted = await decryptData(encrypted);
      expect(decrypted).toBe(input);
    });

    it('produces different ciphertext for the same plaintext (unique IV)', async () => {
      const input = 'deterministic?';
      const a = await encryptData(input);
      const b = await encryptData(input);
      expect(a).not.toBe(b);
    });
  });

  // ── Failure modes ─────────────────────────────────────────────

  describe('error handling', () => {
    it('throws on corrupted ciphertext', async () => {
      const encrypted = await encryptData('valid data');
      // Corrupt the middle of the base64 payload
      const corrupted = encrypted.slice(0, 20) + 'XXXX' + encrypted.slice(24);
      await expect(decryptData(corrupted)).rejects.toThrow();
    });

    it('throws on completely invalid base64', async () => {
      await expect(decryptData('not-valid-base64!!!')).rejects.toThrow();
    });

    it('throws on empty string input to decrypt', async () => {
      await expect(decryptData('')).rejects.toThrow();
    });

    it('throws on truncated ciphertext (too short for IV)', async () => {
      // Less than 12 bytes after base64 decode
      const tooShort = btoa('short');
      await expect(decryptData(tooShort)).rejects.toThrow();
    });

    it('throws when encrypt fails internally', async () => {
      subtleMock.encrypt.mockRejectedValueOnce(new Error('encrypt boom'));
      await expect(encryptData('data')).rejects.toThrow();
    });

    it('throws when decrypt fails internally', async () => {
      const encrypted = await encryptData('data');
      subtleMock.decrypt.mockRejectedValueOnce(new Error('decrypt boom'));
      await expect(decryptData(encrypted)).rejects.toThrow();
    });
  });
});
