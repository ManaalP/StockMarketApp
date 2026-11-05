import { useSyncExternalStore, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALLOWED_SYMBOLS } from '../data/constants';

export const WATCHLIST_STORAGE_KEY = '@live_portfolio_watchlist';

/**
 * Safe starting watchlist defaults if no prior configuration is found.
 */
export const DEFAULT_WATCHLIST_SYMBOLS: readonly string[] = [
  'RELIANCE',
  'TCS',
  'HDFCBANK',
  'INFY',
];

export interface StorageBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface WatchlistStoreOptions {
  readonly storage?: StorageBackend;
  readonly defaultSymbols?: readonly string[];
}

export interface WatchlistStore {
  list(): string[];
  has(symbol: string): boolean;
  add(symbol: string): Promise<boolean>;
  remove(symbol: string): Promise<boolean>;
  setSymbols(symbols: readonly string[]): Promise<void>;
  isLoaded(): boolean;
  hydrate(): Promise<void>;
  subscribe(callback: () => void): () => void;
}

function isAllowed(symbol: string): boolean {
  return (ALLOWED_SYMBOLS as readonly string[]).includes(symbol);
}

/**
 * Functional factory for persistent Watchlist store.
 *
 * Architecture:
 * - 100% functional closures (no ES6 classes, no `this`).
 * - Persisted using AsyncStorage, with dependency injection for testability.
 * - Strictly restricted to the 25 allowed NSE symbols (rejects unlisted stocks like OLDCO).
 * - Immutably updates state and returns referentially stable snapshots for useSyncExternalStore.
 * - Handles corrupted storage JSON gracefully by falling back to an empty list.
 */
export function createWatchlistStore(options: WatchlistStoreOptions = {}): WatchlistStore {
  const storage: StorageBackend = options.storage ?? AsyncStorage;
  const defaultSymbols = options.defaultSymbols ?? DEFAULT_WATCHLIST_SYMBOLS;

  let symbols: string[] = [];
  let isLoaded = false;
  let snapshot: string[] = [];

  const listeners = new Set<() => void>();

  const notify = (): void => {
    snapshot = [...symbols];
    for (const listener of listeners) {
      listener();
    }
  };

  const persist = async (nextSymbols: string[]): Promise<void> => {
    try {
      await storage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(nextSymbols));
    } catch {
      // Storage failure is non-fatal to memory state
    }
  };

  const hydrate = async (): Promise<void> => {
    try {
      const raw = await storage.getItem(WATCHLIST_STORAGE_KEY);
      if (raw === null) {
        // Safe default on fresh install
        symbols = [...defaultSymbols].filter(isAllowed);
      } else {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          symbols = parsed.filter((item): item is string => typeof item === 'string' && isAllowed(item));
        } else {
          // Non-array JSON falls back to empty list
          symbols = [];
        }
      }
    } catch {
      // Corrupt JSON parsing error falls back to empty list
      symbols = [];
    } finally {
      isLoaded = true;
      notify();
    }
  };

  const list = (): string[] => {
    return snapshot;
  };

  const has = (symbol: string): boolean => {
    return symbols.includes(symbol);
  };

  const add = async (symbol: string): Promise<boolean> => {
    if (!isAllowed(symbol)) {
      return false;
    }
    if (symbols.includes(symbol)) {
      return false;
    }

    symbols = [...symbols, symbol];
    notify();
    await persist(symbols);
    return true;
  };

  const remove = async (symbol: string): Promise<boolean> => {
    if (!symbols.includes(symbol)) {
      return false;
    }

    symbols = symbols.filter((s) => s !== symbol);
    notify();
    await persist(symbols);
    return true;
  };

  const setSymbols = async (nextSymbols: readonly string[]): Promise<void> => {
    symbols = Array.from(new Set(nextSymbols.filter(isAllowed)));
    isLoaded = true;
    notify();
    await persist(symbols);
  };

  const subscribe = (callback: () => void): (() => void) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  };

  return {
    list,
    has,
    add,
    remove,
    setSymbols,
    isLoaded: () => isLoaded,
    hydrate,
    subscribe,
  };
}

/**
 * Functional factory to generate React hooks for a WatchlistStore instance.
 */
export function createWatchlistHooks(store: WatchlistStore) {
  function useWatchlist() {
    const subscribe = useCallback(
      (notify: () => void) => store.subscribe(notify),
      []
    );
    const getSnapshot = useCallback(
      () => store.list(),
      []
    );

    const symbols = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    const add = useCallback((s: string) => store.add(s), []);
    const remove = useCallback((s: string) => store.remove(s), []);
    const has = useCallback((s: string) => store.has(s), []);
    const toggleSymbol = useCallback(
      async (s: string) => {
        if (store.has(s)) {
          return store.remove(s);
        }
        return store.add(s);
      },
      []
    );

    return {
      symbols,
      isLoaded: store.isLoaded(),
      add,
      remove,
      has,
      addSymbol: add,
      removeSymbol: remove,
      toggleSymbol,
    };
  }

  function useIsInWatchlist(symbol: string): boolean {
    const subscribe = useCallback(
      (notify: () => void) => store.subscribe(notify),
      []
    );
    const getSnapshot = useCallback(
      () => store.has(symbol),
      [symbol]
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  return {
    useWatchlist,
    useIsInWatchlist,
  };
}

// Global default watchlist store instance
export const watchlistStore = createWatchlistStore();

// Eagerly hydrate watchlist from storage on startup
void watchlistStore.hydrate();

// Default global React hooks
export const {
  useWatchlist,
  useIsInWatchlist,
} = createWatchlistHooks(watchlistStore);
