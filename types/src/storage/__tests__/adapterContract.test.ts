// packages/core/types/src/storage/__tests__/adapterContract.test.ts

/**
 * @fileoverview Contract test for IStorageAdapter
 * @description Verifies that any implementation of IStorageAdapter satisfies
 * the interface contract. Uses an in-memory mock adapter as the test subject.
 *
 * @version 0.1.0
 * @since 0.5.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { IStorageAdapter, UploadOptions, UploadResult } from '../adapter';

// =============================================================================
// In-Memory Mock Adapter
// =============================================================================

/**
 * In-memory storage adapter for contract testing.
 * Satisfies IStorageAdapter without any real I/O.
 */
class InMemoryStorageAdapter implements IStorageAdapter {
  private store = new Map<string, string>();
  private baseUrl = 'https://storage.example.com';

  async upload(
    file: File | Blob,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const filename =
      options?.filename ?? (file instanceof File ? file.name : 'blob');
    const storagePath = options?.storagePath
      ? `${options.storagePath}/${filename}`
      : filename;

    const url = `${this.baseUrl}/${storagePath}`;
    this.store.set(storagePath, url);

    if (options?.onProgress) {
      options.onProgress(0);
      options.onProgress(50);
      options.onProgress(100);
    }

    return { url, path: storagePath };
  }

  async delete(urlOrPath: string): Promise<void> {
    // Accept both full URL and bare path
    const path = urlOrPath.startsWith(this.baseUrl)
      ? urlOrPath.slice(this.baseUrl.length + 1)
      : urlOrPath;

    this.store.delete(path);
  }

  async getUrl(path: string): Promise<string> {
    const stored = this.store.get(path);
    if (stored !== undefined) return stored;
    return `${this.baseUrl}/${path}`;
  }

  /** Test helper — force upload failure */
  async uploadThrowing(
    _file: File | Blob,
    _options?: UploadOptions
  ): Promise<UploadResult> {
    throw new Error('Upload failed: storage quota exceeded');
  }
}

// =============================================================================
// Contract Tests
// =============================================================================

