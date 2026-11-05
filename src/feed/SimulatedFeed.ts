import type { PriceFeed, Tick, TickHandler, FeedStatus, FeedStatusHandler } from './types';
import type { Quote } from '../domain/types';
import type { Paise } from '../domain/money';

/**
 * Fast, deterministic 32-bit PRNG (Mulberry32).
 */
export function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseSeed(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.floor(val);
  }
  if (typeof val === 'string' && val.trim().length > 0) {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
    let h = 0;
    for (let i = 0; i < val.length; i++) {
      h = (Math.imul(31, h) + val.charCodeAt(i)) | 0;
    }
    return h;
  }
  return null;
}

export interface SimulatedFeedOptions {
  /**
   * Seedable or mockable random number generator returning [0, 1).
   * Default: Mulberry32 if seed or QA_SEED is set, else Math.random.
   */
  rng?: () => number;

  /**
   * Deterministic seed for PRNG. If omitted, falls back to process.env.QA_SEED.
   */
  seed?: number | string;

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
 * - Deterministic runs via QA_SEED or options.seed.
 * - Zero prototype lookup overhead; immune to `this` binding loss in React Native.
 */
export function createSimulatedFeed(
  initialQuotes: Record<string, Quote>,
  options: SimulatedFeedOptions = {}
): PriceFeed {
  const rawSeed = options.seed ?? (typeof process !== 'undefined' ? process.env.QA_SEED : undefined);
  const parsedSeed = parseSeed(rawSeed);
  const rng = options.rng ?? (parsedSeed !== null ? createMulberry32(parsedSeed) : Math.random);
  let rateHz = options.tickRateHz ?? 20;
  let tickIntervalMs = Math.max(1, Math.round(1000 / rateHz));
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
  const statusListeners = new Set<FeedStatusHandler>();

  let status: FeedStatus = 'disconnected';
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let silenceIntervalTimer: ReturnType<typeof setInterval> | null = null;
  let silenceTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let isSilent = false;

  const setStatus = (next: FeedStatus): void => {
    if (status === next) return;
    status = next;
    for (const listener of statusListeners) {
      listener(status);
    }
  };

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
    setStatus('connected');
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
    setStatus('disconnected');
  };

  const simulateDisconnect = (): void => {
    disconnect();
  };

  const onTick = (handler: TickHandler): (() => void) => {
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  };

  const onStatusChange = (handler: FeedStatusHandler): (() => void) => {
    statusListeners.add(handler);
    return () => {
      statusListeners.delete(handler);
    };
  };

  const getStatus = (): FeedStatus => status;

  const setTickRate = (nextHz: number): void => {
    rateHz = Math.max(1, Math.min(100, Math.round(nextHz)));
    tickIntervalMs = Math.max(1, Math.round(1000 / rateHz));
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = setInterval(emitNextTick, tickIntervalMs);
    }
  };

  const getTickRate = (): number => rateHz;

  return {
    connect,
    disconnect,
    onTick,
    onStatusChange,
    getStatus,
    simulateDisconnect,
    setTickRate,
    getTickRate,
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

  public onStatusChange = (handler: FeedStatusHandler): (() => void) => {
    return this.feed.onStatusChange?.(handler) ?? (() => {});
  };

  public getStatus = (): FeedStatus => {
    return this.feed.getStatus?.() ?? 'disconnected';
  };

  public simulateDisconnect = (): void => {
    this.feed.simulateDisconnect?.();
  };

  public setTickRate = (rateHz: number): void => {
    this.feed.setTickRate?.(rateHz);
  };

  public getTickRate = (): number => {
    return this.feed.getTickRate?.() ?? 20;
  };
}
