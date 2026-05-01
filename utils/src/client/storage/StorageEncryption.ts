// packages/core/utils/src/client/storage/StorageEncryption.ts

/**
 * @fileoverview Storage encryption utilities
 * @description Utilities for encrypting and decrypting stored data
 *
 * This module provides secure encryption and decryption capabilities for
 * sensitive data stored in browser storage. It uses the Web Crypto API
 * with AES-GCM encryption for maximum security.
 *
 * **Key Features:**
 * - AES-GCM encryption with 256-bit keys
 * - Secure key generation and management
 * - Base64 encoding for storage compatibility
 * - Error handling with user-friendly messages
 * - Memory-safe key handling
 *
 * **Security Features:**
 * - Industry-standard AES-GCM encryption
 * - Secure key generation using Web Crypto API
 * - No hardcoded keys or weak encryption
 * - Proper key export/import for persistence
 * - Memory cleanup for sensitive data
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 *
 * **Usage Pattern:**
 * ```typescript
 * import { encryptData, decryptData } from '@donotdev/utils';
 *
 * // Encrypt sensitive data
 * const encrypted = await encryptData('sensitive data');
 *
 * // Decrypt data
 * const decrypted = await decryptData(encrypted);
 * ```
 *
 * **Browser Compatibility:**
 * - Requires Web Crypto API support
 * - Modern browsers only (Chrome 37+, Firefox 34+, Safari 7+)
 * - Graceful degradation for unsupported browsers
 */

import { handleError } from '../errors';

// Store encryption key in a way that isn't easily accessible
let encryptionKey: CryptoKey | null = null;

/** IndexedDB database name for key storage */
const KEY_DB_NAME = 'dndev-keys';
const KEY_STORE_NAME = 'encryption-keys';
const KEY_RECORD_ID = 'main';

/**
 * Open (or create) the IndexedDB store used for key persistence.
 */
async function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(KEY_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(KEY_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persist a non-extractable CryptoKey in IndexedDB.
 * IndexedDB is the only browser API that can store CryptoKey objects directly
 * without exporting the raw key material, so the key never leaves the engine.
 */
async function storeKeyInIdb(key: CryptoKey): Promise<void> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
    tx.objectStore(KEY_STORE_NAME).put(key, KEY_RECORD_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Load a CryptoKey from IndexedDB, or return null if none is stored.
 */
async function loadKeyFromIdb(): Promise<CryptoKey | null> {
  try {
    const db = await openKeyDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(KEY_STORE_NAME, 'readonly');
      const req = tx.objectStore(KEY_STORE_NAME).get(KEY_RECORD_ID);
      req.onsuccess = () => resolve((req.result as CryptoKey) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    // IndexedDB unavailable (e.g. private-browsing restrictions) — fall through
    return null;
  }
}

/**
 * Generate a secure, non-extractable encryption key.
 *
 * The key is marked `extractable: false` so the raw key material can never
 * be exported by JavaScript code, defeating the C-OLD-2 vulnerability.
 *
 * @returns Promise resolving to the generated key
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  try {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      false, // non-extractable — key material never leaves the engine
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    throw handleError(error, {
      userMessage: 'Failed to generate encryption key',
      context: { algorithm: 'AES-GCM' },
    });
  }
}

/**
 * Get or create the encryption key.
 *
 * Keys are stored in IndexedDB as native CryptoKey objects (not exported raw
 * bytes), so the key material is never written to localStorage or any
 * JavaScript-accessible string.
 *
 * @returns Promise resolving to the encryption key
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export async function getEncryptionKey(): Promise<CryptoKey> {
  // If we already have a key in memory, use it
  if (encryptionKey) {
    return encryptionKey;
  }

  try {
    // Try to load from IndexedDB (key is stored as a CryptoKey, never exported)
    const stored = await loadKeyFromIdb();
    if (stored) {
      encryptionKey = stored;
      return encryptionKey;
    }

    // Generate a new non-extractable key and persist it in IndexedDB
    encryptionKey = await generateEncryptionKey();
    await storeKeyInIdb(encryptionKey);

    return encryptionKey;
  } catch (error) {
    throw handleError(error, {
      userMessage: 'Failed to get or create encryption key',
    });
  }
}

/**
 * Encrypt data using AES-GCM
 * @param data Data to encrypt (will be JSON stringified)
 * @returns Promise resolving to encrypted string (base64)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export async function encryptData(
  data: string | object | number | boolean
): Promise<string> {
  try {
    const key = await getEncryptionKey();

    // Generate a random IV for each encryption
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Convert data to string
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);

    // Convert string to ArrayBuffer
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(dataString);

    // Encrypt the data
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      dataBuffer
    );

    // Combine IV and encrypted data
    const result = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encryptedBuffer), iv.length);

    // Convert to base64 string
    return btoa(String.fromCharCode(...result));
  } catch (error) {
    throw handleError(error, {
      userMessage: 'Failed to encrypt data',
    });
  }
}

/**
 * Decrypt data using AES-GCM
 * @param encryptedData Encrypted string (base64)
 * @returns Promise resolving to decrypted data (parsed from JSON)
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export async function decryptData(
  encryptedData: string
): Promise<string | object | number | boolean | null> {
  try {
    const key = await getEncryptionKey();

    // Convert base64 to Uint8Array
    const data = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = data.slice(0, 12);
    const encryptedBuffer = data.slice(12);

    // Decrypt the data
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encryptedBuffer
    );

    // Convert ArrayBuffer to string
    const decoder = new TextDecoder();
    const decryptedString = decoder.decode(decryptedBuffer);

    // Parse JSON or return the string
    try {
      return JSON.parse(decryptedString);
    } catch (e) {
      return decryptedString;
    }
  } catch (error) {
    throw handleError(error, {
      userMessage: 'Failed to decrypt data',
    });
  }
}
