import { createSimulatedFeed, SimulatedFeed } from '../../src/feed/SimulatedFeed';
import { toPaise } from '../../src/domain/money';
import type { Quote } from '../../src/domain/types';
import type { Tick } from '../../src/feed/types';

describe('Feed Layer: Functional createSimulatedFeed & SimulatedFeed wrapper', () => {
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
      ltp: null, // unlisted / unpriced
      open: toPaise(0),
      high: toPaise(0),
      low: toPaise(0),
      prevClose: toPaise(0),
      volume: 0,
    },
  };

  test('createSimulatedFeed connects and emits ticks at ~20 Hz (~50 ms per tick)', () => {
    const feed = createSimulatedFeed(initialQuotes, { tickRateHz: 20 });
    const ticks: Tick[] = [];
    feed.onTick((tick) => ticks.push(tick));

    feed.connect();
    expect(ticks.length).toBe(0);

    // Advance 100 ms: should produce ~2 ticks
    jest.advanceTimersByTime(100);
    expect(ticks.length).toBe(2);

    // Advance 900 ms more (total 1000 ms): should produce ~20 ticks total
    jest.advanceTimersByTime(900);
    expect(ticks.length).toBe(20);

    feed.disconnect();
  });

  test('ticks contain valid price in paise, sequence numbers, and never select unpriced symbols', () => {
    const feed = createSimulatedFeed(initialQuotes, { tickRateHz: 20 });
    const ticks: Tick[] = [];
    feed.onTick((tick) => ticks.push(tick));

    feed.connect();
    jest.advanceTimersByTime(2000); // 40 ticks
    feed.disconnect();

    expect(ticks.length).toBeGreaterThan(0);
    for (const tick of ticks) {
      expect(['RELIANCE', 'TCS']).toContain(tick.symbol);
      expect(tick.symbol).not.toBe('OLDCO'); // unpriced symbol never selected
      expect(typeof tick.seq).toBe('number');
      expect(tick.seq).toBeGreaterThan(0);
      expect(typeof tick.ltp).toBe('number');
      expect(Number.isInteger(tick.ltp)).toBe(true);
    }
  });

  test('price movement per tick is bounded within ±0.2%', () => {
    const feed = createSimulatedFeed(initialQuotes, {
      tickRateHz: 20,
      lateTickRate: 0, // disable out-of-order for this test
    });
    const relianceTicks: Tick[] = [];
    feed.onTick((t) => {
      if (t.symbol === 'RELIANCE') relianceTicks.push(t);
    });

    feed.connect();
    jest.advanceTimersByTime(5000);
    feed.disconnect();

    expect(relianceTicks.length).toBeGreaterThan(5);
    let prevLtp = initialQuotes.RELIANCE!.ltp!;
    for (const tick of relianceTicks) {
      const delta = Math.abs(tick.ltp! - prevLtp);
      const maxDelta = Math.ceil(prevLtp * 0.002) + 1; // max 0.2% + 1 paise boundary allowance
      expect(delta).toBeLessThanOrEqual(maxDelta);
      prevLtp = tick.ltp!;
    }
  });

  test('disconnect stops all emissions and cleans up timers', () => {
    const feed = createSimulatedFeed(initialQuotes);
    const ticks: Tick[] = [];
    feed.onTick((tick) => ticks.push(tick));

    feed.connect();
    jest.advanceTimersByTime(200);
    expect(ticks.length).toBe(4);

    feed.disconnect();
    jest.advanceTimersByTime(500);
    expect(ticks.length).toBe(4); // No new ticks emitted after disconnect
  });

  test('onTick returns an unsubscribe function that isolates listeners', () => {
    const feed = createSimulatedFeed(initialQuotes);
    const listener1Ticks: Tick[] = [];
    const listener2Ticks: Tick[] = [];

    const unsub1 = feed.onTick((t) => listener1Ticks.push(t));
    feed.onTick((t) => listener2Ticks.push(t));

    feed.connect();
    jest.advanceTimersByTime(100);
    expect(listener1Ticks.length).toBe(2);
    expect(listener2Ticks.length).toBe(2);

    unsub1(); // Unsubscribe first listener

    jest.advanceTimersByTime(100);
    expect(listener1Ticks.length).toBe(2); // Stalled
    expect(listener2Ticks.length).toBe(4); // Continued

    feed.disconnect();
  });

  test('emits late/out-of-order ticks when configured', () => {
    const feed = createSimulatedFeed(initialQuotes, {
      tickRateHz: 20,
      lateTickRate: 0.3,
    });

    const ticks: Tick[] = [];
    feed.onTick((t) => ticks.push(t));

    feed.connect();
    jest.advanceTimersByTime(2000); // 40 ticks
    feed.disconnect();

    const lateTicks = ticks.filter((t, i) => {
      if (i === 0) return false;
      const prevSameSymbol = [...ticks.slice(0, i)].reverse().find((x) => x.symbol === t.symbol);
      return prevSameSymbol && t.seq <= prevSameSymbol.seq;
    });

    expect(lateTicks.length).toBeGreaterThan(0);
  });

  test('enters a silence window (5s) roughly once a minute then resumes', () => {
    const feed = createSimulatedFeed(initialQuotes, {
      tickRateHz: 20,
      silenceIntervalMs: 60000,
      silenceDurationMs: 5000,
    });

    const ticks: Tick[] = [];
    feed.onTick((t) => ticks.push(t));

    feed.connect();

    // Advance to 60.0s (silence interval triggers)
    jest.advanceTimersByTime(60000);
    const ticksAtSilenceStart = ticks.length;
    expect(ticksAtSilenceStart).toBeGreaterThan(1000);

    // Advance across the 5s silence window: exactly 0 ticks must be emitted
    jest.advanceTimersByTime(5000);
    const ticksDuringSilence = ticks.length - ticksAtSilenceStart;
    expect(ticksDuringSilence).toBe(0);

    // Advance 1s past silence window (resumes normal ~20 ticks/s)
    jest.advanceTimersByTime(1000);
    const ticksAfterSilence = ticks.length - ticksAtSilenceStart;
    expect(ticksAfterSilence).toBe(20);

    feed.disconnect();
  });

  test('SimulatedFeed class wrapper behaves identically to functional factory', () => {
    const feed = new SimulatedFeed(initialQuotes, { tickRateHz: 20 });
    const ticks: Tick[] = [];
    const unsub = feed.onTick((t) => ticks.push(t));

    feed.connect();
    jest.advanceTimersByTime(100);
    expect(ticks.length).toBe(2);

    unsub();
    feed.disconnect();
  });
});