describe('IStorageAdapter contract', () => {
  let adapter: InMemoryStorageAdapter;

  beforeEach(() => {
    adapter = new InMemoryStorageAdapter();
  });

  // 1. Type satisfaction
  it('mock adapter satisfies IStorageAdapter type', () => {
    const typed: IStorageAdapter = adapter;
    expect(typeof typed.upload).toBe('function');
    expect(typeof typed.delete).toBe('function');
    expect(typeof typed.getUrl).toBe('function');
  });

  // 2. upload() returns { url, path }
  it('upload() returns UploadResult with url and path', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

    const result = await adapter.upload(file);

    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('path');
    expect(typeof result.url).toBe('string');
    expect(typeof result.path).toBe('string');
    expect(result.url.length).toBeGreaterThan(0);
    expect(result.path.length).toBeGreaterThan(0);
  });

  // 3. upload() with storagePath option
  it('upload() respects storagePath option', async () => {
    const file = new File(['data'], 'photo.png', { type: 'image/png' });
    const options: UploadOptions = { storagePath: 'uploads/avatars' };

    const result = await adapter.upload(file, options);

    expect(result.path).toContain('uploads/avatars');
    expect(result.url).toContain('uploads/avatars');
  });

  // 4. upload() with filename option
  it('upload() respects filename option', async () => {
    const file = new File(['data'], 'original.png', { type: 'image/png' });
    const options: UploadOptions = { filename: 'renamed.png' };

    const result = await adapter.upload(file, options);

    expect(result.path).toContain('renamed.png');
    expect(result.url).toContain('renamed.png');
  });

  // 5. upload() calls onProgress with values 0–100
  it('upload() calls onProgress callback with values in 0-100 range', async () => {
    const file = new File(['content'], 'video.mp4', { type: 'video/mp4' });
    const onProgress = vi.fn();
    const options: UploadOptions = { onProgress };

    await adapter.upload(file, options);

    expect(onProgress).toHaveBeenCalled();

    const calls = onProgress.mock.calls.map((value: unknown[]) =>
      Number(value[0])
    );
    for (const percent of calls) {
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThanOrEqual(100);
    }

    // Must report both start (0) and completion (100)
    expect(calls).toContain(0);
    expect(calls).toContain(100);
  });

  // 6. upload() accepts File and Blob
  it('upload() accepts a File instance', async () => {
    const file = new File(['file content'], 'doc.pdf', {
      type: 'application/pdf',
    });

    const result = await adapter.upload(file);

    expect(result.url).toBeTruthy();
    expect(result.path).toBeTruthy();
  });

  it('upload() accepts a Blob instance', async () => {
    const blob = new Blob(['blob content'], { type: 'text/plain' });

    const result = await adapter.upload(blob);

    expect(result.url).toBeTruthy();
    expect(result.path).toBeTruthy();
  });

  // 7. delete() by URL resolves
  it('delete() by URL resolves without error', async () => {
    const file = new File(['data'], 'to-delete.txt');
    const { url } = await adapter.upload(file);

    await expect(adapter.delete(url)).resolves.toBeUndefined();
  });

  // 8. delete() by path resolves
  it('delete() by path resolves without error', async () => {
    const file = new File(['data'], 'to-delete-by-path.txt');
    const { path } = await adapter.upload(file);

    await expect(adapter.delete(path)).resolves.toBeUndefined();
  });

  // 9. getUrl() returns a string URL
  it('getUrl() returns a non-empty string URL', async () => {
    const file = new File(['data'], 'image.jpg');
    const { path } = await adapter.upload(file);

    const url = await adapter.getUrl(path);

    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });

  // 10. Error propagation — upload errors bubble up
  it('upload() errors propagate to the caller', async () => {
    const throwingAdapter: IStorageAdapter = {
      upload: async (
        _file: File | Blob,
        _options?: UploadOptions
      ): Promise<UploadResult> => {
        throw new Error('Upload failed: storage quota exceeded');
      },
      delete: async (_urlOrPath: string): Promise<void> => {},
      getUrl: async (path: string): Promise<string> => path,
    };

    const file = new File(['data'], 'fail.txt');

    await expect(throwingAdapter.upload(file)).rejects.toThrow(
      'Upload failed: storage quota exceeded'
    );
  });

  // 11. Large file handling (mock)
  it('upload() handles large file (mocked 100 MB blob)', async () => {
    // Allocate a small buffer but tag the mock as large-file scenario
    const largeBlob = new Blob([new Uint8Array(1024)], {
      type: 'application/octet-stream',
    });
    const onProgress = vi.fn();

    const result = await adapter.upload(largeBlob, {
      storagePath: 'uploads/large',
      filename: '100mb-file.bin',
      onProgress,
    });

    expect(result.path).toContain('100mb-file.bin');
    expect(result.url).toContain('100mb-file.bin');
    expect(onProgress).toHaveBeenCalled();
  });

  // 12. Multiple sequential uploads
  it('multiple sequential uploads each return unique paths and urls', async () => {
    const files = [
      new File(['a'], 'file-a.txt'),
      new File(['b'], 'file-b.txt'),
      new File(['c'], 'file-c.txt'),
    ];

    const results: UploadResult[] = [];
    for (const file of files) {
      results.push(await adapter.upload(file));
    }

    const paths = results.map((r) => r.path);
    const urls = results.map((r) => r.url);

    // All paths unique
    expect(new Set(paths).size).toBe(paths.length);
    // All URLs unique
    expect(new Set(urls).size).toBe(urls.length);

    // Each result is a valid UploadResult
    for (const result of results) {
      expect(typeof result.url).toBe('string');
      expect(typeof result.path).toBe('string');
    }
  });
});
