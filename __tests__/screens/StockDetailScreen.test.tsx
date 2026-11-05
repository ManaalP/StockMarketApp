import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { StockDetailScreen } from '../../src/screens/StockDetailScreen';
import { ThemeProvider } from '../../src/theme/useTheme';
import { priceStore } from '../../src/stores/priceStore';
import { watchlistStore } from '../../src/stores/watchlistStore';

describe('StockDetailScreen', () => {
  beforeEach(async () => {
    await act(async () => {
      await watchlistStore.setSymbols(['RELIANCE']);
      priceStore.seed({
        RELIANCE: {
          ltp: 260000,
          open: 250000,
          prevClose: 250000,
          high: 265000,
          low: 248000,
          volume: 50000,
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

  test('renders stock detail header, live price, and stats', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <StockDetailScreen symbol="RELIANCE" />
        </ThemeProvider>
      );
    });

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('RELIANCE');
    expect(texts).toContain('₹2,600.00');
    expect(texts).toContain('+₹100.00');
    expect(texts).toContain('Market Statistics');
  });

  test('calls onBack when back button is pressed', () => {
    const onBack = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <StockDetailScreen symbol="RELIANCE" onBack={onBack} />
        </ThemeProvider>
      );
    });

    const backBtn = renderer.root.findByProps({ testID: 'stock.detail.back' });
    act(() => {
      backBtn.props.onPress();
    });
    expect(onBack).toHaveBeenCalled();
  });

  test('toggles watchlist star status', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <StockDetailScreen symbol="RELIANCE" />
        </ThemeProvider>
      );
    });

    const starBtn = renderer.root.findByProps({ testID: 'stock.detail.watchlist.star' });
    // RELIANCE is currently in watchlist -> '★'
    expect(getAllText(starBtn).join('')).toContain('★');

    // Tap to remove
    await act(async () => {
      await starBtn.props.onPress();
    });

    expect(getAllText(starBtn).join('')).toContain('☆');
  });

  test('renders price unavailable state and disables trading when unpriced', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <StockDetailScreen symbol="OLDCO" />
        </ThemeProvider>
      );
    });

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('OLDCO');
    expect(texts).toContain('--');
    expect(texts).toContain('Price Unavailable');

    const buyBtn = renderer.root.findByProps({ testID: 'stock.detail.buy.button' });
    expect(buyBtn.props.disabled).toBe(true);

    const sellBtn = renderer.root.findByProps({ testID: 'stock.detail.sell.button' });
    expect(sellBtn.props.disabled).toBe(true);

    expect(renderer.root.findByProps({ testID: 'stock.detail.disabled.reason' })).toBeDefined();
  });
});
