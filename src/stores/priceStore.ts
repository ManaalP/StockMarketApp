import { useSyncExternalStore, useCallback } from 'react';
import type { Quote } from '../domain/types';
import type { Tick, PriceFeed } from '../feed/types';
import { mergeTick, type QuoteWithSeq, type QuotesState } from '../domain/tickMerge';
import { networkStore } from './networkStore';

export interface PriceStoreOptions {
  /**
   * Batch flushing interval in ms. Incoming ticks are queued and flushed together. Default: 100 ms.
   */
  flushIntervalMs?: number;

  /**
   * Time in ms without any tick before considering the feed paused. Default: 2000 ms (2 seconds).
   */
  pauseThresholdMs?: number;
}

export interface PriceStore {
  getQuote(symbol: string): QuoteWithSeq | null;
  getQuotes(): QuotesState;
  subscribe(symbol: string, callback: () => void): () => void;
  subscribeAll(callback: () => void): () => void;
  subscribePaused(callback: (paused: boolean) => void): () => void;
  isPaused(): boolean;
  getLastTickAt(): number;
  seed(quotes: Record<string, Quote>): void;
  queueTick(tick: Tick): void;
  flush(): void;
  connectFeed(feed: PriceFeed): () => void;
  destroy(): void;
}

/**
 * Functional factory creating an external price store with per-symbol subscriptions.
 *
 * Architecture:
 * - 100% functional closures (no ES6 classes, no `this`).
 * - Batches incoming ticks and flushes every ~100 ms.
 * - Granular per-symbol subscriptions: only symbols whose quote object changed notify their listeners.
 * - Returns reference-stable snapshots for useSyncExternalStore.
 * - Detects feed silence (> 2s) to drive paused indicators.
 */
