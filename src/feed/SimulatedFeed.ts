import type { PriceFeed, Tick, TickHandler } from './types';
import type { Quote } from '../domain/types';
import type { Paise } from '../domain/money';

export interface SimulatedFeedOptions {
  /**
   * Seedable or mockable random number generator returning [0, 1). Default: Math.random.
   */
  rng?: () => number;

  /**
   * Ticks emitted per second across all symbols. Default: 20 Hz (~50 ms interval).
   */
  tickRateHz?: number;

  /**
   * Interval in milliseconds between silence windows. Default: 60,000 ms (1 minute).
   */
  silenceIntervalMs?: number;

  /**
   * Duration in milliseconds of each silence window. Default: 5,000 ms (5 seconds).
   */
  silenceDurationMs?: number;

  /**
   * Fraction of ticks delivered with older sequence numbers (0 to 1). Default: 0.02 (~2%).
   */
  lateTickRate?: number;
}

/**
 * Functional factory creating a PriceFeed instance with private closure state.
 *
 * Simulates:
 * - ~20 ticks/sec across symbols with private closure timers.
 * - Random price walks bounded within ±0.2% per tick.
 * - Per-symbol sequence tracking (`seq`).
 * - Out-of-order/late ticks (~2%).
 * - Silence window (5 seconds every minute) to test "paused" UI state.
 * - Zero prototype lookup overhead; immune to `this` binding loss in React Native.
 */
export function createSimulatedFeed(
  initialQuotes: Record<string, Quote>,
  options: SimulatedFeedOptions = {}
): PriceFeed {
  const rng = options.rng ?? Math.random;
  const rateHz = options.tickRateHz ?? 20;
  const tickIntervalMs = Math.max(1, Math.round(1000 / rateHz));
  const silenceIntervalMs = options.silenceIntervalMs ?? 60_000;
  const silenceDurationMs = options.silenceDurationMs ?? 5_000;
  const lateTickRate = options.lateTickRate ?? 0.02;

  // Closure-encapsulated quotes: strictly private and inaccessible outside
  const quotes: Record<string, Quote> = {};
  const pricedSymbols: string[] = [];
  for (const [sym, quote] of Object.entries(initialQuotes)) {
    quotes[sym] = { ...quote };
    if (quote.ltp !== null) {
      pricedSymbols.push(sym);
    }
  }

  const seqMap = new Map<string, number>();
  const listeners = new Set<TickHandler>();

  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let silenceIntervalTimer: ReturnType<typeof setInterval> | null = null;
  let silenceTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let isSilent = false;

  const triggerSilenceWindow = (): void => {
    isSilent = true;
    silenceTimeoutTimer = setTimeout(() => {
      isSilent = false;
      silenceTimeoutTimer = null;
    }, silenceDurationMs);
  };

  const emitNextTick = (): void => {
    if (isSilent || pricedSymbols.length === 0) {
      return;
    }

    const symbolIdx = Math.floor(rng() * pricedSymbols.length);
    const symbol = pricedSymbols[symbolIdx];
    if (!symbol) return;

    const current = quotes[symbol];
    if (!current || current.ltp === null) return;

    const currentSeq = seqMap.get(symbol) ?? 0;
    const isLateTick = rng() < lateTickRate && currentSeq > 1;

    let tickSeq: number;
    let newLtp: Paise;

    if (isLateTick) {
      tickSeq = Math.max(1, currentSeq - 1);
      newLtp = current.ltp;
    } else {
      tickSeq = currentSeq + 1;
      seqMap.set(symbol, tickSeq);

      // Random price walk within ±0.2%
      const deltaPct = rng() * 0.004 - 0.002;
      let deltaPaise = Math.round(current.ltp * deltaPct);
      if (deltaPaise === 0) {
        deltaPaise = rng() >= 0.5 ? 1 : -1;
      }

      newLtp = Math.max(1, current.ltp + deltaPaise) as Paise;
      const newHigh = Math.max(current.high, newLtp) as Paise;
      const newLow = Math.min(current.low, newLtp) as Paise;
      const volDelta = Math.floor(rng() * 90) + 10;
      const newVolume = current.volume + volDelta;

      quotes[symbol] = {
        ...current,
        ltp: newLtp,
        high: newHigh,
        low: newLow,
        volume: newVolume,
      };
    }

    const updated = quotes[symbol];
    if (!updated) return;

    const tick: Tick = {
      symbol,
      seq: tickSeq,
      ltp: newLtp,
      high: updated.high,
      low: updated.low,
      volume: updated.volume,
    };

    for (const listener of listeners) {
      listener(tick);
    }
  };

  const connect = (): void => {
    if (tickTimer !== null) {
      return;
    }
    isSilent = false;
    tickTimer = setInterval(emitNextTick, tickIntervalMs);
    silenceIntervalTimer = setInterval(triggerSilenceWindow, silenceIntervalMs);
  };

  const disconnect = (): void => {
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    if (silenceIntervalTimer !== null) {
      clearInterval(silenceIntervalTimer);
      silenceIntervalTimer = null;
    }
    if (silenceTimeoutTimer !== null) {
      clearTimeout(silenceTimeoutTimer);
      silenceTimeoutTimer = null;
    }
    isSilent = false;
  };

  const onTick = (handler: TickHandler): (() => void) => {
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  };

  return {
    connect,
    disconnect,
    onTick,
  };
}

/**
 * Class wrapper for consumers adopting `new SimulatedFeed(...)` style instantiation.
 * Delegates directly to the functional `createSimulatedFeed` factory.
 */
export class SimulatedFeed implements PriceFeed {
  private readonly feed: PriceFeed;

  constructor(initialQuotes: Record<string, Quote>, options: SimulatedFeedOptions = {}) {
    this.feed = createSimulatedFeed(initialQuotes, options);
  }

  public connect = (): void => {
    this.feed.connect();
  };

  public disconnect = (): void => {
    this.feed.disconnect();
  };

  public onTick = (handler: TickHandler): (() => void) => {
    return this.feed.onTick(handler);
  };
}
