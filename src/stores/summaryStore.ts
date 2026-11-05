import { useSyncExternalStore, useCallback } from 'react';
import type { Holding, PortfolioSummary, SummaryTotals } from '../domain/types';
import { rowMetrics, summarize } from '../domain/calcs';
import type { QuotesState } from '../domain/tickMerge';
import { priceStore as defaultPriceStore, type PriceStore } from './priceStore';
import { portfolioStore as defaultPortfolioStore, type PortfolioStore } from './portfolioStore';

export interface SummaryStoreOptions {
  readonly priceStore?: PriceStore;
  readonly portfolioStore?: PortfolioStore;
  /**
   * Throttling duration in ms for derived summary recalculation.
   * Spec requirement: ~4 Hz (250 ms).
   */
  readonly throttleMs?: number;
}

export interface SummaryStore {
  getSnapshot(): PortfolioSummary;
  subscribe(callback: () => void): () => void;
  recompute(): void;
  destroy(): void;
}

function areTotalsEqual(a: SummaryTotals | null, b: SummaryTotals | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.currentValuePaise === b.currentValuePaise &&
    a.totalInvestedPaise === b.totalInvestedPaise &&
    a.totalPnlPaise === b.totalPnlPaise &&
    a.totalPnlPct === b.totalPnlPct &&
    a.todayPnlPaise === b.todayPnlPaise &&
    a.todayPnlPct === b.todayPnlPct
  );
}

function areSummariesEqual(a: PortfolioSummary, b: PortfolioSummary): boolean {
  return (
    a.pricedCount === b.pricedCount &&
    a.unpricedCount === b.unpricedCount &&
    a.unpricedInvestedPaise === b.unpricedInvestedPaise &&
    areTotalsEqual(a.totals, b.totals)
  );
}

function calculateSummary(holdings: Holding[], quotes: QuotesState): PortfolioSummary {
  const rows = holdings.map((h) => rowMetrics(h, quotes[h.symbol] ?? null));
  return summarize(rows);
}

/**
 * Functional factory for a throttled derived portfolio summary store.
 *
 * Architecture:
 * - 100% functional closures (zero ES6 classes, zero `this`).
 * - Derives portfolio totals by summing already-rounded rows over priced holdings.
 * - Throttles price tick updates to ~4 Hz (250 ms) to eliminate summary re-render thrash at 20 Hz.
 * - Recomputes immediately upon user-initiated holdings change (buy/sell).
 * - Preserves reference stability for useSyncExternalStore when values are unchanged.
 */
export function createSummaryStore(options: SummaryStoreOptions = {}): SummaryStore {
  const priceStore = options.priceStore ?? defaultPriceStore;
  const portfolioStore = options.portfolioStore ?? defaultPortfolioStore;
  const throttleMs = options.throttleMs ?? 250;

  const listeners = new Set<() => void>();

  let currentSummary: PortfolioSummary = calculateSummary(
    portfolioStore.getHoldings(),
    priceStore.getQuotes()
  );

  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  let hasPendingTick = false;

  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const recomputeImmediately = (): void => {
    if (throttleTimer !== null) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
    hasPendingTick = false;

    const nextSummary = calculateSummary(
      portfolioStore.getHoldings(),
      priceStore.getQuotes()
    );

    if (!areSummariesEqual(currentSummary, nextSummary)) {
      currentSummary = nextSummary;
      notify();
    }
  };

  const handlePriceTick = (): void => {
    hasPendingTick = true;

    if (throttleTimer === null) {
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        if (hasPendingTick) {
          hasPendingTick = false;
          const nextSummary = calculateSummary(
            portfolioStore.getHoldings(),
            priceStore.getQuotes()
          );

          if (!areSummariesEqual(currentSummary, nextSummary)) {
            currentSummary = nextSummary;
            notify();
          }
        }
      }, throttleMs);
    }
  };

  // Subscriptions to underlying stores
  const unsubPrices = priceStore.subscribeAll(handlePriceTick);
  const unsubHoldings = portfolioStore.subscribeHoldings(recomputeImmediately);

  const getSnapshot = (): PortfolioSummary => {
    return currentSummary;
  };

  const subscribe = (callback: () => void): (() => void) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  };

  const destroy = (): void => {
    if (throttleTimer !== null) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
    unsubPrices();
    unsubHoldings();
    listeners.clear();
  };

  return {
    getSnapshot,
    subscribe,
    recompute: recomputeImmediately,
    destroy,
  };
}

/**
 * Creates a reactive useSummary hook wired to a SummaryStore.
 */
export function createSummaryHook(store: SummaryStore) {
  return function useSummary(): PortfolioSummary {
    const subscribe = useCallback(
      (cb: () => void) => store.subscribe(cb),
      []
    );
    const getSnapshot = useCallback(
      () => store.getSnapshot(),
      []
    );
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  };
}

// Global default summary store singleton
export const summaryStore = createSummaryStore();

// Default global React hook
export const useSummary = createSummaryHook(summaryStore);