export function createPriceStore(options: PriceStoreOptions = {}): PriceStore {
  const flushIntervalMs = options.flushIntervalMs ?? 100;
  const pauseThresholdMs = options.pauseThresholdMs ?? 2000;

  // Private closure state
  let state: QuotesState = {};
  const queue: Tick[] = [];

  const symbolSubscribers = new Map<string, Set<() => void>>();
  const allSubscribers = new Set<() => void>();
  const pausedSubscribers = new Set<(paused: boolean) => void>();

  let lastTickAt = 0;
  let paused = false;

  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let pauseTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  const setPausedState = (nextPaused: boolean): void => {
    if (paused === nextPaused) return;
    paused = nextPaused;
    for (const listener of pausedSubscribers) {
      listener(paused);
    }
  };

  const resetPauseTimeout = (): void => {
    if (pauseTimeoutTimer !== null) {
      clearTimeout(pauseTimeoutTimer);
    }
    pauseTimeoutTimer = setTimeout(() => {
      setPausedState(true);
    }, pauseThresholdMs);
  };

  const startTimers = (): void => {
    if (flushTimer === null) {
      flushTimer = setInterval(() => {
        flush();
      }, flushIntervalMs);
    }
  };

  const flush = (): void => {
    if (queue.length === 0) {
      return;
    }

    const ticks = queue.splice(0, queue.length);
    const affectedSymbols = new Set<string>();

    let nextState = state;
    for (const tick of ticks) {
      const merged = mergeTick(nextState, tick);
      if (merged !== nextState) {
        affectedSymbols.add(tick.symbol);
        nextState = merged;
      }
    }

    if (affectedSymbols.size === 0) {
      return;
    }

    state = nextState;

    // 1. Notify per-symbol subscribers for affected symbols only
    for (const symbol of affectedSymbols) {
      const listeners = symbolSubscribers.get(symbol);
      if (listeners) {
        for (const cb of listeners) {
          cb();
        }
      }
    }

    // 2. Notify aggregate (all quotes) subscribers (e.g. summary selector)
    for (const cb of allSubscribers) {
      cb();
    }
  };

  let connectedFeed: PriceFeed | null = null;

  const unsubNetwork = networkStore.onNetworkChange((online) => {
    if (!online) {
      setPausedState(true);
      connectedFeed?.disconnect();
    } else {
      connectedFeed?.connect();
      setPausedState(false);
    }
  });

  const queueTick = (tick: Tick): void => {
    if (!networkStore.isOnline()) {
      return;
    }
    lastTickAt = Date.now();
    if (paused) {
      setPausedState(false);
    }
    resetPauseTimeout();

    queue.push(tick);
    startTimers();
  };

  const seed = (quotes: Record<string, Quote>): void => {
    const nextState: QuotesState = { ...state };
    for (const [sym, quote] of Object.entries(quotes)) {
      nextState[sym] = {
        ...quote,
        seq: state[sym]?.seq ?? 0,
      };
    }
    state = nextState;

    // Notify all subscribers of seed
    for (const [sym, listeners] of symbolSubscribers.entries()) {
      if (nextState[sym]) {
        for (const cb of listeners) {
          cb();
        }
      }
    }
    for (const cb of allSubscribers) {
      cb();
    }
  };

  const getQuote = (symbol: string): QuoteWithSeq | null => {
    return state[symbol] ?? null;
  };

  const getQuotes = (): QuotesState => {
    return state;
  };

  const isPaused = (): boolean => {
    return paused;
  };

  const getLastTickAt = (): number => {
    return lastTickAt;
  };

  const subscribe = (symbol: string, callback: () => void): (() => void) => {
    let listeners = symbolSubscribers.get(symbol);
    if (!listeners) {
      listeners = new Set();
      symbolSubscribers.set(symbol, listeners);
    }
    listeners.add(callback);

    return () => {
      const current = symbolSubscribers.get(symbol);
      if (current) {
        current.delete(callback);
        if (current.size === 0) {
          symbolSubscribers.delete(symbol);
        }
      }
    };
  };

  const subscribeAll = (callback: () => void): (() => void) => {
    allSubscribers.add(callback);
    return () => {
      allSubscribers.delete(callback);
    };
  };

  const subscribePaused = (callback: (paused: boolean) => void): (() => void) => {
    pausedSubscribers.add(callback);
    return () => {
      pausedSubscribers.delete(callback);
    };
  };

  const connectFeed = (feed: PriceFeed): (() => void) => {
    connectedFeed = feed;
    feed.connect();
    const unsubFeed = feed.onTick((tick) => {
      queueTick(tick);
    });

    return () => {
      unsubFeed();
      feed.disconnect();
      if (connectedFeed === feed) {
        connectedFeed = null;
      }
    };
  };

  const destroy = (): void => {
    unsubNetwork();
    if (flushTimer !== null) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    if (pauseTimeoutTimer !== null) {
      clearTimeout(pauseTimeoutTimer);
      pauseTimeoutTimer = null;
    }
    queue.length = 0;
    symbolSubscribers.clear();
    allSubscribers.clear();
    pausedSubscribers.clear();
  };

  return {
    getQuote,
    getQuotes,
    subscribe,
    subscribeAll,
    subscribePaused,
    isPaused,
    getLastTickAt,
    seed,
    queueTick,
    flush,
    connectFeed,
    destroy,
  };
}

/**
 * Functional factory to generate React hooks wired to a PriceStore instance.
 */
export function createPriceHooks(store: PriceStore) {
  function usePrice(symbol: string): QuoteWithSeq | null {
    const subscribe = useCallback(
      (notify: () => void) => store.subscribe(symbol, notify),
      [symbol]
    );

    const getSnapshot = useCallback(
      () => store.getQuote(symbol),
      [symbol]
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  function useQuoteField<T>(
    symbol: string,
    selector: (quote: QuoteWithSeq | null) => T
  ): T {
    const quote = usePrice(symbol);
    return selector(quote);
  }

  function usePaused(): boolean {
    const subscribe = useCallback(
      (notify: () => void) => store.subscribePaused(() => notify()),
      []
    );

    const getSnapshot = useCallback(
      () => store.isPaused(),
      []
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  function useAllQuotes(): QuotesState {
    const subscribe = useCallback(
      (notify: () => void) => store.subscribeAll(notify),
      []
    );

    const getSnapshot = useCallback(
      () => store.getQuotes(),
      []
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  return {
    usePrice,
    useQuoteField,
    usePaused,
    useAllQuotes,
  };
}

// Global default price store singleton
export const priceStore = createPriceStore();

// Default global React hooks
export const {
  usePrice,
  useQuoteField,
  usePaused,
  useAllQuotes,
} = createPriceHooks(priceStore);
