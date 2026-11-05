import { useSyncExternalStore, useCallback } from 'react';

// External store for performance overlay toggle
let isEnabled = false;
const listeners = new Set<() => void>();

export function getPerfOverlayEnabled(): boolean {
  return __DEV__ && isEnabled;
}

export function setPerfOverlayEnabled(enabled: boolean): void {
  if (!__DEV__) return;
  if (isEnabled === enabled) return;
  isEnabled = enabled;
  for (const listener of listeners) {
    listener();
  }
}

export function togglePerfOverlay(): void {
  setPerfOverlayEnabled(!isEnabled);
}

export function subscribePerfOverlay(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Reactive hook indicating whether performance render badges are enabled.
 */
export function usePerfOverlay(): boolean {
  const subscribe = useCallback(
    (notify: () => void) => subscribePerfOverlay(notify),
    []
  );
  const getSnapshot = useCallback(() => getPerfOverlayEnabled(), []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
