import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import {
  LiveLineChart,
  CHART_FLUSH_INTERVAL_MS,
  generateCandles,
} from '../../src/components/LiveLineChart';
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
    act(() => {
      renderer.unmount();
    });
  });

  test('renders Candlestick chart by default with authentic OHLC metrics and candle elements', () => {
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

    // Default mode is Candlestick: candle wicks and bodies are rendered
    const wicks = renderer.root.findAllByProps({ testID: 'chart.candle.wick.0' });
    const bodies = renderer.root.findAllByProps({ testID: 'chart.candle.body.0' });
    expect(wicks.length).toBeGreaterThan(0);
    expect(bodies.length).toBeGreaterThan(0);

    // Verify OHLC strip displays labels
    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('O ');
    expect(texts).toContain('H ');
    expect(texts).toContain('L ');
    expect(texts).toContain('C ');

    act(() => {
      renderer.unmount();
    });
  });

  test('flushes newly arrived ticks every 250ms and toggles between modes', () => {
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
          <LiveLineChart symbol="TCS" initialMode="line" />
        </ThemeProvider>
      );
    });

    // Initial line mode
    expect(renderer.root.findByProps({ testID: 'live.chart.path' })).toBeDefined();

    // Arriving ticks
    act(() => {
      priceStore.queueTick({ symbol: 'TCS', seq: 101, ltp: 321000 });
      priceStore.flush();
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    act(() => {
      priceStore.queueTick({ symbol: 'TCS', seq: 102, ltp: 322500 });
      priceStore.flush();
    });

    act(() => {
      jest.advanceTimersByTime(CHART_FLUSH_INTERVAL_MS);
    });

    expect(renderer.root.findByProps({ testID: 'live.chart.path' })).toBeDefined();

    // Toggle back to Candlestick mode
    const candleBtn = renderer.root.findByProps({ testID: 'chart.mode.candle' });
    act(() => {
      candleBtn.props.onPress();
    });

    expect(renderer.root.findAllByProps({ testID: 'live.chart.path' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'chart.candle.body.0' }).length).toBeGreaterThan(0);

    act(() => {
      renderer.unmount();
    });
  });

  test('supports zoom in/out and candle touch inspection', () => {
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

    // Zoom In
    const zoomInBtn = renderer.root.findByProps({ testID: 'chart.zoom.in' });
    act(() => {
      zoomInBtn.props.onPress();
    });

    let texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('1.3x');

    // Zoom Out
    const zoomOutBtn = renderer.root.findByProps({ testID: 'chart.zoom.out' });
    act(() => {
      zoomOutBtn.props.onPress();
    });

    texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('1.0x');

    // Tap on candle to inspect
    const candleTouch0 = renderer.root.findByProps({ testID: 'chart.candle.touch.0' });
    act(() => {
      candleTouch0.props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'chart.active.price.badge' })).toBeDefined();

    act(() => {
      renderer.unmount();
    });
  });

  test('generateCandles accurately creates OHLC from authentic quote', () => {
    const quote = {
      ltp: 320000,
      open: 315000,
      high: 325000,
      low: 310000,
      prevClose: 310000,
      volume: 50000,
    };

    const candles = generateCandles(quote, [320000]);
    expect(candles.length).toBeGreaterThanOrEqual(1);
    const today = candles[candles.length - 1]!;
    expect(today.open).toBe(315000);
    expect(today.high).toBe(325000);
    expect(today.low).toBe(310000);
    expect(today.close).toBe(320000);
  });
});
