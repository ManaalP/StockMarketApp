import { bootstrapApp } from '../../src/bootstrap';
import { toPaise } from '../../src/domain/money';
import type { Quote } from '../../src/domain/types';
import type { PriceFeed } from '../../src/feed/types';

describe('Application Composition Root (src/bootstrap.ts)', () => {
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
  };

  test('bootstraps app with seed quotes and connects the feed', () => {
    const mockFeed: PriceFeed = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      onTick: jest.fn(() => jest.fn()),
    };

    const result = bootstrapApp(sampleQuotes, mockFeed);

    expect(result.priceStore).toBeDefined();
    expect(result.feed).toBe(mockFeed);
    expect(mockFeed.connect).toHaveBeenCalledTimes(1);
    expect(mockFeed.onTick).toHaveBeenCalledTimes(1);

    expect(result.priceStore.getQuote('RELIANCE')?.ltp).toBe(toPaise(2500));

    result.disconnect();
    expect(mockFeed.disconnect).toHaveBeenCalledTimes(1);
  });
});
