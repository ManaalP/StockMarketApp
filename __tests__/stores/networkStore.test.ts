import { networkStore } from '../../src/stores/networkStore';
import { toastStore } from '../../src/stores/toastStore';

describe('networkStore', () => {
  beforeEach(() => {
    toastStore.clear();
    networkStore.setOnline(true);
  });

  afterEach(() => {
    toastStore.clear();
    networkStore.setOnline(true);
  });

  test('defaults to online state', () => {
    expect(networkStore.isOnline()).toBe(true);
  });

  test('toggles to offline state, fires toast, and notifies subscribers', () => {
    const subscriber = jest.fn();
    const unsub = networkStore.subscribe(subscriber);

    networkStore.setOnline(false);

    expect(networkStore.isOnline()).toBe(false);
    expect(subscriber).toHaveBeenCalled();

    const toasts = toastStore.getToasts();
    expect(toasts.length).toBeGreaterThan(0);
    expect(toasts[0]?.type).toBe('error');
    expect(toasts[0]?.message).toContain('No internet connection');

    unsub();
  });

  test('restores to online state, fires success toast, and notifies subscribers', () => {
    networkStore.setOnline(false);
    toastStore.clear();

    const subscriber = jest.fn();
    const unsub = networkStore.subscribe(subscriber);

    networkStore.setOnline(true);

    expect(networkStore.isOnline()).toBe(true);
    expect(subscriber).toHaveBeenCalled();

    const toasts = toastStore.getToasts();
    expect(toasts.length).toBeGreaterThan(0);
    expect(toasts[0]?.type).toBe('success');
    expect(toasts[0]?.message).toContain('Internet connection restored');

    unsub();
  });

  test('toggle switches between online and offline', () => {
    networkStore.setOnline(true);
    networkStore.toggle();
    expect(networkStore.isOnline()).toBe(false);

    networkStore.toggle();
    expect(networkStore.isOnline()).toBe(true);
  });
});
