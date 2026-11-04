import type { Quote } from './types';
import type { Tick } from '../feed/types';
import type { Paise } from './money';

export interface QuoteWithSeq extends Quote {
  readonly seq: number;
}

export type QuotesState = Record<string, QuoteWithSeq>;

/**
 * Pure function to merge an incoming market tick into current quotes state.
 *
 * Rules:
 * 1. Dropped if tick.seq <= currentQuote.seq (returns exact same state reference).
 * 2. Dropped if tick contains no price or volume changes (returns exact same state reference).
 * 3. High/low must widen, never shrink, when LTP or incoming high/low exceeds boundaries.
 * 4. Volume never decreases.
 * 5. Returns a new state reference only when a quote actually changes.
 */
export function mergeTick(state: QuotesState, tick: Tick): QuotesState {
  const current = state[tick.symbol];

  // If no prior quote exists, initialize new quote if valid price is provided
  if (!current) {
    if (tick.ltp === undefined) {
      return state;
    }
    const ltp = tick.ltp;
    const high = tick.high !== undefined ? (Math.max(tick.high, ltp) as Paise) : ltp;
    const low = tick.low !== undefined ? (Math.min(tick.low, ltp) as Paise) : ltp;
    const volume = tick.volume ?? 0;

    const newQuote: QuoteWithSeq = {
      seq: tick.seq,
      ltp,
      open: ltp,
      high,
      low,
      prevClose: ltp,
      volume,
    };

    return {
      ...state,
      [tick.symbol]: newQuote,
    };
  }

  // 1. Drop late or duplicate sequence ticks
  if (tick.seq <= current.seq) {
    return state;
  }

  // 2. Compute potential updates
  const hasLtp = tick.ltp !== undefined;
  const hasHigh = tick.high !== undefined;
  const hasLow = tick.low !== undefined;
  const hasVolume = tick.volume !== undefined;

  if (!hasLtp && !hasHigh && !hasLow && !hasVolume) {
    return state;
  }

  const nextLtp = hasLtp ? tick.ltp! : current.ltp;

  // High widening: must be at least current.high, tick.high (if provided), and nextLtp (if valid)
  let nextHigh = current.high;
  if (hasHigh && tick.high! > nextHigh) {
    nextHigh = tick.high!;
  }
  if (nextLtp !== null && nextLtp > nextHigh) {
    nextHigh = nextLtp;
  }

  // Low widening: must be at most current.low, tick.low (if provided), and nextLtp (if valid)
  let nextLow = current.low;
  if (hasLow && tick.low! < nextLow) {
    nextLow = tick.low!;
  }
  if (nextLtp !== null && nextLtp < nextLow) {
    nextLow = nextLtp;
  }

  // Volume: never decreases
  const nextVolume = hasVolume ? Math.max(current.volume, tick.volume!) : current.volume;

  // Check if any visible field changed
  if (
    nextLtp === current.ltp &&
    nextHigh === current.high &&
    nextLow === current.low &&
    nextVolume === current.volume
  ) {
    return state;
  }

  const updatedQuote: QuoteWithSeq = {
    ...current,
    seq: tick.seq,
    ltp: nextLtp,
    high: nextHigh,
    low: nextLow,
    volume: nextVolume,
  };

  return {
    ...state,
    [tick.symbol]: updatedQuote,
  };
}
