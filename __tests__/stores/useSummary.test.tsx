import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { createSummaryStore, createSummaryHook } from '../../src/stores/summaryStore';
import { createPriceStore } from '../../src/stores/priceStore';
import { createPortfolioStore } from '../../src/stores/portfolioStore';
import type { Holding, Quote } from '../../src/domain/types';

describe('useSummary hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const sampleHoldings: Holding[] = [
    { symbol: 'RELIANCE', qty: 10, avgPaise: 250000 },
    { symbol: 'OLDCO', qty: 100, avgPaise: 12375 },
  ];

  const sampleQuotes: Record<string, Quote> = {
    RELIANCE: {
      ltp: 260000,
      open: 255000,
      prevClose: 250000,
      high: 262000,
      low: 249000,
      volume: 100000,
    },
  };

  test('subscribes and updates reactively when throttled summary fires', () => {
    const priceStore = createPriceStore({ flushIntervalMs: 50 });
    priceStore.seed(sampleQuotes);

    const portfolioStore = createPortfolioStore({
      initialHoldings: sampleHoldings,
      priceStore,
    });

    const summaryStore = createSummaryStore({
      priceStore,
      portfolioStore,
      throttleMs: 250,
    });

    const useSummary = createSummaryHook(summaryStore);
    let renderCount = 0;

    function TestComponent() {
      const summary = useSummary();
      renderCount++;
      return (
        <Text testID="val">
          {summary.totals?.currentValuePaise ?? 'null'}
        </Text>
      );
    }

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<TestComponent />);
    });

    expect(renderer.root.findByProps({ testID: 'val' }).props.children).toBe(2600000);
    expect(renderCount).toBe(1);

    // Queue 4 rapid ticks
    for (let i = 1; i <= 4; i++) {
      act(() => {
        priceStore.queueTick({
          symbol: 'RELIANCE',
          seq: i,
          ltp: 260000 + i * 100,
        });
        jest.advanceTimersByTime(25);
      });
    }

    // Still during throttle window, component did not re-render 4 times
    expect(renderCount).toBe(1);

    // Advance past throttle threshold
    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Re-rendered exactly once with latest value
    expect(renderCount).toBe(2);
    expect(renderer.root.findByProps({ testID: 'val' }).props.children).toBe(2604000);

    summaryStore.destroy();
  });
});
