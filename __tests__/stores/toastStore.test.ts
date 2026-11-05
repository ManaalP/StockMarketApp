import { toastStore } from '../../src/stores/toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    toastStore.clear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    toastStore.clear();
  });

  test('adds a toast and notifies subscribers', () => {
    const subscriber = jest.fn();
    const unsub = toastStore.subscribe(subscriber);

    const id = toastStore.show({
      type: 'success',
      message: 'Prices live',
      durationMs: 3000,
    });

    expect(subscriber).toHaveBeenCalled();
    const toasts = toastStore.getToasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.id).toBe(id);
    expect(toasts[0]?.type).toBe('success');
    expect(toasts[0]?.message).toBe('Prices live');

    unsub();
  });

  test('automatically dismisses toast after durationMs', () => {
    toastStore.show({
      type: 'error',
      message: 'No internet connection',
      durationMs: 2000,
    });

    expect(toastStore.getToasts()).toHaveLength(1);

    jest.advanceTimersByTime(2000);

    expect(toastStore.getToasts()).toHaveLength(0);
  });

  test('manually dismisses toast by id', () => {
    const id1 = toastStore.show({ type: 'info', message: 'Toast 1' });
    expect(toastStore.getToasts()).toHaveLength(1);

    toastStore.dismiss(id1);

    const toasts = toastStore.getToasts();
    expect(toasts).toHaveLength(0);
  });

  test('deduplicates identical toast messages and refreshes timer without duplicating', () => {
    const id1 = toastStore.show({ type: 'info', message: 'Identical message', durationMs: 2000 });
    expect(toastStore.getToasts()).toHaveLength(1);

    const id2 = toastStore.show({ type: 'info', message: 'Identical message', durationMs: 3000 });
    expect(id2).toBe(id1);
    expect(toastStore.getToasts()).toHaveLength(1);

    jest.advanceTimersByTime(2000);
    // Still active because timer was refreshed to 3000ms
    expect(toastStore.getToasts()).toHaveLength(1);

    jest.advanceTimersByTime(1000);
    expect(toastStore.getToasts()).toHaveLength(0);
  });

  test('caps active toasts at 1 to completely prevent stacking popups', () => {
    toastStore.show({ type: 'info', message: 'Message 1' });
    expect(toastStore.getToasts()).toHaveLength(1);

    toastStore.show({ type: 'info', message: 'Message 2' });
    const toasts = toastStore.getToasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.message).toBe('Message 2');
  });
});
