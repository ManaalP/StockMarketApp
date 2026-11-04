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
 * Realistic market feed simulator that emits high-frequency partial ticks.
 *
 * Simulates:
 * - ~20 ticks/sec across symbols.
 * - Random price walks bounded within ±0.2% per tick.
 * - Sequence tracking per symbol.
 * - Out-of-order/late ticks (~2%).
 * - Silence window (5 seconds every minute) to test "paused" UI state.
 */
export class SimulatedFeed implements PriceFeed {
  private readonly rng: () => number;
  private readonly tickIntervalMs: number;
  private readonly silenceIntervalMs: number;
  private readonly silenceDurationMs: number;
  private readonly lateTickRate: number;

  private readonly quotes: Record<string, Quote>;
  private readonly pricedSymbols: string[];
  private readonly seqMap = new Map<string, number>();
  private readonly listeners = new Set<TickHandler>();

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private silenceIntervalTimer: ReturnType<typeof setInterval> | null = null;
  private silenceTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private isSilent = false;

  constructor(initialQuotes: Record<string, Quote>, options: SimulatedFeedOptions = {}) {
    this.rng = options.rng ?? Math.random;
    const rateHz = options.tickRateHz ?? 20;
    this.tickIntervalMs = Math.max(1, Math.round(1000 / rateHz));
    this.silenceIntervalMs = options.silenceIntervalMs ?? 60_000;
    this.silenceDurationMs = options.silenceDurationMs ?? 5_000;
    this.lateTickRate = options.lateTickRate ?? 0.02;

    // Clone initial quotes and extract symbols with priced quotes (ltp !== null)
    this.quotes = {};
    const symbols: string[] = [];
    for (const [sym, quote] of Object.entries(initialQuotes)) {
      this.quotes[sym] = { ...quote };
      if (quote.ltp !== null) {
        symbols.push(sym);
      }
    }
    this.pricedSymbols = symbols;
  }

  public connect(): void {
    if (this.tickTimer !== null) {
      return; // Already connected
    }

    this.isSilent = false;

    // Start tick generation timer
    this.tickTimer = setInterval(() => {
      this.emitNextTick();
    }, this.tickIntervalMs);

    // Start recurring silence window schedule
    this.silenceIntervalTimer = setInterval(() => {
      this.triggerSilenceWindow();
    }, this.silenceIntervalMs);
  }

  public disconnect(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.silenceIntervalTimer !== null) {
      clearInterval(this.silenceIntervalTimer);
      this.silenceIntervalTimer = null;
    }
    if (this.silenceTimeoutTimer !== null) {
      clearTimeout(this.silenceTimeoutTimer);
      this.silenceTimeoutTimer = null;
    }
    this.isSilent = false;
  }

  public onTick(handler: TickHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private triggerSilenceWindow(): void {
    this.isSilent = true;

    this.silenceTimeoutTimer = setTimeout(() => {
      this.isSilent = false;
      this.silenceTimeoutTimer = null;
    }, this.silenceDurationMs);
  }

  private emitNextTick(): void {
    if (this.isSilent || this.pricedSymbols.length === 0) {
      return;
    }

    // Pick random priced symbol
    const symbolIdx = Math.floor(this.rng() * this.pricedSymbols.length);
    const symbol = this.pricedSymbols[symbolIdx];
    if (!symbol) return;

    const current = this.quotes[symbol];
    if (!current || current.ltp === null) return;

    const currentSeq = this.seqMap.get(symbol) ?? 0;
    const isLateTick = this.rng() < this.lateTickRate && currentSeq > 1;

    let tickSeq: number;
    let newLtp: Paise;

    if (isLateTick) {
      // Intentionally emit with an older sequence number to simulate network re-ordering
      tickSeq = Math.max(1, currentSeq - 1);
      newLtp = current.ltp;
    } else {
      tickSeq = currentSeq + 1;
      this.seqMap.set(symbol, tickSeq);

      // Random price walk within ±0.2%
      // (rng() * 0.004) - 0.002 yields range [-0.002, +0.002]
      const deltaPct = this.rng() * 0.004 - 0.002;
      let deltaPaise = Math.round(current.ltp * deltaPct);
      if (deltaPaise === 0) {
        deltaPaise = this.rng() >= 0.5 ? 1 : -1;
      }

      newLtp = Math.max(1, current.ltp + deltaPaise) as Paise;
      const newHigh = Math.max(current.high, newLtp) as Paise;
      const newLow = Math.min(current.low, newLtp) as Paise;
      const volDelta = Math.floor(this.rng() * 90) + 10;
      const newVolume = current.volume + volDelta;

      this.quotes[symbol] = {
        ...current,
        ltp: newLtp,
        high: newHigh,
        low: newLow,
        volume: newVolume,
      };
    }

    const updated = this.quotes[symbol];
    if (!updated) return;

    const tick: Tick = {
      symbol,
      seq: tickSeq,
      ltp: newLtp,
      high: updated.high,
      low: updated.low,
      volume: updated.volume,
    };

    for (const listener of this.listeners) {
      listener(tick);
    }
  }
}
