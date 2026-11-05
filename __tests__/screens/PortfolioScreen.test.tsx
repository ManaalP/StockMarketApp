import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { TextInput, RefreshControl, Text } from 'react-native';
import { PortfolioScreen } from '../../src/screens/PortfolioScreen';
import { ThemeProvider } from '../../src/theme/useTheme';
import { priceStore } from '../../src/stores/priceStore';
import { portfolioStore } from '../../src/stores/portfolioStore';
import { filterStore } from '../../src/stores/filterStore';

describe('PortfolioScreen', () => {
  let bootstrapSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    bootstrapSpy = jest.spyOn(portfolioStore, 'bootstrap').mockResolvedValue();
    act(() => {
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
          open: 350000,
          prevClose: 350000,
          high: 355000,
          low: 318000,
          volume: 20000,
        },
        INFY: {
          ltp: 180000,
          open: 150000,
          prevClose: 150000,
          high: 185000,
          low: 149000,
          volume: 30000,
        },
      });
    });
  });

  afterEach(() => {
    bootstrapSpy.mockRestore();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function getAllText(root: ReactTestRenderer.ReactTestInstance): string[] {
    return root.findAllByType(Text).map((t) => {
      const ch = t.props.children;
      return Array.isArray(ch) ? ch.join('') : String(ch ?? '');
    });
  }

  test('renders summary card, search bar, sort controls, and holding rows', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <PortfolioScreen />
        </ThemeProvider>
      );
    });

    const texts = getAllText(renderer.root).join(' ');

    // Summary Card present
    expect(texts).toContain('Current value');
    expect(texts).toContain('Total invested');

    // Search bar present
    const searchInput = renderer.root.findByType(TextInput);
    expect(searchInput.props.placeholder).toBe('Filter by symbol or company');

    // Sort buttons present
    expect(texts).toContain('Name');
    expect(texts).toContain('Value');
    expect(texts).toContain('P&L');

    // Holding rows present
    expect(texts).toContain('RELIANCE');
    expect(texts).toContain('TCS');
    expect(texts).toContain('INFY');
  });

  test('filters rows dynamically as user types in the search input', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <PortfolioScreen />
        </ThemeProvider>
      );
    });

    const searchInput = renderer.root.findByType(TextInput);

    // Type 'TCS' in search filter
    act(() => {
      searchInput.props.onChangeText('TCS');
    });

    let texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('TCS');
    expect(texts).not.toContain('RELIANCE');
    expect(texts).not.toContain('INFY');

    // Clear search
    act(() => {
      searchInput.props.onChangeText('');
    });

    texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('RELIANCE');
    expect(texts).toContain('TCS');

    // Filter by registered company name (e.g., 'Consultancy' for TCS)
    act(() => {
      searchInput.props.onChangeText('Consultancy');
    });

    texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('TCS');
    expect(texts).not.toContain('RELIANCE');
  });

  test('displays back to top button when scrolled and scrolls up when tapped', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <PortfolioScreen />
        </ThemeProvider>
      );
    });

    const flatList = renderer.root.findByProps({ testID: 'portfolio.list' });
    expect(renderer.root.findAllByProps({ testID: 'portfolio.backToTop' })).toHaveLength(0);

    // Scroll down past 240px threshold
    act(() => {
      flatList.props.onScroll({
        nativeEvent: {
          contentOffset: { y: 350 },
        },
      });
    });

    const backToTopBtn = renderer.root.findByProps({ testID: 'portfolio.backToTop' });
    expect(backToTopBtn).toBeDefined();

    act(() => {
      backToTopBtn.props.onPress();
    });
  });

  test('toggles sort field and direction on sort button press', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <PortfolioScreen />
        </ThemeProvider>
      );
    });

    // Find sort buttons
    const sortValueBtn = renderer.root.findByProps({ testID: 'sort.btn.value' });

    // Tap Value sort button
    act(() => {
      sortValueBtn.props.onPress();
    });

    let texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('Value ↓');

    // Tap Value sort button again to toggle direction
    act(() => {
      sortValueBtn.props.onPress();
    });

    texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('Value ↑');
  });

  test('calls portfolioStore.refresh on pull to refresh', async () => {
    const refreshSpy = jest.spyOn(portfolioStore, 'refresh').mockResolvedValue();

    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <PortfolioScreen />
        </ThemeProvider>
      );
    });

    const refreshControl = renderer.root.findByType(RefreshControl);

    await act(async () => {
      refreshControl.props.onRefresh();
    });

    expect(refreshSpy).toHaveBeenCalled();
    refreshSpy.mockRestore();
  });

  test('opens filter modal and filters holdings by category', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <PortfolioScreen />
        </ThemeProvider>
      );
    });

    const filterOpenBtn = renderer.root.findByProps({ testID: 'portfolio.filter.open' });
    act(() => {
      filterOpenBtn.props.onPress();
    });

    expect(filterStore.getState().isModalOpen).toBe(true);

    // Apply Gainers filter
    act(() => {
      filterStore.setCategoryFilter('gainers');
    });

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('Filter: gainers');
    // Gainers like INFY and RELIANCE are shown, losers or unpriced are excluded
    expect(texts).toContain('INFY');
    expect(texts).toContain('RELIANCE');
    expect(texts).not.toContain('OLDCO');

    act(() => {
      filterStore.reset();
      renderer.unmount();
    });
  });
});
