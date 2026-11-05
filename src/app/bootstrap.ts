import { priceStore } from '../stores/priceStore';
import { portfolioStore } from '../stores/portfolioStore';
import { createSimulatedFeed } from '../feed/SimulatedFeed';
import { createResilientFeed } from '../feed/resilientFeed';
import { ohlcClient } from '../api/ohlcClient';
import { INITIAL_FETCH_SYMBOLS } from '../data/constants';
import type { PriceFeed } from '../feed/types';
import type { Quote } from '../domain/types';

export interface BootstrapResult {
  readonly priceStore: typeof priceStore;
  readonly portfolioStore: typeof portfolioStore;
  readonly feed: PriceFeed;
  readonly disconnect: () => void;
}

/**
 * Composition root for the Live Portfolio application.
 *
 * This is the ONLY link in the entire application where the feed is coupled to the store.
 * Screens and components consume stores and hooks directly and have zero knowledge of the feed source.
 */
export function bootstrapApp(
  initialQuotes: Record<string, Quote> = {},
  customFeed?: PriceFeed
): BootstrapResult {
  if (Object.keys(initialQuotes).length > 0) {
    priceStore.seed(initialQuotes);
  }

  const rawFeed = customFeed ?? createSimulatedFeed(initialQuotes);
  // Custom feeds supplied in tests are used directly; simulated feeds are wrapped with resiliency
  const feed = customFeed
    ? customFeed
    : createResilientFeed(rawFeed, {
        catchUpFetch: async () => {
          const res = await ohlcClient.fetchOhlc([...INITIAL_FETCH_SYMBOLS]);
          return res.ok ? res.quotes : {};
        },
        onCatchUp: (quotes) => {
          priceStore.seed(quotes);
        },
      });

  const disconnect = priceStore.connectFeed(feed);

  return {
    priceStore,
    portfolioStore,
    feed,
    disconnect,
  };
}
