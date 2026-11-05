import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { LiveLineChart, CHART_FLUSH_INTERVAL_MS } from '../../src/components/LiveLineChart';
import { ThemeProvider } from '../../src/theme/useTheme';
import { priceStore } from '../../src/stores/priceStore';

describe('LiveLineChart', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function getAllText(root: ReactTestRenderer.ReactTestInstance): string[] {
    return root.findAllByType(Text).map((t) => {
      const ch = t.props.children;
      return Array.isArray(ch) ? ch.join('') : String(ch ?? '');
    });
  }

  test('displays empty state "Waiting for first tick..." when no price exists', () => {
    act(() => {
      // OLDCO unpriced
      priceStore.seed({
        OLDCO: {
          ltp: null,
          open: 10000,
          high: 10000,
          low: 10000,
          prevClose: 10000,
          volume: 0,
        },
      });
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <LiveLineChart symbol="OLDCO" />
        </ThemeProvider>
      );
    });

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('Waiting for first tick...');
  });

  test('seeds with initial quote and flushes newly arrived ticks every 250ms', () => {
    act(() => {
      priceStore.seed({
        TCS: {
          ltp: 320000,
          open: 315000,
          high: 325000,
          low: 310000,
          prevClose: 310000,
          volume: 50000,
        },
      });
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <LiveLineChart symbol="TCS" />
        </ThemeProvider>
      );
    });

    // Initial 1 tick
    let texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('1 tick');

    // Simulate arriving first tick
    act(() => {
      priceStore.queueTick({ symbol: 'TCS', seq: 101, ltp: 321000 });
      priceStore.flush();
    });

    // Advance 100ms
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Simulate arriving second tick
    act(() => {
      priceStore.queueTick({ symbol: 'TCS', seq: 102, ltp: 322500 });
      priceStore.flush();
    });

    // Advance fake timer by remaining time to complete 250ms chart flush interval
    act(() => {
      jest.advanceTimersByTime(CHART_FLUSH_INTERVAL_MS);
    });

    texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('3 ticks');
    expect(renderer.root.findByProps({ testID: 'live.chart.path' })).toBeDefined();

    // Verify OHLC metric display on chart header
    expect(texts).toContain('O ');
    expect(texts).toContain('H ');
    expect(texts).toContain('L ');
    expect(texts).toContain('C ');

    // Toggle to OHLC Candlestick view
    const candleBtn = renderer.root.findByProps({ testID: 'chart.mode.candle' });
    act(() => {
      candleBtn.props.onPress();
    });

    // In candle mode, candles are rendered instead of polyline path
    expect(renderer.root.findAllByProps({ testID: 'live.chart.path' })).toHaveLength(0);
  });
});
