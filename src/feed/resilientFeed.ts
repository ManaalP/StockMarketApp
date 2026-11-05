import type { PriceFeed, TickHandler, FeedStatus, FeedStatusHandler } from './types';
import type { Quote } from '../domain/types';
import { computeBackoffDelay } from '../domain/backoff';

export interface ResilientFeedOptions {
  /**
   * Called exactly ONCE upon successful reconnection to fetch OHLC catch-up data.
   * Single catch-up fetch only, never polled.
   */
  readonly catchUpFetch?: () => Promise<Record<string, Quote>>;

  /**
   * Callback invoked with the fresh catch-up snapshot.
   */
  readonly onCatchUp?: (quotes: Record<string, Quote>) => void;

  /**
   * Base delay for exponential backoff in ms. Default: 1000 ms.
   */
  readonly baseDelayMs?: number;

  /**
   * Maximum delay cap in ms. Default: 15000 ms.
   */
  readonly maxDelayMs?: number;

  /**
   * Maximum reconnect attempts before giving up. Default: 10.
   */
  readonly maxAttempts?: number;

  /**
   * RNG for backoff jitter.
   */
  readonly rng?: () => number;
}

export interface ResilientFeed extends PriceFeed {
  getStatus(): FeedStatus;
  onStatusChange(handler: FeedStatusHandler): () => void;
  getAttemptCount(): number;
}

/**
 * Functional factory creating a resilient PriceFeed wrapper.
 *
 * Architecture:
 * - Wraps any underlying PriceFeed implementation (Simulated or WebSocket).
 * - Automatic reconnection with exponential backoff and jitter on unexpected drops.
 * - Executes a single catch-up fetch upon reconnecting, seeding latest quotes without polling.
 * - Prevents auto-reconnect when disconnected intentionally via `disconnect()`.
 */
export function createResilientFeed(
  underlyingFeed: PriceFeed,
  options: ResilientFeedOptions = {}
): ResilientFeed {
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 15000;
  const maxAttempts = options.maxAttempts ?? 10;
  const rng = options.rng ?? Math.random;

  const tickListeners = new Set<TickHandler>();
  const statusListeners = new Set<FeedStatusHandler>();

  let status: FeedStatus = 'disconnected';
  let isIntentionalDisconnect = false;
  let attemptCount = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribeTicks: (() => void) | null = null;
  let unsubscribeStatus: (() => void) | null = null;

  const setStatus = (next: FeedStatus): void => {
    if (status === next) return;
    status = next;
    for (const listener of statusListeners) {
      listener(status);
    }
  };

  const scheduleReconnect = (): void => {
    if (isIntentionalDisconnect || attemptCount >= maxAttempts) {
      return;
    }

    setStatus('reconnecting');
    const delay = computeBackoffDelay(attemptCount, baseDelayMs, maxDelayMs, rng);

    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
    }

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void executeReconnect();
    }, delay);
  };

  const executeReconnect = async (): Promise<void> => {
    if (isIntentionalDisconnect) return;

    try {
      underlyingFeed.connect();

      // Perform single catch-up fetch if configured
      if (options.catchUpFetch) {
        const catchUpQuotes = await options.catchUpFetch();
        options.onCatchUp?.(catchUpQuotes);
      }

      attemptCount = 0;
      setStatus('connected');
    } catch {
      attemptCount++;
      scheduleReconnect();
    }
  };

  // Attach listeners to underlying feed
  const attachUnderlyingListeners = (): void => {
    if (unsubscribeTicks === null) {
      unsubscribeTicks = underlyingFeed.onTick((tick) => {
        for (const listener of tickListeners) {
          listener(tick);
        }
      });
    }

    if (unsubscribeStatus === null && underlyingFeed.onStatusChange) {
      unsubscribeStatus = underlyingFeed.onStatusChange((underlyingStatus) => {
        if (underlyingStatus === 'disconnected' && !isIntentionalDisconnect) {
          scheduleReconnect();
        }
      });
    }
  };

  const detachUnderlyingListeners = (): void => {
    if (unsubscribeTicks !== null) {
      unsubscribeTicks();
      unsubscribeTicks = null;
    }
    if (unsubscribeStatus !== null) {
      unsubscribeStatus();
      unsubscribeStatus = null;
    }
  };

  // Initially attach listeners
  attachUnderlyingListeners();

  const connect = (): void => {
    isIntentionalDisconnect = false;
    attemptCount = 0;
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    attachUnderlyingListeners();
    underlyingFeed.connect();
    setStatus('connected');
  };

  const disconnect = (): void => {
    isIntentionalDisconnect = true;
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    detachUnderlyingListeners();
    underlyingFeed.disconnect();
    setStatus('disconnected');
  };

  const simulateDisconnect = (): void => {
    if (underlyingFeed.simulateDisconnect) {
      underlyingFeed.simulateDisconnect();
    } else {
      underlyingFeed.disconnect();
      if (!isIntentionalDisconnect) {
        scheduleReconnect();
      }
    }
  };

  const onTick = (handler: TickHandler): (() => void) => {
    tickListeners.add(handler);
    return () => {
      tickListeners.delete(handler);
    };
  };

  const onStatusChange = (handler: FeedStatusHandler): (() => void) => {
    statusListeners.add(handler);
    return () => {
      statusListeners.delete(handler);
    };
  };

  const getStatus = (): FeedStatus => status;
  const getAttemptCount = (): number => attemptCount;

  return {
    connect,
    disconnect,
    onTick,
    onStatusChange,
    getStatus,
    simulateDisconnect,
    getAttemptCount,
  };
}
