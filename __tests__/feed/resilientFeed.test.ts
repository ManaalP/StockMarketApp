import { createResilientFeed } from '../../src/feed/resilientFeed';
import { createSimulatedFeed } from '../../src/feed/SimulatedFeed';
import type { Quote } from '../../src/domain/types';
import type { Tick, FeedStatus } from '../../src/feed/types';
import { toPaise } from '../../src/domain/money';

describe('Feed: ResilientFeed Reconnect and Catch-Up (src/feed/resilientFeed.ts)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockQuotes: Record<string, Quote> = {
    RELIANCE: {
      ltp: toPaise(2500),
      open: toPaise(2480),
      high: toPaise(2520),
      low: toPaise(2470),
      prevClose: toPaise(2450),
      volume: 1000,
    },
  };

  it('forwards ticks from underlying feed when connected', () => {
    const rawFeed = createSimulatedFeed(mockQuotes);
    const resilientFeed = createResilientFeed(rawFeed);

    const receivedTicks: Tick[] = [];
    resilientFeed.onTick((tick) => receivedTicks.push(tick));

    resilientFeed.connect();
    expect(resilientFeed.getStatus()).toBe('connected');

    jest.advanceTimersByTime(120);
    expect(receivedTicks.length).toBeGreaterThan(0);

    resilientFeed.disconnect();
    expect(resilientFeed.getStatus()).toBe('disconnected');
  });

  it('enters reconnecting status and reconnects with backoff after unexpected disconnect', async () => {
    const mockCatchUpFetch = jest.fn(async () => {
      return mockQuotes;
    });

    const statusHistory: FeedStatus[] = [];
    const rawFeed = createSimulatedFeed(mockQuotes);
    const resilientFeed = createResilientFeed(rawFeed, {
      catchUpFetch: mockCatchUpFetch,
      baseDelayMs: 500,
      maxDelayMs: 4000,
      rng: () => 0, // deterministic no jitter
    });

    resilientFeed.onStatusChange((s) => statusHistory.push(s));
    resilientFeed.connect();

    expect(resilientFeed.getStatus()).toBe('connected');

    // Simulate unexpected drop
    rawFeed.simulateDisconnect?.();

    expect(resilientFeed.getStatus()).toBe('reconnecting');
    expect(statusHistory).toContain('reconnecting');

    // Advance by backoff delay (attempt 0: 500ms)
    jest.advanceTimersByTime(500);

    // Allow promise microtasks for catch-up fetch
    await Promise.resolve();

    expect(mockCatchUpFetch).toHaveBeenCalledTimes(1);
    expect(resilientFeed.getStatus()).toBe('connected');

    resilientFeed.disconnect();
  });

  it('increases backoff exponentially on multiple failures before succeeding', async () => {
    let attempts = 0;
    const failingCatchUp = jest.fn(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Network error');
      }
      return mockQuotes;
    });

    const rawFeed = createSimulatedFeed(mockQuotes);
    const resilientFeed = createResilientFeed(rawFeed, {
      catchUpFetch: failingCatchUp,
      baseDelayMs: 200,
      maxDelayMs: 2000,
      rng: () => 0,
    });

    resilientFeed.connect();

    // Trigger unexpected drop
    rawFeed.simulateDisconnect?.();
    expect(resilientFeed.getStatus()).toBe('reconnecting');

    // Attempt 0: delay is 200ms
    jest.advanceTimersByTime(200);
    await Promise.resolve();
    // Failed first catch-up, still reconnecting
    expect(resilientFeed.getStatus()).toBe('reconnecting');

    // Attempt 1: delay is 400ms
    jest.advanceTimersByTime(400);
    await Promise.resolve();
    // Failed second catch-up, still reconnecting
    expect(resilientFeed.getStatus()).toBe('reconnecting');

    // Attempt 2: delay is 800ms
    jest.advanceTimersByTime(800);
    await Promise.resolve();
    // Succeeded third attempt!
    expect(resilientFeed.getStatus()).toBe('connected');
    expect(failingCatchUp).toHaveBeenCalledTimes(3);

    resilientFeed.disconnect();
  });

  it('does not auto-reconnect if user explicitly called disconnect()', () => {
    const mockCatchUpFetch = jest.fn(async () => mockQuotes);
    const rawFeed = createSimulatedFeed(mockQuotes);
    const resilientFeed = createResilientFeed(rawFeed, {
      catchUpFetch: mockCatchUpFetch,
      baseDelayMs: 500,
    });

    resilientFeed.connect();
    expect(resilientFeed.getStatus()).toBe('connected');

    // User explicitly calls disconnect
    resilientFeed.disconnect();
    expect(resilientFeed.getStatus()).toBe('disconnected');

    jest.advanceTimersByTime(2000);
    expect(resilientFeed.getStatus()).toBe('disconnected');
    expect(mockCatchUpFetch).not.toHaveBeenCalled();
  });
});
