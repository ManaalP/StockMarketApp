import { useSyncExternalStore, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Order } from '../domain/types';
import { mulQty, type Paise } from '../domain/money';
import type { StorageBackend } from './watchlistStore';

export const ORDER_HISTORY_STORAGE_KEY = '@live_portfolio_order_history_v1';

export interface ExecutedOrder {
  readonly id: string;
  readonly side: 'BUY' | 'SELL';
  readonly symbol: string;
  readonly qty: number;
  readonly pricePaise: Paise;
  readonly targetPaise?: Paise;
  readonly type?: 'MARKET' | 'LIMIT';
  readonly status?: 'EXECUTED' | 'PENDING' | 'CANCELLED' | 'FAILED';
  readonly failureReason?: string;
  readonly totalPaise: Paise;
  readonly timestamp: number;
}

export interface OrderStoreOptions {
  readonly storage?: StorageBackend;
}

export interface OrderStore {
  recordOrder(order: Order, id?: string, timestamp?: number): Promise<ExecutedOrder>;
  getOrders(): readonly ExecutedOrder[];
  isLoaded(): boolean;
  hydrate(): Promise<void>;
  clearOrders(): Promise<void>;
  subscribe(callback: () => void): () => void;
}

/**
 * Functional factory for persistent Order History store.
 *
 * Architecture:
 * - 100% functional closure state (no classes, no `this`).
 * - Persisted using AsyncStorage with pluggable StorageBackend for unit tests.
 * - Stores executed trades in reverse-chronological order (newest first).
 * - Safe JSON parsing with empty list fallback on corruption.
 * - Provides reactive snapshots for useSyncExternalStore.
 */
export function createOrderStore(options: OrderStoreOptions = {}): OrderStore {
  const storage: StorageBackend = options.storage ?? AsyncStorage;

  let orders: ExecutedOrder[] = [];
  let isLoaded = false;
  let snapshot: ExecutedOrder[] = [];
  const listeners = new Set<() => void>();

  const updateSnapshot = (nextOrders: ExecutedOrder[]): void => {
    orders = nextOrders;
    snapshot = [...nextOrders];
    for (const listener of listeners) {
      listener();
    }
  };

  const persist = async (nextOrders: ExecutedOrder[]): Promise<void> => {
    try {
      await storage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(nextOrders));
    } catch {
      // Storage errors fail silently without corrupting domain state
    }
  };

  const hydrate = async (): Promise<void> => {
    try {
      const raw = await storage.getItem(ORDER_HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const validated: ExecutedOrder[] = [];
          for (const item of parsed) {
            if (
              typeof item === 'object' &&
              item !== null &&
              'id' in item &&
              'symbol' in item &&
              'side' in item &&
              'qty' in item &&
              'pricePaise' in item &&
              'totalPaise' in item &&
              'timestamp' in item
            ) {
              const obj = item as Record<string, unknown>;
              validated.push({
                id: String(obj.id),
                symbol: String(obj.symbol),
                side: obj.side === 'SELL' ? 'SELL' : 'BUY',
                qty: Number(obj.qty),
                pricePaise: Number(obj.pricePaise),
                targetPaise: typeof obj.targetPaise === 'number' ? obj.targetPaise : undefined,
                type: obj.type === 'LIMIT' ? 'LIMIT' : 'MARKET',
                status:
                  obj.status === 'PENDING'
                    ? 'PENDING'
                    : obj.status === 'FAILED'
                    ? 'FAILED'
                    : 'EXECUTED',
                failureReason: typeof obj.failureReason === 'string' ? obj.failureReason : undefined,
                totalPaise: Number(obj.totalPaise),
                timestamp: Number(obj.timestamp),
              });
            }
          }
          orders = validated;
          snapshot = [...validated];
        }
      }
    } catch {
      // Corrupt storage falls back to empty array
      orders = [];
      snapshot = [];
    } finally {
      isLoaded = true;
      for (const listener of listeners) {
        listener();
      }
    }
  };

  const recordOrder = async (
    order: Order,
    id?: string,
    timestamp?: number
  ): Promise<ExecutedOrder> => {
    const existingIndex = order.id ? orders.findIndex((o) => o.id === order.id) : -1;
    const executed: ExecutedOrder = {
      id: order.id ?? id ?? `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      symbol: order.symbol,
      side: order.side,
      qty: order.qty,
      pricePaise: order.fillPaise,
      targetPaise: order.targetPaise,
      type: order.type ?? 'MARKET',
      status: order.status ?? 'EXECUTED',
      failureReason: order.failureReason,
      totalPaise: mulQty(order.targetPaise ?? order.fillPaise, order.qty),
      timestamp: timestamp ?? order.createdAt ?? Date.now(),
    };

    let nextOrders: ExecutedOrder[];
    if (existingIndex >= 0) {
      nextOrders = [...orders];
      nextOrders[existingIndex] = executed;
    } else {
      nextOrders = [executed, ...orders];
    }
    updateSnapshot(nextOrders);
    await persist(nextOrders);
    return executed;
  };

  const clearOrders = async (): Promise<void> => {
    updateSnapshot([]);
    try {
      await storage.removeItem(ORDER_HISTORY_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const getOrders = (): readonly ExecutedOrder[] => snapshot;
  const getIsLoaded = (): boolean => isLoaded;

  const subscribe = (callback: () => void): (() => void) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  };

  return {
    recordOrder,
    getOrders,
    isLoaded: getIsLoaded,
    hydrate,
    clearOrders,
    subscribe,
  };
}

// Global default order store instance
export const orderStore = createOrderStore();

// Automatically trigger background hydration on module load
void orderStore.hydrate();

/**
 * React hook to observe persisted order history.
 */
export function useOrderHistory(): readonly ExecutedOrder[] {
  const subscribe = useCallback(
    (notify: () => void) => orderStore.subscribe(notify),
    []
  );
  const getSnapshot = useCallback(
    () => orderStore.getOrders(),
    []
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
