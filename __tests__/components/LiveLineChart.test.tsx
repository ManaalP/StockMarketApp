import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { Text as SvgText } from 'react-native-svg';
import {
  LiveLineChart,
  CHART_FLUSH_INTERVAL_MS,
} from '../../src/components/LiveLineChart';
import { ThemeProvider } from '../../src/theme/useTheme';
import { priceStore } from '../../src/stores/priceStore';

describe('LiveLineChart (PR B Specs)', () => {
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

  test('displays empty state "Waiting for first tick..." when fewer than 2 points exist', () => {
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
    expect(renderer.root.findByProps({ testID: 'detail.chart.empty' })).toBeDefined();

    act(() => {
      renderer.unmount();
    });
  });

  test('defaults to Line mode, displays "{n} ticks", and switches cleanly to Candles mode', () => {
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

    // Initial 1 tick from seed -> empty state under 2 points
    expect(getAllText(renderer.root).join(' ')).toContain('Waiting for first tick...');

    // Push second tick and flush
    act(() => {
      priceStore.queueTick({ symbol: 'TCS', seq: 101, ltp: 321000 });
      priceStore.flush();
      jest.advanceTimersByTime(CHART_FLUSH_INTERVAL_MS);
    });

    // Default mode is line
    expect(renderer.root.findByProps({ testID: 'live.chart.path' })).toBeDefined();

    // Verify title and right-aligned ticks
    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('Live ticks since you opened this screen');
    expect(texts).toContain('2 ticks');
    expect(texts).not.toContain('DAILY OHLC');

    // Toggle to Candle mode
    const candleBtn = renderer.root.findByProps({ testID: 'detail.chart.mode.candle' });
    act(() => {
      candleBtn.props.onPress();
    });

    expect(renderer.root.findAllByProps({ testID: 'live.chart.path' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'chart.candle.body.0' }).length).toBeGreaterThan(0);

    // Toggle back to Line mode
    const lineBtn = renderer.root.findByProps({ testID: 'detail.chart.mode.line' });
    act(() => {
      lineBtn.props.onPress();
    });
    expect(renderer.root.findByProps({ testID: 'live.chart.path' })).toBeDefined();

    // Confirm no zoom buttons exist
    expect(renderer.root.findAllByProps({ testID: 'chart.zoom.in' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'chart.zoom.out' })).toHaveLength(0);

    act(() => {
      renderer.unmount();
    });
  });

  test('x-axis labels count never exceeds 4', () => {
    act(() => {
      priceStore.seed({
        RELIANCE: {
          ltp: 250000,
          open: 248000,
          high: 252000,
          low: 247000,
          prevClose: 249000,
          volume: 100000,
        },
      });
    });

    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <LiveLineChart symbol="RELIANCE" />
        </ThemeProvider>
      );
    });

    // Push 20 ticks
    act(() => {
      for (let i = 1; i <= 20; i++) {
        priceStore.queueTick({ symbol: 'RELIANCE', seq: i, ltp: 250000 + i * 10 });
      }
      priceStore.flush();
      jest.advanceTimersByTime(CHART_FLUSH_INTERVAL_MS);
    });

    // Find all rendered SvgText elements representing time labels
    const svgTexts = renderer.root.findAllByType(SvgText);
    const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
    const timeSvgLabels = svgTexts.filter((st) => {
      const val = String(st.props.children ?? '');
      return timeRegex.test(val);
    });

    expect(timeSvgLabels.length).toBeLessThanOrEqual(4);
    expect(timeSvgLabels.length).toBeGreaterThan(0);

    act(() => {
      renderer.unmount();
    });
  });
});
