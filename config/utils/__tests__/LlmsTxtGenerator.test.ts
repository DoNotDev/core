import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateLlmsTxt, generateLlmsFullTxt } from '../LlmsTxtGenerator.js';

// Mock PathResolver
const mockPathResolverPathExists = vi.fn(() => false);
const mockPathResolverReadSync = vi.fn(() => '');

vi.mock('../PathResolver.js', () => ({
  PathResolver: {
    getInstance: () => ({
      resolvePath: (rel: string, base: string) => `${base}/${rel}`,
      pathExists: mockPathResolverPathExists,
      readSync: mockPathResolverReadSync,
    }),
  },
}));

// Mock routeParser
vi.mock('../routeParser.js', () => ({
  parseRouteManifest: vi.fn(() => ({
    routes: [],
    errors: [],
    source: 'generated',
  })),
}));

import { parseRouteManifest } from '../routeParser.js';

describe('generateLlmsTxt', () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when siteName is missing', () => {
    const result = generateLlmsTxt({
      baseUrl: 'https://x.com',
      logger: mockLogger,
    });
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('returns null when baseUrl is missing', () => {
    const result = generateLlmsTxt({ siteName: 'Test', logger: mockLogger });
    expect(result).toBeNull();
  });

  it('generates header per spec', () => {
    const result = generateLlmsTxt({
      siteName: 'My App',
      baseUrl: 'https://myapp.com',
      logger: mockLogger,
    });

    expect(result).toContain('# My App');
  });

  it('includes description when provided', () => {
    const result = generateLlmsTxt({
      siteName: 'My App',
      baseUrl: 'https://myapp.com',
      description: 'The best app ever',
      logger: mockLogger,
    });

    expect(result).toContain('> The best app ever');
  });

  it('generates pages section from discovered routes', () => {
    vi.mocked(parseRouteManifest).mockReturnValue({
      routes: [
        {
          path: '/',
          meta: { title: 'Home', description: 'Welcome home' },
          auth: false,
        },
        { path: '/about', meta: { title: 'About' }, auth: false },
      ],
      errors: [],
      source: 'generated',
    });

    const result = generateLlmsTxt({
      siteName: 'My App',
      baseUrl: 'https://myapp.com',
      logger: mockLogger,
    });

    expect(result).toContain('## Pages');
    expect(result).toContain('- [Home](https://myapp.com/): Welcome home');
    expect(result).toContain('- [About](https://myapp.com/about)');
  });

  it('excludes auth-protected routes', () => {
    vi.mocked(parseRouteManifest).mockReturnValue({
      routes: [
        { path: '/', auth: false },
        { path: '/admin', auth: { required: true } },
      ],
      errors: [],
      source: 'generated',
    });

    const result = generateLlmsTxt({
      siteName: 'My App',
      baseUrl: 'https://myapp.com',
      logger: mockLogger,
    });

    expect(result).not.toContain('/admin');
  });

  it('generates blog section from provided posts', () => {
    vi.mocked(parseRouteManifest).mockReturnValue({
      routes: [],
      errors: [],
      source: 'generated',
    });

    const result = generateLlmsTxt({
      siteName: 'My App',
      baseUrl: 'https://myapp.com',
      blogPosts: [
        {
          slug: 'hello-world',
          title: 'Hello World',
          description: 'First post',
        },
        { slug: 'update', title: 'Update', description: '' },
      ],
      logger: mockLogger,
    });

    expect(result).toContain('## Blog');
    expect(result).toContain(
      '- [Hello World](https://myapp.com/blog/hello-world): First post'
    );
    expect(result).toContain('- [Update](https://myapp.com/blog/update)');
  });

  it('generates title from path when no meta.title', () => {
    vi.mocked(parseRouteManifest).mockReturnValue({
      routes: [{ path: '/contact-us', auth: false }],
      errors: [],
      source: 'generated',
    });

    const result = generateLlmsTxt({
      siteName: 'My App',
      baseUrl: 'https://myapp.com',
      logger: mockLogger,
    });

    expect(result).toContain('[Contact Us]');
  });

  it('formats root path as Home', () => {
    vi.mocked(parseRouteManifest).mockReturnValue({
      routes: [{ path: '/', auth: false }],
      errors: [],
      source: 'generated',
    });

    const result = generateLlmsTxt({
      siteName: 'My App',
      baseUrl: 'https://myapp.com',
      logger: mockLogger,
    });

    expect(result).toContain('[Home]');
  });

  it('handles no routes and no blog posts', () => {
    vi.mocked(parseRouteManifest).mockReturnValue({
      routes: [],
      errors: [],
      source: 'generated',
    });

    const result = generateLlmsTxt({
      siteName: 'My App',
      baseUrl: 'https://myapp.com',
      logger: mockLogger,
    });

    expect(result).toContain('# My App');
    expect(result).not.toContain('## Pages');
    expect(result).not.toContain('## Blog');
  });
});

describe('generateLlmsFullTxt', () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathResolverPathExists.mockReturnValue(false);
    mockPathResolverReadSync.mockReturnValue('');
  });

  it('returns null when siteName is missing', () => {
    const result = generateLlmsFullTxt({
      baseUrl: 'https://x.com',
      logger: mockLogger,
    });
    expect(result).toBeNull();
  });

  it('returns null when no blog posts', () => {
    const result = generateLlmsFullTxt({
      siteName: 'Test',
      baseUrl: 'https://x.com',
      blogPosts: [],
      logger: mockLogger,
    });
    expect(result).toBeNull();
  });

  it('returns null when blog directory does not exist', () => {
    mockPathResolverPathExists.mockReturnValue(false);

    const result = generateLlmsFullTxt({
      siteName: 'Test',
      baseUrl: 'https://x.com',
      appRoot: '/app',
      blogPosts: [
        { slug: 'test', title: 'Test', description: '', date: '2026-01-01' },
      ],
      logger: mockLogger,
    });
    expect(result).toBeNull();
  });

  it('generates full content from blog posts', () => {
    mockPathResolverPathExists.mockReturnValue(true);
    mockPathResolverReadSync.mockReturnValue(
      '---\ntitle: Hello World\ndate: 2026-01-01\n---\n\nThis is the full blog post content.\n\nWith multiple paragraphs.'
    );

    const result = generateLlmsFullTxt({
      siteName: 'My App',
      baseUrl: 'https://myapp.com',
      description: 'The best app',
      appRoot: '/app',
      blogPosts: [
        {
          slug: 'hello-world',
          title: 'Hello World',
          description: 'First post',
          date: '2026-01-01',
        },
      ],
      logger: mockLogger,
    });

    expect(result).toContain('# My App');
    expect(result).toContain('> The best app');
    expect(result).toContain('## Hello World');
    expect(result).toContain('Source: https://myapp.com/blog/hello-world');
    expect(result).toContain('Date: 2026-01-01');
    expect(result).toContain('This is the full blog post content.');
    expect(result).toContain('With multiple paragraphs.');
    // Frontmatter should be stripped
    expect(result).not.toContain('---');
  });
});
