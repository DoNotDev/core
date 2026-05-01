import { describe, it, expect, vi, beforeEach } from 'vitest';

import { EventEmitter } from '../eventEmitter';

describe('EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('on / emit', () => {
    it('calls handler when event is emitted', () => {
      const handler = vi.fn();
      emitter.on('test', handler);
      emitter.emit('test', 'data');

      expect(handler).toHaveBeenCalledWith('data');
    });

    it('calls multiple handlers', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      emitter.on('test', h1);
      emitter.on('test', h2);
      emitter.emit('test');

      expect(h1).toHaveBeenCalled();
      expect(h2).toHaveBeenCalled();
    });

    it('passes multiple arguments', () => {
      const handler = vi.fn();
      emitter.on('test', handler);
      emitter.emit('test', 'a', 'b', 'c');

      expect(handler).toHaveBeenCalledWith('a', 'b', 'c');
    });

    it('returns true when handlers exist', () => {
      emitter.on('test', () => {});
      expect(emitter.emit('test')).toBe(true);
    });

    it('returns false when no handlers exist', () => {
      expect(emitter.emit('test')).toBe(false);
    });
  });

  describe('off', () => {
    it('removes specific handler', () => {
      const handler = vi.fn();
      emitter.on('test', handler);
      emitter.off('test', handler);
      emitter.emit('test');

      expect(handler).not.toHaveBeenCalled();
    });

    it('returns true when handler found', () => {
      const handler = vi.fn();
      emitter.on('test', handler);

      expect(emitter.off('test', handler)).toBe(true);
    });

    it('returns false when handler not found', () => {
      expect(emitter.off('test', () => {})).toBe(false);
    });
  });

  describe('unsubscribe function', () => {
    it('on returns unsubscribe function', () => {
      const handler = vi.fn();
      const unsub = emitter.on('test', handler);

      unsub();
      emitter.emit('test');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('once', () => {
    it('fires handler only once', () => {
      const handler = vi.fn();
      emitter.once('test', handler);

      emitter.emit('test', 'first');
      emitter.emit('test', 'second');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('first');
    });

    it('returns unsubscribe function', () => {
      const handler = vi.fn();
      const unsub = emitter.once('test', handler);

      unsub();
      emitter.emit('test');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('hasListeners / listenerCount', () => {
    it('hasListeners returns false when no listeners', () => {
      expect(emitter.hasListeners('test')).toBe(false);
    });

    it('hasListeners returns true when listeners exist', () => {
      emitter.on('test', () => {});
      expect(emitter.hasListeners('test')).toBe(true);
    });

    it('listenerCount returns correct count', () => {
      emitter.on('test', () => {});
      emitter.on('test', () => {});

      expect(emitter.listenerCount('test')).toBe(2);
    });

    it('listenerCount returns 0 for unknown event', () => {
      expect(emitter.listenerCount('unknown')).toBe(0);
    });
  });

  describe('eventNames', () => {
    it('returns empty array when no events', () => {
      expect(emitter.eventNames()).toEqual([]);
    });

    it('returns all registered event names', () => {
      emitter.on('a', () => {});
      emitter.on('b', () => {});

      expect(emitter.eventNames()).toContain('a');
      expect(emitter.eventNames()).toContain('b');
    });
  });

  describe('removeAllListeners', () => {
    it('removes all listeners for specific event', () => {
      emitter.on('a', () => {});
      emitter.on('b', () => {});

      emitter.removeAllListeners('a');

      expect(emitter.hasListeners('a')).toBe(false);
      expect(emitter.hasListeners('b')).toBe(true);
    });

    it('removes all listeners when no event specified', () => {
      emitter.on('a', () => {});
      emitter.on('b', () => {});

      emitter.removeAllListeners();

      expect(emitter.eventNames()).toEqual([]);
    });
  });

  describe('maxListeners', () => {
    it('warns when exceeding max listeners', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      emitter.setMaxListeners(2);

      emitter.on('test', () => {});
      emitter.on('test', () => {});
      emitter.on('test', () => {});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeds the max'),
        expect.any(String)
      );
    });

    it('getMaxListeners returns set value', () => {
      emitter.setMaxListeners(5);
      expect(emitter.getMaxListeners()).toBe(5);
    });

    it('setMaxListeners returns this for chaining', () => {
      const result = emitter.setMaxListeners(5);
      expect(result).toBe(emitter);
    });
  });

  describe('context binding', () => {
    it('binds handler to context', () => {
      const ctx = { name: 'test' };
      let capturedThis: any;

      emitter.on(
        'test',
        function (this: any) {
          capturedThis = this;
        },
        ctx
      );
      emitter.emit('test');

      expect(capturedThis).toBe(ctx);
    });
  });

  describe('error isolation', () => {
    it('continues calling handlers after one throws', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const h1 = vi.fn(() => {
        throw new Error('handler error');
      });
      const h2 = vi.fn();

      emitter.on('test', h1);
      emitter.on('test', h2);
      emitter.emit('test');

      expect(h2).toHaveBeenCalled();
    });
  });

  describe('event caching', () => {
    it('caches emitted events', () => {
      emitter.emit('test', 'cached-data');

      const cached = emitter.getCachedEvents('test');
      expect(cached.length).toBe(1);
      expect(cached[0]).toEqual(['cached-data']);
    });

    it('returns empty array for uncached events', () => {
      expect(emitter.getCachedEvents('unknown')).toEqual([]);
    });

    it('clearCachedEvents removes cache for event', () => {
      emitter.emit('test', 'data');
      emitter.clearCachedEvents('test');

      expect(emitter.getCachedEvents('test')).toEqual([]);
    });

    it('clearAllCachedEvents removes all caches', () => {
      emitter.emit('a', 'data-a');
      emitter.emit('b', 'data-b');
      emitter.clearAllCachedEvents();

      expect(emitter.getCachedEvents('a')).toEqual([]);
      expect(emitter.getCachedEvents('b')).toEqual([]);
    });

    it('getCacheStats returns statistics', () => {
      emitter.emit('test', 'data');

      const stats = emitter.getCacheStats();
      expect(stats.totalEvents).toBe(1);
      expect(stats.eventTypes).toBe(1);
      expect(stats.oldestEvent).toBeGreaterThan(0);
      expect(stats.newestEvent).toBeGreaterThan(0);
    });
  });

  describe('handler validation', () => {
    it('throws TypeError for non-function handler on on()', () => {
      expect(() => emitter.on('test', 'not a fn' as any)).toThrow(TypeError);
    });

    it('throws TypeError for non-function handler on once()', () => {
      expect(() => emitter.once('test', null as any)).toThrow(TypeError);
    });
  });
});
