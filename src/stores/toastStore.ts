import { useSyncExternalStore } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  readonly id: string;
  readonly type: ToastType;
  readonly message: string;
  readonly durationMs?: number;
}

export interface ShowToastOptions {
  readonly type: ToastType;
  readonly message: string;
  readonly durationMs?: number;
}

export function createToastStore() {
  let toasts: ToastMessage[] = [];
  const subscribers = new Set<() => void>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const notify = () => {
    for (const sub of subscribers) {
      sub();
    }
  };

  const show = (options: ShowToastOptions): string => {
    // Prevent duplicate spam: if an identical toast message is already active, refresh it
    const existing = toasts.find(
      (t) => t.message === options.message && t.type === options.type
    );
    if (existing) {
      const existingTimer = timers.get(existing.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      const duration = options.durationMs ?? 3500;
      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss(existing.id);
        }, duration);
        timers.set(existing.id, timer);
      }
      return existing.id;
    }

    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const duration = options.durationMs ?? 3500;
    const toast: ToastMessage = {
      id,
      type: options.type,
      message: options.message,
      durationMs: duration,
    };

    // Keep at most 1 active toast to completely prevent stacked popups
    if (toasts.length > 0) {
      for (const t of toasts) {
        const timer = timers.get(t.id);
        if (timer) {
          clearTimeout(timer);
          timers.delete(t.id);
        }
      }
      toasts = [];
    }

    toasts = [...toasts, toast];
    notify();

    if (duration > 0) {
      const timer = setTimeout(() => {
        dismiss(id);
      }, duration);
      timers.set(id, timer);
    }

    return id;
  };

  const dismiss = (id: string): void => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  };

  const clear = (): void => {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
    toasts = [];
    notify();
  };

  const getToasts = (): readonly ToastMessage[] => toasts;

  const subscribe = (cb: () => void): (() => void) => {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  };

  return {
    show,
    dismiss,
    clear,
    getToasts,
    subscribe,
  };
}

export const toastStore = createToastStore();

export function useToasts(): readonly ToastMessage[] {
  return useSyncExternalStore(
    toastStore.subscribe,
    toastStore.getToasts,
    toastStore.getToasts
  );
}
