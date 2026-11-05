import { useSyncExternalStore, useCallback } from 'react';
import type { Holding, Order } from '../domain/types';
import { applyOrder } from '../domain/calcs';
import { parseHoldingsCsv } from '../data/holdingsParser';
import { STARTING_HOLDINGS_CSV } from '../data/rawHoldings';
import { INITIAL_FETCH_SYMBOLS } from '../data/constants';
import { priceStore as defaultPriceStore, type PriceStore } from './priceStore';
import { ohlcClient as defaultOhlcClient, type OhlcClient, type OhlcError } from '../api/ohlcClient';
import type { PriceFeed } from '../feed/types';

export type AppStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PortfolioStoreOptions {
  readonly initialHoldings?: Holding[];
  readonly priceStore?: PriceStore;
  readonly apiClient?: OhlcClient;
  readonly feed?: PriceFeed;
}

export interface PortfolioStore {
  getHoldings(): Holding[];
  getHolding(symbol: string): Holding | undefined;
  getStatus(): AppStatus;
  getError(): OhlcError | null;
  getStatusSnapshot(): { readonly status: AppStatus; readonly error: OhlcError | null };
  subscribeHoldings(callback: () => void): () => void;
  subscribeStatus(callback: () => void): () => void;
  executeOrder(order: Order): void;
  bootstrap(): Promise<void>;
  refresh(): Promise<void>;
  retry(): Promise<void>;
}

/**
 * Functional factory for managing stock holdings and application initialization status.
 *
 * Architecture:
 * - 100% functional closure state (zero classes, zero `this`).
 * - Manages portfolio positions and executes orders using pure domain applyOrder.
 * - Single initial REST fetch on bootstrap.
 * - Pull-to-refresh re-fetches OHLC and preserves per-symbol sequence numbers in PriceStore.
 * - Provides reactive hooks via useSyncExternalStore.
 */
export function createPortfolioStore(options: PortfolioStoreOptions = {}): PortfolioStore {
  const priceStore = options.priceStore ?? defaultPriceStore;
  const apiClient = options.apiClient ?? defaultOhlcClient;
  const feed = options.feed;

  let holdings: Holding[] = options.initialHoldings ?? parseHoldingsCsv(STARTING_HOLDINGS_CSV);
  let status: AppStatus = 'idle';
  let error: OhlcError | null = null;
  let statusSnapshot: { readonly status: AppStatus; readonly error: OhlcError | null } = {
    status: 'idle',
    error: null,
  };

  const holdingsListeners = new Set<() => void>();
  const statusListeners = new Set<() => void>();

  const setStatus = (nextStatus: AppStatus, nextError: OhlcError | null = null): void => {
    status = nextStatus;
    error = nextError;
    statusSnapshot = { status: nextStatus, error: nextError };
    for (const listener of statusListeners) {
      listener();
    }
  };

  const getStatusSnapshot = () => statusSnapshot;

  const notifyHoldings = (): void => {
    for (const listener of holdingsListeners) {
      listener();
    }
  };

  const getHoldings = (): Holding[] => {
    return holdings;
  };

  const getHolding = (symbol: string): Holding | undefined => {
    return holdings.find((h) => h.symbol === symbol);
  };

  const getStatus = (): AppStatus => {
    return status;
  };

  const getError = (): OhlcError | null => {
    return error;
  };

  const subscribeHoldings = (callback: () => void): (() => void) => {
    holdingsListeners.add(callback);
    return () => {
      holdingsListeners.delete(callback);
    };
  };

  const subscribeStatus = (callback: () => void): (() => void) => {
    statusListeners.add(callback);
    return () => {
      statusListeners.delete(callback);
    };
  };

  const executeOrder = (order: Order): void => {
    holdings = applyOrder(holdings, order);
    notifyHoldings();
  };

  const bootstrap = async (): Promise<void> => {
    setStatus('loading', null);

    const result = await apiClient.fetchOhlc([...INITIAL_FETCH_SYMBOLS]);
    if (!result.ok) {
      setStatus('error', result.error);
      return;
    }

    priceStore.seed(result.quotes);

    if (feed) {
      priceStore.connectFeed(feed);
    }

    setStatus('ready', null);
  };

  const refresh = async (): Promise<void> => {
    const result = await apiClient.fetchOhlc([...INITIAL_FETCH_SYMBOLS]);
    if (result.ok) {
      // Re-seeding priceStore retains existing per-symbol seq numbers so ticks remain monotonic
      priceStore.seed(result.quotes);
    }
  };

  const retry = async (): Promise<void> => {
    await bootstrap();
  };

  return {
    getHoldings,
    getHolding,
    getStatus,
    getError,
    getStatusSnapshot,
    subscribeHoldings,
    subscribeStatus,
    executeOrder,
    bootstrap,
    refresh,
    retry,
  };
}

/**
 * Functional factory to generate React hooks for a PortfolioStore instance.
 */
export function createPortfolioHooks(store: PortfolioStore) {
  function usePortfolioHoldings(): Holding[] {
    const subscribe = useCallback(
      (notify: () => void) => store.subscribeHoldings(notify),
      []
    );
    const getSnapshot = useCallback(
      () => store.getHoldings(),
      []
    );
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  function useHolding(symbol: string): Holding | undefined {
    const subscribe = useCallback(
      (notify: () => void) => store.subscribeHoldings(notify),
      []
    );
    const getSnapshot = useCallback(
      () => store.getHolding(symbol),
      [symbol]
    );
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  function useAppStatus() {
    const subscribe = useCallback(
      (notify: () => void) => store.subscribeStatus(notify),
      []
    );
    const getSnapshot = useCallback(
      () => store.getStatusSnapshot(),
      []
    );

    // Track status snapshot
    const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    const refresh = useCallback(async () => {
      await store.refresh();
    }, []);

    const retry = useCallback(async () => {
      await store.retry();
    }, []);

    return {
      status: current.status,
      error: current.error,
      refresh,
      retry,
    };
  }

  return {
    usePortfolioHoldings,
    useHolding,
    useAppStatus,
  };
}

// Global default portfolio store instance
export const portfolioStore = createPortfolioStore();

// Default global React hooks
export const {
  usePortfolioHoldings,
  useHolding,
  useAppStatus,
} = createPortfolioHooks(portfolioStore);
