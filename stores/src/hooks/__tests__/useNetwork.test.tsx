import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNetworkStore } from '../../templates/networkStore';
import {
  useNetwork,
  useNetworkConnectionType,
  useNetworkOnline,
  useNetworkStatus,
} from '../useNetwork';

const originalState = useNetworkStore.getState();

function useNetworkSelectors() {
  return {
    network: useNetwork(),
    status: useNetworkStatus(),
    online: useNetworkOnline(),
    connectionType: useNetworkConnectionType(),
  };
}

function NetworkProbe() {
  const { network, status, online, connectionType } = useNetworkSelectors();
  return <span>{JSON.stringify({ network, status, online, connectionType })}</span>;
}

describe('useNetwork snapshots', () => {
  beforeEach(() => {
    useNetworkStore.setState(useNetworkStore.getInitialState(), true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    useNetworkStore.setState(originalState, true);
    const errors = vi.mocked(console.error).mock.calls;
    vi.restoreAllMocks();
    vi.useRealTimers();
    expect(errors).toEqual([]);
  });

  it('mounts in StrictMode without a snapshot loop and ignores unrelated state updates', () => {
    const render = vi.fn(() => useNetwork());
    const { result, rerender } = renderHook(render, { wrapper: StrictMode });
    const initial = result.current;
    const renders = render.mock.calls.length;

    act(() => useNetworkStore.getState().setLoading(true));
    expect(render).toHaveBeenCalledTimes(renders);
    expect(result.current).toBe(initial);

    rerender();
    expect(result.current).toEqual(initial);
    expect(result.current.status).toBe(useNetworkStore.getState().status);
    expect(result.current.reset).toBe(useNetworkStore.getState().reset);
  });

  it('reacts to status, online, connection loss and reconnection through the real store', () => {
    const { result } = renderHook(useNetworkSelectors);
    const status = {
      online: false,
      connectionType: 'cellular' as const,
      effectiveType: '3g',
      lastChecked: new Date('2026-01-01T00:00:00.000Z'),
    };

    act(() => useNetworkStore.getState().setStatus(status));
    expect(result.current.network).toEqual({
      status,
      isOnline: false,
      isReconnected: false,
      isConnectionLost: false,
      connectionType: 'cellular',
      effectiveType: '3g',
      lastChecked: status.lastChecked,
      reset: useNetworkStore.getState().reset,
    });
    expect(result.current.status).toBe(status);
    expect(result.current.online).toBe(false);
    expect(result.current.connectionType).toBe('cellular');

    act(() => useNetworkStore.getState().setConnectionLost());
    expect(result.current.network.isConnectionLost).toBe(true);
    expect(result.current.network.isReconnected).toBe(false);

    act(() => useNetworkStore.getState().setReconnected());
    expect(result.current.network.isReconnected).toBe(true);
    expect(result.current.network.isConnectionLost).toBe(false);

    const onlineStatus = { ...status, online: true, effectiveType: '4g' };
    act(() => useNetworkStore.getState().setStatus(onlineStatus));
    expect(result.current.network.status).toBe(onlineStatus);
    expect(result.current.network.isOnline).toBe(true);
    expect(result.current.network.effectiveType).toBe('4g');
    expect(result.current.online).toBe(true);
  });

  it('returns the same reset action and preserves its navigator and date behavior', () => {
    vi.useFakeTimers();
    const now = new Date('2026-02-01T00:00:00.000Z');
    vi.setSystemTime(now);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const reset = useNetworkStore.getState().reset;
    const { result } = renderHook(useNetwork);

    act(() => {
      useNetworkStore.getState().setStatus({
        online: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        lastChecked: new Date(0),
      });
      useNetworkStore.getState().setReconnected();
    });
    expect(result.current.reset).toBe(reset);

    act(() => result.current.reset());
    expect(result.current.reset).toBe(reset);
    expect(result.current.status).toEqual({
      online: false,
      connectionType: 'unknown',
      effectiveType: 'unknown',
      lastChecked: now,
    });
    expect(result.current.status).toBe(useNetworkStore.getState().status);
    expect(result.current.isOnline).toBe(false);
    expect(result.current.isReconnected).toBe(false);
    expect(result.current.isConnectionLost).toBe(false);
  });

  it('renders and hydrates the existing initial snapshot without warnings or a loop', async () => {
    const before = useNetworkStore.getState();
    const container = document.createElement('div');
    container.innerHTML = renderToString(<NetworkProbe />);
    expect(container.textContent).toBe(JSON.stringify({
      network: {
        status: before.status,
        isOnline: before.status.online,
        isReconnected: before.isReconnected,
        isConnectionLost: before.isConnectionLost,
        connectionType: before.status.connectionType,
        effectiveType: before.status.effectiveType,
        lastChecked: before.status.lastChecked,
      },
      status: before.status,
      online: before.status.online,
      connectionType: before.status.connectionType,
    }));
    const html = container.innerHTML;
    const recoverableErrors: unknown[] = [];
    document.body.append(container);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <NetworkProbe />, {
          onRecoverableError: (error) => recoverableErrors.push(error),
        });
      });
      expect(container.innerHTML).toBe(html);
      expect(recoverableErrors).toEqual([]);
      expect(useNetworkStore.getState()).toBe(before);
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });
});
