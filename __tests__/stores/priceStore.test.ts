import { createPriceStore } from '../../src/stores/priceStore';
import { toPaise } from '../../src/domain/money';
import type { Quote } from '../../src/domain/types';
import type { PriceFeed, TickHandler } from '../../src/feed/types';

describe('PriceStore (Functional External Store with Per-Symbol Subscriptions)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const initialQuotes: Record<string, Quote> = {
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
    OLDCO: {
      ltp: null,
      open: toPaise(0),
      high: toPaise(0),
      low: toPaise(0),
      prevClose: toPaise(0),
      volume: 0,
    },
  };

  test('seeds store and returns stable quote snapshots', () => {
    const store = createPriceStore();
    store.seed(initialQuotes);

    const relQuote1 = store.getQuote('RELIANCE');
    const relQuote2 = store.getQuote('RELIANCE');
    expect(relQuote1).toBeDefined();
    expect(relQuote1).toBe(relQuote2); // Strict reference identity
    expect(relQuote1?.ltp).toBe(toPaise(2500));
    expect(relQuote1?.seq).toBe(0);

    const oldcoQuote = store.getQuote('OLDCO');
    expect(oldcoQuote?.ltp).toBeNull();
  });

  test('notifies ONLY subscribers of affected symbols on tick flush', () => {
    const store = createPriceStore({ flushIntervalMs: 100 });
    store.seed(initialQuotes);

    const relianceListener = jest.fn();
    const tcsListener = jest.fn();

    store.subscribe('RELIANCE', relianceListener);
    store.subscribe('TCS', tcsListener);

    // Queue tick for RELIANCE only
    store.queueTick({
      symbol: 'RELIANCE',
      seq: 1,
      ltp: toPaise(2505),
    });

    // Before flush, listeners not called
    expect(relianceListener).not.toHaveBeenCalled();
    expect(tcsListener).not.toHaveBeenCalled();

    // Advance past batch interval (100 ms)
    jest.advanceTimersByTime(100);

    expect(relianceListener).toHaveBeenCalledTimes(1);
    expect(tcsListener).not.toHaveBeenCalled(); // TCS was unaffected!

    const updatedReliance = store.getQuote('RELIANCE');
    expect(updatedReliance?.ltp).toBe(toPaise(2505));
    expect(updatedReliance?.seq).toBe(1);

    // Snapshot of TCS remained reference-identical
    expect(store.getQuote('TCS')).toBe(initialQuotes.TCS ? store.getQuote('TCS') : null);
  });

  test('ignores late ticks (seq <= lastSeq) and does not notify subscribers', () => {
    const store = createPriceStore({ flushIntervalMs: 100 });
    store.seed(initialQuotes);

    // Set sequence to 5
    store.queueTick({
      symbol: 'RELIANCE',
      seq: 5,
      ltp: toPaise(2510),
    });
    jest.advanceTimersByTime(100);

    const relianceListener = jest.fn();
    store.subscribe('RELIANCE', relianceListener);

    // Arrives late with seq 4
    store.queueTick({
      symbol: 'RELIANCE',
      seq: 4,
      ltp: toPaise(2515),
    });
    jest.advanceTimersByTime(100);

    expect(relianceListener).not.toHaveBeenCalled();
    expect(store.getQuote('RELIANCE')?.ltp).toBe(toPaise(2510));
    expect(store.getQuote('RELIANCE')?.seq).toBe(5);
  });

  test('coalesces multiple rapid ticks into a single notification per 100 ms flush', () => {
    const store = createPriceStore({ flushIntervalMs: 100 });
    store.seed(initialQuotes);

    const relianceListener = jest.fn();
    store.subscribe('RELIANCE', relianceListener);

    // Send 5 rapid ticks within the same 100 ms batch window
    store.queueTick({ symbol: 'RELIANCE', seq: 1, ltp: toPaise(2501) });
    store.queueTick({ symbol: 'RELIANCE', seq: 2, ltp: toPaise(2502) });
    store.queueTick({ symbol: 'RELIANCE', seq: 3, ltp: toPaise(2503) });
    store.queueTick({ symbol: 'RELIANCE', seq: 4, ltp: toPaise(2504) });
    store.queueTick({ symbol: 'RELIANCE', seq: 5, ltp: toPaise(2505) });

    // Flush batch
    jest.advanceTimersByTime(100);

    // Coalesced: notified once, reflecting the final merged state
    expect(relianceListener).toHaveBeenCalledTimes(1);
    expect(store.getQuote('RELIANCE')?.ltp).toBe(toPaise(2505));
    expect(store.getQuote('RELIANCE')?.seq).toBe(5);
  });

  test('subscribeAll notifies summary subscribers once per batch flush if any symbol changed', () => {
    const store = createPriceStore({ flushIntervalMs: 100 });
    store.seed(initialQuotes);

    const summaryListener = jest.fn();
    store.subscribeAll(summaryListener);

    // Tick arrives for RELIANCE
    store.queueTick({ symbol: 'RELIANCE', seq: 1, ltp: toPaise(2502) });
    store.queueTick({ symbol: 'TCS', seq: 1, ltp: toPaise(3505) });

    jest.advanceTimersByTime(100);
    expect(summaryListener).toHaveBeenCalledTimes(1);

    // If batch has no changes, summaryListener not called
    jest.advanceTimersByTime(100);
    expect(summaryListener).toHaveBeenCalledTimes(1);
  });

  test('detects paused feed when no tick arrives for > 2 seconds and resumes on next tick', () => {
    const store = createPriceStore({
      flushIntervalMs: 100,
      pauseThresholdMs: 2000,
    });
    store.seed(initialQuotes);

    const pausedListener = jest.fn();
    store.subscribePaused(pausedListener);

    expect(store.isPaused()).toBe(false);

    // Emit initial tick to establish baseline activity
    store.queueTick({ symbol: 'RELIANCE', seq: 1, ltp: toPaise(2501) });
    jest.advanceTimersByTime(100);

    // Advance 1.5 seconds (under 2s threshold) -> not paused
    jest.advanceTimersByTime(1500);
    expect(store.isPaused()).toBe(false);
    expect(pausedListener).not.toHaveBeenCalled();

    // Advance 600 ms more (total 2.1s since last tick) -> should transition to paused
    jest.advanceTimersByTime(600);
    expect(store.isPaused()).toBe(true);
    expect(pausedListener).toHaveBeenCalledWith(true);

    // Next tick arrives -> should immediately clear paused state
    store.queueTick({ symbol: 'RELIANCE', seq: 2, ltp: toPaise(2502) });
    expect(store.isPaused()).toBe(false);
    expect(pausedListener).toHaveBeenCalledWith(false);

    store.destroy();
  });

  test('unsubscribe stops notifications for symbol and summary', () => {
    const store = createPriceStore({ flushIntervalMs: 100 });
    store.seed(initialQuotes);

    const relianceListener = jest.fn();
    const unsub = store.subscribe('RELIANCE', relianceListener);

    store.queueTick({ symbol: 'RELIANCE', seq: 1, ltp: toPaise(2502) });
    jest.advanceTimersByTime(100);
    expect(relianceListener).toHaveBeenCalledTimes(1);

    unsub();

    store.queueTick({ symbol: 'RELIANCE', seq: 2, ltp: toPaise(2504) });
    jest.advanceTimersByTime(100);
    expect(relianceListener).toHaveBeenCalledTimes(1); // Not called again
  });

  test('connectFeed wires a PriceFeed directly to the price store', () => {
    const store = createPriceStore({ flushIntervalMs: 100 });
    store.seed(initialQuotes);

    let feedHandler: TickHandler | null = null;
    const mockFeed: PriceFeed = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      onTick: jest.fn((handler: TickHandler) => {
        feedHandler = handler;
        return () => {
          feedHandler = null;
        };
      }),
    };

    const disconnectFeed = store.connectFeed(mockFeed);
    expect(mockFeed.connect).toHaveBeenCalled();
    expect(mockFeed.onTick).toHaveBeenCalled();

    // Simulate tick emitted from feed
    const emit = feedHandler as TickHandler | null;
    if (emit) {
      emit({ symbol: 'RELIANCE', seq: 1, ltp: toPaise(2503) });
    }

    jest.advanceTimersByTime(100);
    expect(store.getQuote('RELIANCE')?.ltp).toBe(toPaise(2503));

    disconnectFeed();
    expect(mockFeed.disconnect).toHaveBeenCalled();
    expect(feedHandler).toBeNull();
  });
});
