import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { WatchlistScreen } from '../../src/screens/WatchlistScreen';
import { ThemeProvider } from '../../src/theme/useTheme';
import { watchlistStore } from '../../src/stores/watchlistStore';
import { priceStore } from '../../src/stores/priceStore';

describe('WatchlistScreen', () => {
  beforeEach(async () => {
    // Reset watchlist store with known test symbols
    await act(async () => {
      await watchlistStore.setSymbols(['RELIANCE', 'TCS']);
      priceStore.seed({
        RELIANCE: {
          ltp: 260000,
          open: 250000,
          prevClose: 250000,
          high: 265000,
          low: 248000,
          volume: 50000,
        },
        TCS: {
          ltp: 320000,
          open: 315000,
          prevClose: 310000,
          high: 325000,
          low: 310000,
          volume: 30000,
        },
      });
    });
  });

  function getAllText(root: ReactTestRenderer.ReactTestInstance): string[] {
    return root.findAllByType(Text).map((t) => {
      const ch = t.props.children;
      return Array.isArray(ch) ? ch.join('') : String(ch ?? '');
    });
  }

  test('renders header and watchlist rows', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <WatchlistScreen />
        </ThemeProvider>
      );
    });

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('Watchlist');
    expect(texts).toContain('2 symbols');
    expect(texts).toContain('RELIANCE');
    expect(texts).toContain('TCS');
  });

  test('navigates to stock detail when row is pressed', () => {
    const onSelectStock = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <WatchlistScreen onSelectStock={onSelectStock} />
        </ThemeProvider>
      );
    });

    const relianceRow = renderer.root.findByProps({ testID: 'watch.row.RELIANCE' });
    act(() => {
      relianceRow.props.onPress();
    });

    expect(onSelectStock).toHaveBeenCalledWith('RELIANCE');
  });

  test('removes symbol when remove is pressed', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <WatchlistScreen />
        </ThemeProvider>
      );
    });

    const removeTcs = renderer.root.findByProps({ testID: 'watch.remove.TCS' });
    await act(async () => {
      removeTcs.props.onPress();
    });

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('1 symbol');
    expect(texts).not.toContain('TCS');
  });

  test('renders empty state when watchlist has no symbols', async () => {
    await act(async () => {
      await watchlistStore.setSymbols([]);
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <WatchlistScreen />
        </ThemeProvider>
      );
    });

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('Your watchlist is empty');
    expect(renderer.root.findByProps({ testID: 'watchlist.empty.add.button' })).toBeDefined();
  });

  test('filters symbols with search input', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <WatchlistScreen />
        </ThemeProvider>
      );
    });

    const searchInput = renderer.root.findByProps({ testID: 'watchlist.search.input' });

    act(() => {
      searchInput.props.onChangeText('REL');
    });

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('RELIANCE');
    expect(texts).not.toContain('TCS');
  });

  test('opens add modal when + Add is pressed', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <WatchlistScreen />
        </ThemeProvider>
      );
    });

    const addBtn = renderer.root.findByProps({ testID: 'watchlist.add.button' });

    act(() => {
      addBtn.props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'add.modal.search' })).toBeDefined();
  });
});

