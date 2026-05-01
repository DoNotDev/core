import { describe, it, expect, beforeEach } from 'vitest';

import { useAbortControllerStore } from '../abortControllerStore';

describe('useAbortControllerStore', () => {
  beforeEach(() => {
    // Clean up all controllers
    useAbortControllerStore.getState().abortAll();
  });

  it('initializes with empty controllers map', () => {
    const state = useAbortControllerStore.getState();
    expect(state.controllers).toBeInstanceOf(Map);
    expect(state.controllers.size).toBe(0);
  });

  it('createController creates and returns an AbortController', () => {
    const { createController } = useAbortControllerStore.getState();
    const controller = createController('test-request');

    expect(controller).toBeInstanceOf(AbortController);
    expect(controller.signal.aborted).toBe(false);
  });

  it('createController stores controller in map', () => {
    const { createController } = useAbortControllerStore.getState();
    createController('test-request');

    const { controllers } = useAbortControllerStore.getState();
    expect(controllers.has('test-request')).toBe(true);
  });

  it('createController aborts existing controller with same key', () => {
    const { createController } = useAbortControllerStore.getState();
    const first = createController('request');
    const second = createController('request');

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
  });

  it('abortController aborts and removes specific controller', () => {
    const { createController, abortController } =
      useAbortControllerStore.getState();
    const controller = createController('my-request');

    abortController('my-request');

    expect(controller.signal.aborted).toBe(true);
    expect(
      useAbortControllerStore.getState().controllers.has('my-request')
    ).toBe(false);
  });

  it('abortController is safe for non-existent keys', () => {
    const { abortController } = useAbortControllerStore.getState();
    // Should not throw
    abortController('non-existent');
  });

  it('abortAll aborts all controllers', () => {
    const { createController, abortAll } = useAbortControllerStore.getState();

    const c1 = createController('req-1');
    const c2 = createController('req-2');
    const c3 = createController('req-3');

    abortAll();

    expect(c1.signal.aborted).toBe(true);
    expect(c2.signal.aborted).toBe(true);
    expect(c3.signal.aborted).toBe(true);
    expect(useAbortControllerStore.getState().controllers.size).toBe(0);
  });
});
