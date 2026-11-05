import {
  createWatchlistStore,
  DEFAULT_WATCHLIST_SYMBOLS,
  WATCHLIST_STORAGE_KEY,
  type StorageBackend,
} from '../../src/stores/watchlistStore';

describe('watchlistStore', () => {
  let memoryStorage: Record<string, string> = {};

  const mockStorage: StorageBackend = {
    getItem: jest.fn(async (key: string) => memoryStorage[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      memoryStorage[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete memoryStorage[key];
    }),
  };

  beforeEach(() => {
    memoryStorage = {};
    jest.clearAllMocks();
  });

  test('hydrates with safe defaults when storage is empty', async () => {
    const store = createWatchlistStore({ storage: mockStorage });
    expect(store.isLoaded()).toBe(false);

    await store.hydrate();

    expect(store.isLoaded()).toBe(true);
    expect(store.list()).toEqual(DEFAULT_WATCHLIST_SYMBOLS);
    expect(mockStorage.getItem).toHaveBeenCalledWith(WATCHLIST_STORAGE_KEY);
  });

  test('hydrates previously saved symbols from storage', async () => {
    memoryStorage[WATCHLIST_STORAGE_KEY] = JSON.stringify(['SBIN', 'ITC']);

    const store = createWatchlistStore({ storage: mockStorage });
    await store.hydrate();

    expect(store.isLoaded()).toBe(true);
    expect(store.list()).toEqual(['SBIN', 'ITC']);
    expect(store.has('SBIN')).toBe(true);
    expect(store.has('ITC')).toBe(true);
    expect(store.has('RELIANCE')).toBe(false);
  });

  test('adds an allowed symbol and persists to storage', async () => {
    const store = createWatchlistStore({ storage: mockStorage });
    await store.hydrate();

    const listener = jest.fn();
    store.subscribe(listener);

    const added = await store.add('SBIN');
    expect(added).toBe(true);
    expect(store.has('SBIN')).toBe(true);
    expect(store.list()).toContain('SBIN');
    expect(listener).toHaveBeenCalledTimes(1);

    expect(mockStorage.setItem).toHaveBeenCalledWith(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify(store.list())
    );
  });

  test('deduplicates when adding an already existing symbol', async () => {
    memoryStorage[WATCHLIST_STORAGE_KEY] = JSON.stringify(['RELIANCE', 'TCS']);
    const store = createWatchlistStore({ storage: mockStorage });
    await store.hydrate();

    const initialLength = store.list().length;
    const added = await store.add('RELIANCE');

    expect(added).toBe(false);
    expect(store.list().length).toBe(initialLength);
  });

  test('rejects unknown or unlisted symbols (like OLDCO or invalid tickers)', async () => {
    const store = createWatchlistStore({ storage: mockStorage });
    await store.hydrate();

    const initialList = [...store.list()];

    // OLDCO is only an unlisted holding, never allowed in watchlist
    const addedOldco = await store.add('OLDCO');
    expect(addedOldco).toBe(false);
    expect(store.has('OLDCO')).toBe(false);

    // Random non-existent symbol
    const addedRandom = await store.add('XYZCORP');
    expect(addedRandom).toBe(false);
    expect(store.has('XYZCORP')).toBe(false);

    expect(store.list()).toEqual(initialList);
  });

  test('removes a symbol from watchlist and persists to storage', async () => {
    memoryStorage[WATCHLIST_STORAGE_KEY] = JSON.stringify(['RELIANCE', 'TCS']);
    const store = createWatchlistStore({ storage: mockStorage });
    await store.hydrate();

    const listener = jest.fn();
    store.subscribe(listener);

    const removed = await store.remove('TCS');
    expect(removed).toBe(true);
    expect(store.has('TCS')).toBe(false);
    expect(store.list()).toEqual(['RELIANCE']);
    expect(listener).toHaveBeenCalledTimes(1);

    expect(mockStorage.setItem).toHaveBeenCalledWith(
      WATCHLIST_STORAGE_KEY,
      JSON.stringify(['RELIANCE'])
    );
  });

  test('falls back to empty list gracefully when storage JSON is corrupt', async () => {
    memoryStorage[WATCHLIST_STORAGE_KEY] = '{{corrupt-json-123';

    const store = createWatchlistStore({ storage: mockStorage });
    await store.hydrate();

    expect(store.isLoaded()).toBe(true);
    expect(store.list()).toEqual([]);
  });

  test('filters out unknown symbols found in corrupt/stale storage during hydration', async () => {
    memoryStorage[WATCHLIST_STORAGE_KEY] = JSON.stringify([
      'RELIANCE',
      'OLDCO', // invalid
      'FAKE_TICKER', // invalid
      'TCS',
    ]);

    const store = createWatchlistStore({ storage: mockStorage });
    await store.hydrate();

    expect(store.list()).toEqual(['RELIANCE', 'TCS']);
  });
});
