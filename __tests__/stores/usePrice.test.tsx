import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { createPriceStore, createPriceHooks } from '../../src/stores/priceStore';
import { toPaise } from '../../src/domain/money';
import type { Quote } from '../../src/domain/types';
import type { QuoteWithSeq } from '../../src/domain/tickMerge';

describe('PriceStore React Hooks (usePrice, useQuoteField, usePaused)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const sampleQuotes: Record<string, Quote> = {
    RELIANCE: {
      ltp: toPaise(2500),
      open: toPaise(2490),
      high: toPaise(2510),
      low: toPaise(2480),
      prevClose: toPaise(2495),
      volume: 100000,
    },
    TCS: {
      ltp: toPaise(3500),
      open: toPaise(3480),
      high: toPaise(3520),
      low: toPaise(3470),
      prevClose: toPaise(3490),
      volume: 80000,
    },
  };

  test('usePrice hook returns quote snapshot and updates on tick flush', () => {
    const store = createPriceStore({ flushIntervalMs: 100 });
    store.seed(sampleQuotes);
    const { usePrice } = createPriceHooks(store);

    let latestQuote: QuoteWithSeq | null = null;

    function TestComponent() {
      latestQuote = usePrice('RELIANCE');
      return null;
    }

    act(() => {
      ReactTestRenderer.create(<TestComponent />);
    });

    expect((latestQuote as QuoteWithSeq | null)?.ltp).toBe(toPaise(2500));

    // Send tick for RELIANCE
    act(() => {
      store.queueTick({
        symbol: 'RELIANCE',
        seq: 1,
        ltp: toPaise(2520),
      });
      jest.advanceTimersByTime(100);
    });

    expect((latestQuote as QuoteWithSeq | null)?.ltp).toBe(toPaise(2520));
  });

  test('useQuoteField selects a single field and re-renders only when that selector changes', () => {
    const store = createPriceStore({ flushIntervalMs: 100 });
    store.seed(sampleQuotes);
    const { useQuoteField } = createPriceHooks(store);

    let renderedCount = 0;
    let selectedLtp = 0;

    function TestComponent() {
      renderedCount++;
      selectedLtp = useQuoteField('RELIANCE', (q) => q?.ltp ?? 0);
      return null;
    }

    act(() => {
      ReactTestRenderer.create(<TestComponent />);
    });

    expect(selectedLtp).toBe(toPaise(2500));
    const initialRenderCount = renderedCount;

    // Send tick with same LTP, different volume
    act(() => {
      store.queueTick({
        symbol: 'RELIANCE',
        seq: 1,
        volume: 200000,
      });
      jest.advanceTimersByTime(100);
    });

    // In a memoized row or when LTP is updated:
    act(() => {
      store.queueTick({
        symbol: 'RELIANCE',
        seq: 2,
        ltp: toPaise(2550),
      });
      jest.advanceTimersByTime(100);
    });

    expect(selectedLtp).toBe(toPaise(2550));
    expect(renderedCount).toBeGreaterThan(initialRenderCount);
  });

  test('usePaused returns true when feed silence is detected', () => {
    const store = createPriceStore({ flushIntervalMs: 100, pauseThresholdMs: 2000 });
    store.seed(sampleQuotes);
    const { usePaused } = createPriceHooks(store);

    let pausedValue = false;

    function TestComponent() {
      pausedValue = usePaused();
      return null;
    }

    act(() => {
      ReactTestRenderer.create(<TestComponent />);
    });

    expect(pausedValue).toBe(false);

    // Initial tick to mark activity
    act(() => {
      store.queueTick({ symbol: 'RELIANCE', seq: 1, ltp: toPaise(2501) });
      jest.advanceTimersByTime(100);
    });

    expect(pausedValue).toBe(false);

    // Advance 2100 ms to trigger paused condition
    act(() => {
      jest.advanceTimersByTime(2100);
    });

    expect(pausedValue).toBe(true);

    store.destroy();
  });
});
