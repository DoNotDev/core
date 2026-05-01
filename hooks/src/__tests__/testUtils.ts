// packages/core/hooks/src/__tests__/testUtils.ts
/**
 * Minimal renderHook + act for testing React hooks without @testing-library/react.
 * Uses React 19's built-in act and react-dom/client createRoot.
 */

import React from 'react';
import { act as reactAct } from 'react';
import ReactDOMClient from 'react-dom/client';

export { reactAct as act };

interface RenderHookResult<T> {
  result: { current: T };
  rerender: (newProps?: any) => void;
  unmount: () => void;
}

/**
 * Minimal renderHook implementation using React 19 APIs
 */
export function renderHook<T>(
  hook: (props?: any) => T,
  options?: { initialProps?: any }
): RenderHookResult<T> {
  const resultRef = { current: undefined as T };
  let rerender: (newProps?: any) => void;
  let unmount: () => void;

  function TestComponent({ hookProps }: { hookProps?: any }) {
    resultRef.current = hook(hookProps);
    return null;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: ReactDOMClient.Root;

  reactAct(() => {
    root = ReactDOMClient.createRoot(container);
    root.render(
      React.createElement(TestComponent, {
        hookProps: options?.initialProps,
      })
    );
  });

  rerender = (newProps?: any) => {
    reactAct(() => {
      root.render(React.createElement(TestComponent, { hookProps: newProps }));
    });
  };

  unmount = () => {
    reactAct(() => {
      root.unmount();
    });
    container.remove();
  };

  return { result: resultRef, rerender, unmount };
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  options?: { timeout?: number; interval?: number }
): Promise<void> {
  const timeout = options?.timeout ?? 1000;
  const interval = options?.interval ?? 50;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('waitFor timeout');
}
