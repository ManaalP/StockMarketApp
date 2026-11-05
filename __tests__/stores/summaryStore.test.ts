import { createSummaryStore } from '../../src/stores/summaryStore';
import { createPriceStore } from '../../src/stores/priceStore';
import { createPortfolioStore } from '../../src/stores/portfolioStore';
import type { Holding, Quote } from '../../src/domain/types';

describe('summaryStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const sampleHoldings: Holding[] = [
    { symbol: 'RELIANCE', qty: 10, avgPaise: 250000 }, // Invested: ₹25,000.00
    { symbol: 'TCS', qty: 5, avgPaise: 350000 },      // Invested: ₹17,500.00
    { symbol: 'OLDCO', qty: 100, avgPaise: 12375 },   // Invested: ₹123.75 (unpriced)
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
    TCS: {
      ltp: 360000,
      open: 350000,
      prevClose: 355000,
      high: 365000,
      low: 348000,
      volume: 50000,
    },
    // OLDCO is omitted/unpriced
  };

  test('computes initial summary correctly with priced and unpriced holdings', () => {
    const priceStore = createPriceStore();
    priceStore.seed(sampleQuotes);

    const portfolioStore = createPortfolioStore({
      initialHoldings: sampleHoldings,
      priceStore,
    });

    const summaryStore = createSummaryStore({
      priceStore,
      portfolioStore,
    });

    const snapshot = summaryStore.getSnapshot();

    expect(snapshot.pricedCount).toBe(2);
    expect(snapshot.unpricedCount).toBe(1);
    expect(snapshot.unpricedInvestedPaise).toBe(1237500); // 100 * 12375

    // Total priced invested: 10 * 250000 + 5 * 350000 = 2500000 + 1750000 = 4250000
    // Total current value: 10 * 260000 + 5 * 360000 = 2600000 + 1800000 = 4400000
    // Total P&L: 4400000 - 4250000 = 150000
    // Today's P&L: 10 * (260000 - 250000) + 5 * (360000 - 355000) = 100000 + 25000 = 125000
    expect(snapshot.totals).not.toBeNull();
    expect(snapshot.totals?.totalInvestedPaise).toBe(4250000);
    expect(snapshot.totals?.currentValuePaise).toBe(4400000);
    expect(snapshot.totals?.totalPnlPaise).toBe(150000);
    expect(snapshot.totals?.todayPnlPaise).toBe(125000);

    summaryStore.destroy();
  });

  test('returns totals: null when all holdings are unpriced', () => {
    const priceStore = createPriceStore(); // No quotes seeded
    const portfolioStore = createPortfolioStore({
      initialHoldings: [{ symbol: 'OLDCO', qty: 10, avgPaise: 10000 }],
      priceStore,
    });

    const summaryStore = createSummaryStore({
      priceStore,
      portfolioStore,
    });

    const snapshot = summaryStore.getSnapshot();
    expect(snapshot.pricedCount).toBe(0);
    expect(snapshot.unpricedCount).toBe(1);
    expect(snapshot.unpricedInvestedPaise).toBe(100000);
    expect(snapshot.totals).toBeNull();

    summaryStore.destroy();
  });

  test('throttles high-frequency price tick updates to ~4 Hz (250 ms)', () => {
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

    const listener = jest.fn();
    const unsub = summaryStore.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(0);

    // Queue 5 price ticks across 150 ms (faster than 250 ms)
    for (let i = 1; i <= 5; i++) {
      priceStore.queueTick({
        symbol: 'RELIANCE',
        seq: i,
        ltp: 260000 + i * 100,
      });
      jest.advanceTimersByTime(30);
    }

    // Flushes happen at 50 ms intervals, but summaryStore should throttle
    expect(listener).toHaveBeenCalledTimes(0);

    // Advance time to pass the 250 ms throttle window from when the first flush occurred at t=60ms
    jest.advanceTimersByTime(200); // Total time advanced: 150 + 200 = 350 ms (> 60 + 250 ms)

    expect(listener).toHaveBeenCalledTimes(1);

    // Snapshot reflects the latest price tick (seq 5, ltp 260500)
    const latestSnapshot = summaryStore.getSnapshot();
    expect(latestSnapshot.totals?.currentValuePaise).toBe(10 * 260500 + 5 * 360000);

    // Queue another burst of ticks
    for (let i = 6; i <= 10; i++) {
      priceStore.queueTick({
        symbol: 'TCS',
        seq: i,
        ltp: 360000 + i * 100,
      });
      jest.advanceTimersByTime(20);
    }

    // Advance past another 250 ms window
    jest.advanceTimersByTime(250);

    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
    summaryStore.destroy();
  });

  test('recomputes immediately and notifies subscribers when holdings change', () => {
    const priceStore = createPriceStore();
    priceStore.seed(sampleQuotes);

    const portfolioStore = createPortfolioStore({
      initialHoldings: [{ symbol: 'RELIANCE', qty: 10, avgPaise: 250000 }],
      priceStore,
    });

    const summaryStore = createSummaryStore({
      priceStore,
      portfolioStore,
      throttleMs: 250,
    });

    const listener = jest.fn();
    summaryStore.subscribe(listener);

    expect(summaryStore.getSnapshot().totals?.currentValuePaise).toBe(2600000);

    // Execute a buy order
    portfolioStore.executeOrder({
      side: 'BUY',
      symbol: 'RELIANCE',
      qty: 5,
      fillPaise: 260000,
    });

    // Holdings change triggers immediate recomputation without waiting 250 ms
    expect(listener).toHaveBeenCalledTimes(1);
    expect(summaryStore.getSnapshot().totals?.currentValuePaise).toBe(15 * 260000);

    summaryStore.destroy();
  });

  test('maintains reference stability when price ticks do not alter summary values', () => {
    const priceStore = createPriceStore({ flushIntervalMs: 50 });
    priceStore.seed(sampleQuotes);

    const portfolioStore = createPortfolioStore({
      initialHoldings: [{ symbol: 'RELIANCE', qty: 10, avgPaise: 250000 }],
      priceStore,
    });

    const summaryStore = createSummaryStore({
      priceStore,
      portfolioStore,
      throttleMs: 250,
    });

    const initialSnapshot = summaryStore.getSnapshot();
    const listener = jest.fn();
    summaryStore.subscribe(listener);

    // Tick for a symbol not in portfolio (e.g. INFY)
    priceStore.queueTick({
      symbol: 'INFY',
      seq: 1,
      ltp: 180000,
    });

    jest.advanceTimersByTime(300);

    // Since summary totals for RELIANCE did not change, snapshot reference is preserved
    expect(listener).toHaveBeenCalledTimes(0);
    expect(summaryStore.getSnapshot()).toBe(initialSnapshot);

    summaryStore.destroy();
  });
});
