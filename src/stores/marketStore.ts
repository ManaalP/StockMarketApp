import { useSyncExternalStore } from 'react';
import { checkIndianMarketHours, type MarketHoursResult } from '../domain/marketHours';
import { toastStore } from './toastStore';

export interface MarketStore {
  isSimulatedClosed: () => boolean;
  setSimulatedClosed: (closed: boolean) => void;
  toggleSimulatedClosed: () => void;
  isMarketOpen: (now?: Date) => boolean;
  getMarketStatus: (now?: Date) => MarketHoursResult;
  subscribe: (cb: () => void) => () => void;
  onMarketChange: (cb: (open: boolean) => void) => () => void;
}

export function createMarketStore(initialSimulatedClosed = false): MarketStore {
  let simulatedClosed = initialSimulatedClosed;
  const subscribers = new Set<() => void>();
  const changeListeners = new Set<(open: boolean) => void>();

  const notify = () => {
    const open = !simulatedClosed;
    for (const sub of subscribers) {
      sub();
    }
    for (const listener of changeListeners) {
      listener(open);
    }
  };

  const isSimulatedClosed = () => simulatedClosed;

  const setSimulatedClosed = (nextClosed: boolean) => {
    if (simulatedClosed === nextClosed) return;
    simulatedClosed = nextClosed;

    if (simulatedClosed) {
      toastStore.show({
        type: 'error',
        message: 'Simulated Market Closed (After-hours active). Price ticks paused and trading disabled.',
        durationMs: 4000,
      });
    } else {
      toastStore.show({
        type: 'success',
        message: 'Live Market Hours resumed. Price ticks active.',
        durationMs: 3500,
      });
    }

    notify();
  };

  const toggleSimulatedClosed = () => {
    setSimulatedClosed(!simulatedClosed);
  };

  const isMarketOpen = (now: Date = new Date()): boolean => {
    void now;
    // Default is always open (live ticks on) so app is not time-dependent during testing / demo.
    // Ticks pause only when simulatedClosed is explicitly toggled ON by user in developer settings.
    return !simulatedClosed;
  };

  const getMarketStatus = (now: Date = new Date()): MarketHoursResult => {
    const hours = checkIndianMarketHours(now);
    if (simulatedClosed) {
      return {
        isOpen: false,
        reason: 'Market is closed (Dev Override: After-market simulation is ON). Regular NSE trading hours are Monday to Friday, 9:15 AM - 3:30 PM IST.',
        istTimeStr: hours.istTimeStr,
      };
    }
    return {
      isOpen: true,
      istTimeStr: hours.istTimeStr,
    };
  };

  const subscribe = (cb: () => void) => {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  };

  const onMarketChange = (cb: (open: boolean) => void) => {
    changeListeners.add(cb);
    return () => {
      changeListeners.delete(cb);
    };
  };

  return {
    isSimulatedClosed,
    setSimulatedClosed,
    toggleSimulatedClosed,
    isMarketOpen,
    getMarketStatus,
    subscribe,
    onMarketChange,
  };
}

export const marketStore = createMarketStore(false);

export function useMarketClosedSimulation(): boolean {
  return useSyncExternalStore(
    marketStore.subscribe,
    marketStore.isSimulatedClosed,
    marketStore.isSimulatedClosed
  );
}

export function useIsMarketOpen(): boolean {
  return useSyncExternalStore(
    marketStore.subscribe,
    marketStore.isMarketOpen,
    marketStore.isMarketOpen
  );
}
