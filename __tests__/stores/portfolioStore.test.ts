import { createPortfolioStore } from '../../src/stores/portfolioStore';
import { createPriceStore } from '../../src/stores/priceStore';
import type { OhlcClient, OhlcResult } from '../../src/api/ohlcClient';
import type { PriceFeed } from '../../src/feed/types';
import { toPaise } from '../../src/domain/money';

describe('Portfolio Store (src/stores/portfolioStore.ts)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const sampleHoldings = [
    { symbol: 'RELIANCE', qty: 25, avgPaise: toPaise(1319.59) },
    { symbol: 'OLDCO', qty: 30, avgPaise: toPaise(412.5) },
  ];

  const mockQuotes = {
    RELIANCE: {
      ltp: toPaise(1164.9),
      open: toPaise(1170.4),
      prevClose: toPaise(1167.4),
      high: toPaise(1174.6),
      low: toPaise(1152.5),
      volume: 14753650,
    },
    OLDCO: {
      ltp: null,
      open: toPaise(0),
      prevClose: toPaise(0),
      high: toPaise(0),
      low: toPaise(0),
      volume: 0,
    },
  };

  test('bootstraps portfolio, fetches quotes once, seeds priceStore, and transitions status to ready', async () => {
    const priceStore = createPriceStore();
    const mockFeed: PriceFeed = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      onTick: jest.fn(() => jest.fn()),
    };

    const mockClient: OhlcClient = {
      fetchOhlc: jest.fn().mockResolvedValue({
        ok: true,
        quotes: mockQuotes,
      } as OhlcResult),
      retry: jest.fn(),
    };

    const store = createPortfolioStore({
      initialHoldings: sampleHoldings,
      priceStore,
      feed: mockFeed,
      apiClient: mockClient,
    });

    expect(store.getStatus()).toBe('idle');
    expect(store.getHoldings()).toEqual(sampleHoldings);

    const bootstrapPromise = store.bootstrap();
    expect(store.getStatus()).toBe('loading');

    await bootstrapPromise;

    expect(store.getStatus()).toBe('ready');
    expect(store.getError()).toBeNull();
    expect(mockClient.fetchOhlc).toHaveBeenCalledTimes(1);
    expect(mockFeed.connect).toHaveBeenCalledTimes(1);

    // Verifies quotes seeded in priceStore
    expect(priceStore.getQuote('RELIANCE')?.ltp).toBe(toPaise(1164.9));
    expect(priceStore.getQuote('OLDCO')?.ltp).toBeNull();
  });

  test('transitions to error status on fetch failure and supports retry', async () => {
    const priceStore = createPriceStore();
    const mockClient: OhlcClient = {
      fetchOhlc: jest.fn()
        .mockResolvedValueOnce({
          ok: false,
          error: { kind: 'network', message: 'Failed to connect' },
        } as OhlcResult)
        .mockResolvedValueOnce({
          ok: true,
          quotes: mockQuotes,
        } as OhlcResult),
      retry: jest.fn(),
    };

    const store = createPortfolioStore({
      initialHoldings: sampleHoldings,
      priceStore,
      apiClient: mockClient,
    });

    await store.bootstrap();

    expect(store.getStatus()).toBe('error');
    expect(store.getError()?.kind).toBe('network');

    // Retry succeeds
    await store.retry();
    expect(store.getStatus()).toBe('ready');
    expect(store.getError()).toBeNull();
    expect(priceStore.getQuote('RELIANCE')?.ltp).toBe(toPaise(1164.9));
  });

  test('pull-to-refresh re-fetches and preserves per-symbol sequence counter', async () => {
    const priceStore = createPriceStore({ flushIntervalMs: 100 });
    const mockClient: OhlcClient = {
      fetchOhlc: jest.fn().mockResolvedValue({
        ok: true,
        quotes: mockQuotes,
      } as OhlcResult),
      retry: jest.fn(),
    };

    const store = createPortfolioStore({
      initialHoldings: sampleHoldings,
      priceStore,
      apiClient: mockClient,
    });

    await store.bootstrap();

    // Advance sequence for RELIANCE via tick
    priceStore.queueTick({
      symbol: 'RELIANCE',
      seq: 42,
      ltp: toPaise(1165.0),
    });
    jest.advanceTimersByTime(100);

    expect(priceStore.getQuote('RELIANCE')?.seq).toBe(42);

    // Pull-to-refresh
    await store.refresh();

    // Sequence counter MUST be preserved (never reset back to 0)
    expect(priceStore.getQuote('RELIANCE')?.seq).toBe(42);
  });
});
