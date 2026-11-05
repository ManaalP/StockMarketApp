import { useSyncExternalStore, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Holding, Order } from '../domain/types';
import { applyOrder } from '../domain/calcs';
import { parseHoldingsCsv } from '../data/holdingsParser';
import { STARTING_HOLDINGS_CSV } from '../data/rawHoldings';
import { INITIAL_FETCH_SYMBOLS } from '../data/constants';
import { priceStore as defaultPriceStore, type PriceStore } from './priceStore';
import { ohlcClient as defaultOhlcClient, type OhlcClient, type OhlcError } from '../api/ohlcClient';
import type { PriceFeed } from '../feed/types';
import { createSimulatedFeed } from '../feed/SimulatedFeed';
import { createResilientFeed } from '../feed/resilientFeed';
import { orderStore as defaultOrderStore, type OrderStore } from './orderStore';
import type { StorageBackend } from './watchlistStore';

export const PORTFOLIO_STORAGE_KEY = 'portfolio:v1';

export type AppStatus = 'idle' | 'loading' | 'ready' | 'error';
export type HydrationStatus = 'loading' | 'ready';

export interface PortfolioSnapshot {
  readonly version: number;
  readonly holdings: Holding[];
  readonly orders: Order[];
}

export interface PortfolioStoreOptions {
  readonly storage?: StorageBackend;
  readonly initialHoldings?: Holding[];
  readonly priceStore?: PriceStore;
  readonly apiClient?: OhlcClient;
  readonly feed?: PriceFeed;
  readonly orderStore?: OrderStore;
}

export interface PortfolioStore {
  getHoldings(): Holding[];
  getHolding(symbol: string): Holding | undefined;
  getStatus(): AppStatus;
  getError(): OhlcError | null;
  getStatusSnapshot(): { readonly status: AppStatus; readonly error: OhlcError | null };
  getHydrationStatus(): HydrationStatus;
  isHydrated(): boolean;
  getOrders(): Order[];
  subscribeHoldings(callback: () => void): () => void;
  subscribeStatus(callback: () => void): () => void;
  subscribeHydration(callback: () => void): () => void;
  executeOrder(order: Order): Promise<void>;
  hydrate(): Promise<void>;
  resetPortfolio(): Promise<void>;
  bootstrap(): Promise<void>;
  refresh(): Promise<void>;
  retry(): Promise<void>;
  getFeed(): PriceFeed | undefined;
}

/**
 * Functional factory for managing stock holdings, order execution, and storage persistence.
 *
 * Architecture:
 * - 100% functional closure state (zero classes, zero `this`).
 * - Hydrates portfolio holdings and orders from AsyncStorage key "portfolio:v1".
 * - On first launch or corrupted data, seeds from holdings.csv and saves snapshot.
 * - Every applyOrder write is enqueued through a serialized write queue (latest wins).
 * - Live prices and market ticks are NEVER stored in the persistence snapshot.
 * - Single initial REST fetch on bootstrap.
 * - Pull-to-refresh re-fetches OHLC and preserves per-symbol sequence numbers in PriceStore.
 * - Provides reactive hooks via useSyncExternalStore.
 */
