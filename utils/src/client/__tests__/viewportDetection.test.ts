import { describe, it, expect } from 'vitest';

import { ViewportHandler, createViewportHandler } from '../viewportDetection';

describe('ViewportHandler', () => {
  it('creates instance with default options', () => {
    const handler = new ViewportHandler();
    expect(handler).toBeDefined();
  });

  it('creates instance with custom options', () => {
    const handler = new ViewportHandler({
      threshold: 0.5,
      rootMargin: '100px',
      once: true,
      trackItems: false,
    });
    expect(handler).toBeDefined();
  });

  it('handleIntersection returns result object', () => {
    const handler = new ViewportHandler();

    const entry = {
      isIntersecting: true,
      intersectionRatio: 0.5,
      boundingClientRect: {} as DOMRect,
      intersectionRect: {} as DOMRect,
      rootBounds: null,
      target: document.createElement('div'),
      time: 0,
    } as IntersectionObserverEntry;

    const result = handler.handleIntersection(entry);
    expect(result.isVisible).toBe(true);
    expect(result.hasTriggered).toBe(true);
    expect(result.visibleItems).toBeInstanceOf(Set);
  });

  it('hasTriggered stays true after first intersection', () => {
    const handler = new ViewportHandler({ trackItems: false });

    const visibleEntry = {
      isIntersecting: true,
    } as IntersectionObserverEntry;

    const hiddenEntry = {
      isIntersecting: false,
    } as IntersectionObserverEntry;

    handler.handleIntersection(visibleEntry);
    const result = handler.handleIntersection(hiddenEntry);

    expect(result.hasTriggered).toBe(true);
    expect(result.isVisible).toBe(false);
  });
});

describe('createViewportHandler', () => {
  it('returns a ViewportHandler instance', () => {
    const handler = createViewportHandler();
    expect(handler).toBeInstanceOf(ViewportHandler);
  });

  it('accepts options', () => {
    const handler = createViewportHandler({ threshold: 0.8 });
    expect(handler).toBeInstanceOf(ViewportHandler);
  });
});
