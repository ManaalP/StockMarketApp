import {
  createPortfolioStore,
  PORTFOLIO_STORAGE_KEY,
  type PortfolioSnapshot,
} from '../../src/stores/portfolioStore';
import type { StorageBackend } from '../../src/stores/watchlistStore';

// In-memory mock storage backend for clean test isolation
function createMockStorage(initialData: Record<string, string> = {}): StorageBackend & {
  dump(): Record<string, string>;
  writeCount: number;
} {
  const store: Record<string, string> = { ...initialData };
  let writes = 0;
  return {
    async getItem(key: string): Promise<string | null> {
      return store[key] ?? null;
    },
    async setItem(key: string, value: string): Promise<void> {
      writes++;
      store[key] = value;
    },
    async removeItem(key: string): Promise<void> {
      delete store[key];
    },
    dump() {
      return { ...store };
    },
    get writeCount() {
      return writes;
    },
  };
}

describe('PortfolioStore Persistence & Hydration (PORT-PERSIST)', () => {

  test('first launch seeds holdings from CSV and saves snapshot to storage', async () => {
    const storage = createMockStorage();
    const store = createPortfolioStore({ storage });

    expect(store.getHydrationStatus()).toBe('loading');

    await store.hydrate();

    expect(store.getHydrationStatus()).toBe('ready');
    const holdings = store.getHoldings();
    expect(holdings).toHaveLength(21);
    expect(holdings.find((h) => h.symbol === 'RELIANCE')?.qty).toBe(25);
    expect(holdings.find((h) => h.symbol === 'OLDCO')?.qty).toBe(30);

    // Verify written to storage
    const storedRaw = await storage.getItem(PORTFOLIO_STORAGE_KEY);
    expect(storedRaw).not.toBeNull();
    const parsed = JSON.parse(storedRaw as string) as PortfolioSnapshot;
    expect(parsed.version).toBe(1);
    expect(parsed.holdings).toHaveLength(21);
    expect(parsed.orders).toEqual([]);
  });

  test('buy then reload shows the new holding and weighted average', async () => {
    const storage = createMockStorage();
    const store1 = createPortfolioStore({ storage });
    await store1.hydrate();

    // RELIANCE starts at qty: 25, avgPrice: 1319.59 => avgPaise: 131959
    // Buy 25 more @ 1500.00 (150000 paise)
    // New qty: 50, new avg: round((25 * 131959 + 25 * 150000) / 50) = 140980 paise
    await store1.executeOrder({
      side: 'BUY',
      symbol: 'RELIANCE',
      qty: 25,
      fillPaise: 150000,
    });

    const rel1 = store1.getHolding('RELIANCE');
    expect(rel1?.qty).toBe(50);
    expect(rel1?.avgPaise).toBe(140980);

    // Reload from storage with a new store instance
    const store2 = createPortfolioStore({ storage });
    await store2.hydrate();

    const rel2 = store2.getHolding('RELIANCE');
    expect(rel2?.qty).toBe(50);
    expect(rel2?.avgPaise).toBe(140980);
    expect(store2.getOrders()).toHaveLength(1);
    expect(store2.getOrders()[0]?.symbol).toBe('RELIANCE');
  });

  test('sell-all then reload has no holding', async () => {
    const storage = createMockStorage();
    const store1 = createPortfolioStore({ storage });
    await store1.hydrate();

    // RELIANCE has 25 shares. Sell all 25.
    await store1.executeOrder({
      side: 'SELL',
      symbol: 'RELIANCE',
      qty: 25,
      fillPaise: 160000,
    });

    expect(store1.getHolding('RELIANCE')).toBeUndefined();

    // Reload from storage
    const store2 = createPortfolioStore({ storage });
    await store2.hydrate();

    expect(store2.getHolding('RELIANCE')).toBeUndefined();
    expect(store2.getHoldings()).toHaveLength(20);
  });

  test('corrupt JSON falls back to CSV seed', async () => {
    const storage = createMockStorage({
      [PORTFOLIO_STORAGE_KEY]: '{ invalid_json: [[[',
    });

    const store = createPortfolioStore({ storage });
    await store.hydrate();

    expect(store.getHydrationStatus()).toBe('ready');
    expect(store.getHoldings()).toHaveLength(21);
    expect(store.getHolding('RELIANCE')?.qty).toBe(25);

    // Replaced corrupt JSON in storage with valid snapshot
    const storedRaw = await storage.getItem(PORTFOLIO_STORAGE_KEY);
    const parsed = JSON.parse(storedRaw as string) as PortfolioSnapshot;
    expect(parsed.version).toBe(1);
    expect(parsed.holdings).toHaveLength(21);
  });

  test('two rapid orders both persist in order through serialized write queue', async () => {
    const storage = createMockStorage();
    const store = createPortfolioStore({ storage });
    await store.hydrate();

    // Fire two rapid orders without waiting for the first write to complete
    const p1 = store.executeOrder({
      side: 'BUY',
      symbol: 'TCS',
      qty: 10,
      fillPaise: 300000,
    });
    const p2 = store.executeOrder({
      side: 'BUY',
      symbol: 'INFY',
      qty: 20,
      fillPaise: 150000,
    });

    await Promise.all([p1, p2]);

    // Reload with fresh store
    const reloaded = createPortfolioStore({ storage });
    await reloaded.hydrate();

    // TCS started with 40, now 50
    expect(reloaded.getHolding('TCS')?.qty).toBe(50);
    // INFY started with 10, now 30
    expect(reloaded.getHolding('INFY')?.qty).toBe(30);
    expect(reloaded.getOrders()).toHaveLength(2);
  });

  test('resetPortfolio restores the starting CSV state and clears stored orders', async () => {
    const storage = createMockStorage();
    const store = createPortfolioStore({ storage });
    await store.hydrate();

    // Make changes
    await store.executeOrder({
      side: 'BUY',
      symbol: 'TCS',
      qty: 100,
      fillPaise: 350000,
    });
    expect(store.getHolding('TCS')?.qty).toBe(140);

    // Reset portfolio
    await store.resetPortfolio();

    // Holdings back to 21 CSV original state
    expect(store.getHoldings()).toHaveLength(21);
    expect(store.getHolding('TCS')?.qty).toBe(40);
    expect(store.getOrders()).toHaveLength(0);

    // Reload from storage and verify persistence of reset
    const reloaded = createPortfolioStore({ storage });
    await reloaded.hydrate();
    expect(reloaded.getHolding('TCS')?.qty).toBe(40);
    expect(reloaded.getOrders()).toHaveLength(0);
  });

  test('prices are never persisted in the storage snapshot', async () => {
    const storage = createMockStorage();
    const store = createPortfolioStore({ storage });
    await store.hydrate();

    await store.executeOrder({
      side: 'BUY',
      symbol: 'RELIANCE',
      qty: 5,
      fillPaise: 200000,
    });

    const raw = await storage.getItem(PORTFOLIO_STORAGE_KEY);
    const parsed = JSON.parse(raw as string);

    // Only version, holdings (symbol, qty, avgPaise), orders
    expect(Object.keys(parsed).sort()).toEqual(['holdings', 'orders', 'version']);
    for (const h of parsed.holdings) {
      expect(h).not.toHaveProperty('ltp');
      expect(h).not.toHaveProperty('price');
      expect(h).not.toHaveProperty('value');
      expect(h).toHaveProperty('symbol');
      expect(h).toHaveProperty('qty');
      expect(h).toHaveProperty('avgPaise');
    }
  });
});
