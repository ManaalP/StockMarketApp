import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import {
  createWatchlistStore,
  createWatchlistHooks,
  type StorageBackend,
} from '../../src/stores/watchlistStore';

describe('useWatchlist and useIsInWatchlist hooks', () => {
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
  });

  test('subscribes reactively to watchlist changes', async () => {
    const store = createWatchlistStore({ storage: mockStorage });
    const { useWatchlist, useIsInWatchlist } = createWatchlistHooks(store);

    await store.hydrate();

    function WatchlistComponent() {
      const { symbols, isLoaded } = useWatchlist();
      const isRelianceWatched = useIsInWatchlist('RELIANCE');
      const isSbinWatched = useIsInWatchlist('SBIN');

      return (
        <>
          <Text testID="loaded">{isLoaded ? 'YES' : 'NO'}</Text>
          <Text testID="count">{symbols.length}</Text>
          <Text testID="hasReliance">{isRelianceWatched ? 'YES' : 'NO'}</Text>
          <Text testID="hasSbin">{isSbinWatched ? 'YES' : 'NO'}</Text>
        </>
      );
    }

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<WatchlistComponent />);
    });

    expect(renderer.root.findByProps({ testID: 'loaded' }).props.children).toBe('YES');
    expect(renderer.root.findByProps({ testID: 'hasSbin' }).props.children).toBe('NO');

    // Add SBIN
    await act(async () => {
      await store.add('SBIN');
    });

    expect(renderer.root.findByProps({ testID: 'hasSbin' }).props.children).toBe('YES');

    // Remove SBIN
    await act(async () => {
      await store.remove('SBIN');
    });

    expect(renderer.root.findByProps({ testID: 'hasSbin' }).props.children).toBe('NO');
  });
});
