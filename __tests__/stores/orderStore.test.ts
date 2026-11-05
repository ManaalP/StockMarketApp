import { createOrderStore, type OrderStore, type ExecutedOrder } from '../../src/stores/orderStore';
import type { StorageBackend } from '../../src/stores/watchlistStore';
import { toPaise } from '../../src/domain/money';
import type { Order } from '../../src/domain/types';

describe('OrderStore (src/stores/orderStore.ts)', () => {
  let memoryStorage: Record<string, string>;
  let mockStorage: StorageBackend;

  beforeEach(() => {
    memoryStorage = {};
    mockStorage = {
      getItem: jest.fn(async (key: string) => memoryStorage[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        memoryStorage[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete memoryStorage[key];
      }),
    };
  });

  const sampleOrder: Order = {
    symbol: 'RELIANCE',
    side: 'BUY',
    qty: 10,
    fillPaise: toPaise(2500),
  };

  it('records an executed order and prepends it to the history list', async () => {
    const store: OrderStore = createOrderStore({ storage: mockStorage });

    const executed = await store.recordOrder(sampleOrder, 'order-1', 1700000000000);

    expect(executed.id).toBe('order-1');
    expect(executed.symbol).toBe('RELIANCE');
    expect(executed.side).toBe('BUY');
    expect(executed.qty).toBe(10);
    expect(executed.pricePaise).toBe(250000);
    expect(executed.totalPaise).toBe(2500000); // 10 * 250000
    expect(executed.timestamp).toBe(1700000000000);

    expect(store.getOrders().length).toBe(1);
    expect(store.getOrders()[0]).toEqual(executed);
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('hydrates persisted orders on start in reverse chronological order', async () => {
    const persisted: ExecutedOrder[] = [
      {
        id: 'order-1',
        symbol: 'TCS',
        side: 'BUY',
        qty: 5,
        pricePaise: toPaise(3500),
        totalPaise: toPaise(17500),
        timestamp: 1000,
      },
      {
        id: 'order-2',
        symbol: 'INFY',
        side: 'SELL',
        qty: 2,
        pricePaise: toPaise(1500),
        totalPaise: toPaise(3000),
        timestamp: 2000,
      },
    ];

    memoryStorage['@live_portfolio_order_history_v1'] = JSON.stringify(persisted);

    const store = createOrderStore({ storage: mockStorage });
    expect(store.isLoaded()).toBe(false);

    await store.hydrate();

    expect(store.isLoaded()).toBe(true);
    expect(store.getOrders()).toHaveLength(2);
    expect(store.getOrders()[0]?.symbol).toBe('TCS');
  });

  it('handles corrupt storage JSON by falling back cleanly to an empty list', async () => {
    memoryStorage['@live_portfolio_order_history_v1'] = 'INVALID_NON_JSON_CONTENT{{{';

    const store = createOrderStore({ storage: mockStorage });
    await store.hydrate();

    expect(store.isLoaded()).toBe(true);
    expect(store.getOrders()).toEqual([]);
  });

  it('notifies subscribers upon recording or clearing orders', async () => {
    const store = createOrderStore({ storage: mockStorage });
    const listener = jest.fn();

    const unsubscribe = store.subscribe(listener);

    await store.recordOrder(sampleOrder, 'order-1', 1000);
    expect(listener).toHaveBeenCalledTimes(1);

    await store.clearOrders();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getOrders()).toEqual([]);

    unsubscribe();
    await store.recordOrder(sampleOrder, 'order-2', 2000);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
