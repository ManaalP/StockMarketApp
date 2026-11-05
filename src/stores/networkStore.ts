import { useSyncExternalStore } from 'react';
import { toastStore } from './toastStore';

export interface NetworkStore {
  isOnline: () => boolean;
  setOnline: (online: boolean) => void;
  toggle: () => void;
  subscribe: (cb: () => void) => () => void;
  onNetworkChange: (cb: (online: boolean) => void) => () => void;
}

export function createNetworkStore(initialOnline = true): NetworkStore {
  let online = initialOnline;
  const subscribers = new Set<() => void>();
  const changeListeners = new Set<(online: boolean) => void>();

  const notify = () => {
    for (const sub of subscribers) {
      sub();
    }
    for (const listener of changeListeners) {
      listener(online);
    }
  };

  const isOnline = () => online;

  const setOnline = (nextOnline: boolean) => {
    if (online === nextOnline) return;
    online = nextOnline;

    if (!online) {
      toastStore.show({
        type: 'error',
        message: 'Network disconnected. Price feed disconnected and pending orders failed.',
        durationMs: 4000,
      });
    } else {
      toastStore.show({
        type: 'success',
        message: 'Network restored. Price feed connected.',
        durationMs: 3500,
      });
    }

    notify();
  };

  const toggle = () => {
    setOnline(!online);
  };

  const subscribe = (cb: () => void) => {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  };

  const onNetworkChange = (cb: (online: boolean) => void) => {
    changeListeners.add(cb);
    return () => {
      changeListeners.delete(cb);
    };
  };

  return {
    isOnline,
    setOnline,
    toggle,
    subscribe,
    onNetworkChange,
  };
}

export const networkStore = createNetworkStore(true);

export function useNetworkOnline(): boolean {
  return useSyncExternalStore(
    networkStore.subscribe,
    networkStore.isOnline,
    networkStore.isOnline
  );
}
