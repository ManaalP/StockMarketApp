import { priceStore } from '../stores/priceStore';
import { portfolioStore } from '../stores/portfolioStore';
import { createSimulatedFeed } from '../feed/SimulatedFeed';
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

  const feed = customFeed ?? createSimulatedFeed(initialQuotes);
  const disconnect = priceStore.connectFeed(feed);

  return {
    priceStore,
    portfolioStore,
    feed,
    disconnect,
  };
}

/**
 * Starts the application with live simulated feed initialized from real REST market quotes.
 */
export async function startLiveApp(customFeed?: PriceFeed): Promise<BootstrapResult> {
  await portfolioStore.bootstrap();
  const quotes = priceStore.getQuotes();
  const feed = customFeed ?? createSimulatedFeed(quotes);
  const disconnect = priceStore.connectFeed(feed);
  return {
    priceStore,
    portfolioStore,
    feed,
    disconnect,
  };
}

export default function BootstrapRoute() {
  return null;
}