export function createPortfolioStore(options: PortfolioStoreOptions = {}): PortfolioStore {
  const storage: StorageBackend = options.storage ?? AsyncStorage;
  const priceStore = options.priceStore ?? defaultPriceStore;
  const apiClient = options.apiClient ?? defaultOhlcClient;
  const orderStore = options.orderStore ?? defaultOrderStore;
  let feed = options.feed;

  let holdings: Holding[] = options.initialHoldings ?? parseHoldingsCsv(STARTING_HOLDINGS_CSV);
  let orders: Order[] = [];
  let status: AppStatus = 'idle';
  let hydrationStatus: HydrationStatus = 'loading';
  let error: OhlcError | null = null;
  let statusSnapshot: { readonly status: AppStatus; readonly error: OhlcError | null } = {
    status: 'idle',
    error: null,
  };

  const holdingsListeners = new Set<() => void>();
  const statusListeners = new Set<() => void>();
  const hydrationListeners = new Set<() => void>();

  // Serialized write queue ensuring no concurrent writes and that latest snapshot always wins
  let writePromise: Promise<void> = Promise.resolve();
  let pendingSnapshot: PortfolioSnapshot | null = null;
  let isWriting = false;

  const enqueuePersist = (snapshot: PortfolioSnapshot): Promise<void> => {
    pendingSnapshot = snapshot;
    if (isWriting) {
      return writePromise;
    }
    isWriting = true;
    writePromise = (async () => {
      while (pendingSnapshot) {
        const toWrite = pendingSnapshot;
        pendingSnapshot = null;
        try {
          await storage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(toWrite));
        } catch (err) {
          console.error('Failed to persist portfolio snapshot', err);
        }
      }
      isWriting = false;
    })();
    return writePromise;
  };

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

  const notifyHydration = (): void => {
    for (const listener of hydrationListeners) {
      listener();
    }
  };

  const getHoldings = (): Holding[] => holdings;

  const getHolding = (symbol: string): Holding | undefined => {
    return holdings.find((h) => h.symbol === symbol);
  };

  const getStatus = (): AppStatus => status;

  const getError = (): OhlcError | null => error;

  const getHydrationStatus = (): HydrationStatus => hydrationStatus;

  const isHydrated = (): boolean => hydrationStatus === 'ready';

  const getOrders = (): Order[] => [...orders];

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

  const subscribeHydration = (callback: () => void): (() => void) => {
    hydrationListeners.add(callback);
    return () => {
      hydrationListeners.delete(callback);
    };
  };

  const hydrate = async (): Promise<void> => {
    try {
      const raw = await storage.getItem(PORTFOLIO_STORAGE_KEY);
      if (!raw) {
        // First launch: seed from CSV and write snapshot
        const seedHoldings = parseHoldingsCsv(STARTING_HOLDINGS_CSV);
        holdings = seedHoldings;
        orders = [];
        await storage.setItem(
          PORTFOLIO_STORAGE_KEY,
          JSON.stringify({ version: 1, holdings: seedHoldings, orders: [] })
        );
      } else {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.holdings)) {
          holdings = parsed.holdings.map((h: Record<string, unknown>) => ({
            symbol: String(h.symbol),
            qty: Number(h.qty),
            avgPaise: Number(h.avgPaise),
          }));
          orders = Array.isArray(parsed.orders)
            ? parsed.orders.map((o: Record<string, unknown>) => ({
                side: o.side === 'SELL' ? 'SELL' : 'BUY',
                symbol: String(o.symbol),
                qty: Number(o.qty),
                fillPaise: Number(o.fillPaise),
              }))
            : [];
        } else {
          // Corrupted payload structure: fallback to CSV seed
          const seedHoldings = parseHoldingsCsv(STARTING_HOLDINGS_CSV);
          holdings = seedHoldings;
          orders = [];
          await storage.setItem(
            PORTFOLIO_STORAGE_KEY,
            JSON.stringify({ version: 1, holdings: seedHoldings, orders: [] })
          );
        }
      }
    } catch {
      // Corrupt JSON: fallback to CSV seed
      const seedHoldings = parseHoldingsCsv(STARTING_HOLDINGS_CSV);
      holdings = seedHoldings;
      orders = [];
      try {
        await storage.setItem(
          PORTFOLIO_STORAGE_KEY,
          JSON.stringify({ version: 1, holdings: seedHoldings, orders: [] })
        );
      } catch {
        // Storage unreachable
      }
    } finally {
      hydrationStatus = 'ready';
      notifyHydration();
      notifyHoldings();
    }
  };

  const executeOrder = async (order: Order): Promise<void> => {
    holdings = applyOrder(holdings, order);
    orders = [order, ...orders];
    notifyHoldings();
    void orderStore.recordOrder(order);
    await enqueuePersist({
      version: 1,
      holdings,
      orders,
    });
  };

  const resetPortfolio = async (): Promise<void> => {
    const seedHoldings = parseHoldingsCsv(STARTING_HOLDINGS_CSV);
    holdings = seedHoldings;
    orders = [];
    notifyHoldings();
    await storage.setItem(
      PORTFOLIO_STORAGE_KEY,
      JSON.stringify({ version: 1, holdings: seedHoldings, orders: [] })
    );
  };

  const bootstrap = async (): Promise<void> => {
    setStatus('loading', null);

    // Ensure storage hydration has completed
    if (hydrationStatus !== 'ready') {
      await hydrate();
    }

    const result = await apiClient.fetchOhlc([...INITIAL_FETCH_SYMBOLS]);
    if (!result.ok) {
      setStatus('error', result.error);
      return;
    }

    priceStore.seed(result.quotes);

    if (!feed) {
      feed = createResilientFeed(createSimulatedFeed(result.quotes), {
        catchUpFetch: async () => {
          const res = await apiClient.fetchOhlc([...INITIAL_FETCH_SYMBOLS]);
          return res.ok ? res.quotes : {};
        },
        onCatchUp: (quotes) => {
          priceStore.seed(quotes);
        },
      });
    }

    priceStore.connectFeed(feed);

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

  const getFeed = (): PriceFeed | undefined => feed;

  return {
    getHoldings,
    getHolding,
    getStatus,
    getError,
    getStatusSnapshot,
    getHydrationStatus,
    isHydrated,
    getOrders,
    subscribeHoldings,
    subscribeStatus,
    subscribeHydration,
    executeOrder,
    hydrate,
    resetPortfolio,
    bootstrap,
    refresh,
    retry,
    getFeed,
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

  function usePortfolioHydration(): HydrationStatus {
    const subscribe = useCallback(
      (notify: () => void) => store.subscribeHydration(notify),
      []
    );
    const getSnapshot = useCallback(
      () => store.getHydrationStatus(),
      []
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

    const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const hydration = usePortfolioHydration();

    const refresh = useCallback(async () => {
      await store.refresh();
    }, []);

    const retry = useCallback(async () => {
      await store.retry();
    }, []);

    return {
      status: current.status,
      error: current.error,
      hydrationStatus: hydration,
      refresh,
      retry,
    };
  }

  return {
    usePortfolioHoldings,
    useHolding,
    usePortfolioHydration,
    useAppStatus,
  };
}

// Global default portfolio store instance
export const portfolioStore = createPortfolioStore();

// Eagerly hydrate portfolio on module load
void portfolioStore.hydrate();

// Default global React hooks
export const {
  usePortfolioHoldings,
  useHolding,
  usePortfolioHydration,
  useAppStatus,
} = createPortfolioHooks(portfolioStore);
