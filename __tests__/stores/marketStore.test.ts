import { createMarketStore } from '../../src/stores/marketStore';
import { toastStore } from '../../src/stores/toastStore';

describe('MarketStore (src/stores/marketStore.ts)', () => {
  afterEach(() => {
    toastStore.clear();
  });
  it('initializes with simulatedClosed = false', () => {
    const store = createMarketStore(false);
    expect(store.isSimulatedClosed()).toBe(false);
  });

  it('toggles simulated closed state and notifies listeners', () => {
    const store = createMarketStore(false);
    const subscriber = jest.fn();
    const marketChangeListener = jest.fn();

    const unsubSub = store.subscribe(subscriber);
    const unsubChange = store.onMarketChange(marketChangeListener);

    store.toggleSimulatedClosed();
    expect(store.isSimulatedClosed()).toBe(true);
    expect(store.isMarketOpen()).toBe(false);
    expect(subscriber).toHaveBeenCalled();
    expect(marketChangeListener).toHaveBeenCalledWith(false);

    const status = store.getMarketStatus();
    expect(status.isOpen).toBe(false);
    expect(status.reason).toContain('Market is closed (Dev Override: After-market simulation is ON)');

    // Toggle back off
    store.toggleSimulatedClosed();
    expect(store.isSimulatedClosed()).toBe(false);

    unsubSub();
    unsubChange();
  });
});
