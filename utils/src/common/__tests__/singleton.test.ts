import { describe, it, expect, beforeEach } from 'vitest';

import {
  createSingleton,
  createSingletonWithParams,
  createAsyncSingleton,
  SingletonManager,
} from '../singleton';

describe('createSingleton', () => {
  it('creates singleton from factory function', () => {
    let callCount = 0;
    const getInstance = createSingleton(() => {
      callCount++;
      return { value: 'test' };
    });

    const a = getInstance();
    const b = getInstance();

    expect(a).toBe(b);
    expect(callCount).toBe(1);
  });

  it('creates singleton from class constructor', () => {
    class MyService {
      value = 42;
    }

    const getInstance = createSingleton(MyService);

    const a = getInstance();
    const b = getInstance();

    expect(a).toBe(b);
    expect(a.value).toBe(42);
  });

  it('passes constructor args', () => {
    class MyService {
      constructor(public name: string) {}
    }

    const getInstance = createSingleton(MyService, 'test');

    expect(getInstance().name).toBe('test');
  });
});

describe('createSingletonWithParams', () => {
  it('creates singleton with deferred params', () => {
    class Service {
      constructor(public config: string) {}
    }

    const getInstance = createSingletonWithParams(Service);

    const a = getInstance('config-a');
    const b = getInstance('config-b'); // ignored — already created

    expect(a).toBe(b);
    expect(a.config).toBe('config-a');
  });
});

describe('createAsyncSingleton', () => {
  it('creates async singleton', async () => {
    let callCount = 0;
    const getInstance = createAsyncSingleton(async () => {
      callCount++;
      return { value: 'async' };
    });

    const a = await getInstance();
    const b = await getInstance();

    expect(a).toBe(b);
    expect(callCount).toBe(1);
  });

  it('deduplicates concurrent calls', async () => {
    let callCount = 0;
    const getInstance = createAsyncSingleton(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 10));
      return { value: 'concurrent' };
    });

    const [a, b] = await Promise.all([getInstance(), getInstance()]);

    expect(a).toBe(b);
    expect(callCount).toBe(1);
  });
});

describe('SingletonManager', () => {
  beforeEach(() => {
    SingletonManager.clearAll();
  });

  it('creates and returns singleton', async () => {
    const result = await SingletonManager.getOrCreate('test', () => ({
      value: 1,
    }));

    expect(result.value).toBe(1);
    expect(SingletonManager.isInitialized('test')).toBe(true);
  });

  it('returns same instance on subsequent calls', async () => {
    let callCount = 0;
    const factory = () => ({ count: ++callCount });

    const a = await SingletonManager.getOrCreate('counter', factory);
    const b = await SingletonManager.getOrCreate('counter', factory);

    expect(a).toBe(b);
    expect(callCount).toBe(1);
  });

  it('clear removes a specific singleton', async () => {
    await SingletonManager.getOrCreate('a', () => 'a');
    await SingletonManager.getOrCreate('b', () => 'b');

    SingletonManager.clear('a');

    expect(SingletonManager.isInitialized('a')).toBe(false);
    expect(SingletonManager.isInitialized('b')).toBe(true);
  });

  it('clearAll removes all singletons', async () => {
    await SingletonManager.getOrCreate('a', () => 'a');
    await SingletonManager.getOrCreate('b', () => 'b');

    SingletonManager.clearAll();

    expect(SingletonManager.isInitialized('a')).toBe(false);
    expect(SingletonManager.isInitialized('b')).toBe(false);
  });

  it('uses fallback factory on error', async () => {
    const result = await SingletonManager.getOrCreate(
      'fail-test',
      () => {
        throw new Error('boom');
      },
      { fallbackFactory: () => 'fallback' }
    );

    expect(result).toBe('fallback');
  });
});
