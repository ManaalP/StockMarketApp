import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Path, Circle, Line as SvgLine, Rect } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { priceStore, usePrice } from '../stores/priceStore';
import { chartPath } from '../domain/chart';
import { formatINR } from '../domain/format';
import type { Paise } from '../domain/money';

export const MAX_RING_BUFFER_POINTS = 120;
export const CHART_FLUSH_INTERVAL_MS = 250;

export interface LiveLineChartProps {
  readonly symbol: string;
  readonly height?: number;
  readonly testID?: string;
}

export type ChartMode = 'line' | 'candle';

interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * High-performance, professional live market chart supporting both Line and OHLC Candlestick modes.
 *
 * Requirements:
 * - Subscribes to live price ticks for the symbol.
 * - Ring buffer capped at 120 points since screen opened.
 * - Batches renders at ~250 ms (never calls setState on every 20 Hz tick!).
 * - Interactive mode toggle: Line vs OHLC Candlesticks.
 * - Real-time OHLC header bar: Open, High, Low, and Close/LTP.
 * - Empty state: "Waiting for first tick...".
 * - Line color determined by price direction since opened (gain vs loss).
 */
export const LiveLineChart = memo(function LiveLineChart({
  symbol,
  height = 190,
  testID,
}: LiveLineChartProps) {
  const { tokens } = useTheme();
  const quote = usePrice(symbol);
  const [containerWidth, setContainerWidth] = useState(320);
  const [chartMode, setChartMode] = useState<ChartMode>('line');

  // Ring buffer kept in ref to avoid React state updates on every 20 Hz tick
  const pointsRef = useRef<number[]>([]);
  // Rendered points updated only during throttled flush (~250 ms)
  const [renderedPoints, setRenderedPoints] = useState<number[]>([]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      setContainerWidth((prev) => (prev !== w ? w : prev));
    }
  }, []);

  useEffect(() => {
    // Reset points on symbol change
    pointsRef.current = [];
    const initialQuote = priceStore.getQuote(symbol);
    if (initialQuote && initialQuote.ltp !== null) {
      pointsRef.current = [initialQuote.ltp];
      setRenderedPoints([initialQuote.ltp]);
    } else {
      setRenderedPoints([]);
    }

    let isDirty = false;
    let isMounted = true;

    // Flush interval: flushes accumulated ticks to React state at ~4 Hz (250 ms)
    const flushTimer = setInterval(() => {
      if (isMounted && isDirty) {
        setRenderedPoints([...pointsRef.current]);
        isDirty = false;
      }
    }, CHART_FLUSH_INTERVAL_MS);

    // Subscribe to symbol price updates
    const unsubscribe = priceStore.subscribe(symbol, () => {
      const q = priceStore.getQuote(symbol);
      if (q && q.ltp !== null) {
        const buf = pointsRef.current;
        buf.push(q.ltp);
        if (buf.length > MAX_RING_BUFFER_POINTS) {
          buf.shift();
        }
        isDirty = true;
      }
    });

    return () => {
      isMounted = false;
      clearInterval(flushTimer);
      unsubscribe();
    };
  }, [symbol]);

  // If no points yet, display empty state
  if (renderedPoints.length === 0) {
    return (
      <View
        testID={testID ?? 'live.chart.empty'}
        onLayout={handleLayout}
        style={[
          styles.container,
          styles.emptyContainer,
          {
            height,
            backgroundColor: tokens.surface,
            borderColor: tokens.border,
          },
        ]}
      >
        <ActivityIndicator size="small" color={tokens.primary} />
        <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
          Waiting for first tick...
        </Text>
      </View>
    );
  }

  // Calculate SVG polyline path
  const plotHeight = height - 50; // reserve space for OHLC strip
  const { path } = chartPath(renderedPoints, containerWidth, plotHeight, 12);
  const firstPrice: Paise = renderedPoints[0]!;
  const latestPrice: Paise = renderedPoints[renderedPoints.length - 1]!;
  const isUp = latestPrice >= firstPrice;
  const strokeColor = isUp ? tokens.gain : tokens.loss;

  // Single point case: show flat line across chart
  const displayPath =
    renderedPoints.length === 1
      ? `M 0,${(plotHeight / 2).toFixed(1)} L ${containerWidth},${(plotHeight / 2).toFixed(1)}`
      : path;

  // Derive candles from OHLC quote and session points
  const openPaise = quote?.open ?? firstPrice;
  const highPaise = quote?.high ?? Math.max(...renderedPoints);
  const lowPaise = quote?.low ?? Math.min(...renderedPoints);
  const closePaise = latestPrice;

  // Synthesize candles across the session buffer for Candlestick view
  const candleChunkSize = Math.max(1, Math.floor(renderedPoints.length / 8));
  const candles: CandleData[] = [];
  for (let i = 0; i < renderedPoints.length; i += candleChunkSize) {
    const chunk = renderedPoints.slice(i, i + candleChunkSize);
    if (chunk.length > 0) {
      candles.push({
        open: chunk[0]!,
        high: Math.max(...chunk),
        low: Math.min(...chunk),
        close: chunk[chunk.length - 1]!,
      });
    }
  }

  const minVal = Math.min(lowPaise, ...renderedPoints);
  const maxVal = Math.max(highPaise, ...renderedPoints);
  const valRange = maxVal - minVal || 1;

  const getY = (val: number) => {
    return plotHeight - 12 - ((val - minVal) / valRange) * (plotHeight - 24);
  };

  return (
    <View
      testID={testID ?? 'live.chart.container'}
      onLayout={handleLayout}
      style={[
        styles.container,
        {
          height,
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
        },
      ]}
    >
      {/* Chart Top Bar: Mode Switcher + Live Tick Count */}
      <View style={[styles.topBar, { borderBottomColor: tokens.border }]}>
        <View style={styles.topBarLeft}>
          <Text style={[styles.chartBadge, { color: strokeColor }]}>
            {`Live Session • ${renderedPoints.length} ${renderedPoints.length === 1 ? 'tick' : 'ticks'}`}
          </Text>
        </View>

        {/* View Toggle: Line vs Candles */}
        <View style={[styles.modeToggleRow, { backgroundColor: tokens.surfaceContainer }]}>
          <Pressable
            testID="chart.mode.line"
            onPress={() => setChartMode('line')}
            style={[
              styles.modeBtn,
              chartMode === 'line' && { backgroundColor: tokens.surface },
            ]}
          >
            <Text
              style={[
                styles.modeBtnText,
                { color: chartMode === 'line' ? tokens.primary : tokens.textMuted },
              ]}
            >
              Line
            </Text>
          </Pressable>
          <Pressable
            testID="chart.mode.candle"
            onPress={() => setChartMode('candle')}
            style={[
              styles.modeBtn,
              chartMode === 'candle' && { backgroundColor: tokens.surface },
            ]}
          >
            <Text
              style={[
                styles.modeBtnText,
                { color: chartMode === 'candle' ? tokens.primary : tokens.textMuted },
              ]}
            >
              OHLC
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Real-time OHLC Metric Bar */}
      <View style={[styles.ohlcStrip, { backgroundColor: tokens.surfaceAlt }]}>
        <Text style={[styles.ohlcItem, { color: tokens.textSecondary }]}>
          <Text style={styles.ohlcLabel}>O </Text>
          {formatINR(openPaise)}
        </Text>
        <Text style={[styles.ohlcItem, { color: tokens.textSecondary }]}>
          <Text style={styles.ohlcLabel}>H </Text>
          <Text style={{ color: tokens.gain }}>{formatINR(highPaise)}</Text>
        </Text>
        <Text style={[styles.ohlcItem, { color: tokens.textSecondary }]}>
          <Text style={styles.ohlcLabel}>L </Text>
          <Text style={{ color: tokens.loss }}>{formatINR(lowPaise)}</Text>
        </Text>
        <Text style={[styles.ohlcItem, { color: tokens.textSecondary }]}>
          <Text style={styles.ohlcLabel}>C </Text>
          <Text style={{ color: isUp ? tokens.gain : tokens.loss, fontWeight: '700' }}>
            {formatINR(closePaise)}
          </Text>
        </Text>
      </View>

      {/* Main SVG Chart Canvas */}
      <View style={styles.chartArea}>
        <Svg width={containerWidth} height={plotHeight}>
          {/* Subtle grid lines for High and Low bounds */}
          <SvgLine
            x1={0}
            y1={getY(maxVal)}
            x2={containerWidth}
            y2={getY(maxVal)}
            stroke={tokens.border}
            strokeDasharray="4 4"
            strokeWidth={1}
          />
          <SvgLine
            x1={0}
            y1={getY(minVal)}
            x2={containerWidth}
            y2={getY(minVal)}
            stroke={tokens.border}
            strokeDasharray="4 4"
            strokeWidth={1}
          />

          {chartMode === 'line' ? (
            <>
              <Path
                testID="live.chart.path"
                d={displayPath}
                stroke={strokeColor}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {renderedPoints.length > 1 ? (
                <Circle
                  testID="live.chart.dot"
                  cx={containerWidth - 2}
                  cy={getY(latestPrice)}
                  r={4}
                  fill={strokeColor}
                />
              ) : null}
            </>
          ) : (
            // OHLC Candlestick Rendering
            candles.map((c, idx) => {
              const candleWidth = Math.max(14, Math.floor((containerWidth - 40) / candles.length) - 6);
              const xCenter = 20 + idx * ((containerWidth - 40) / candles.length) + candleWidth / 2;
              const isGreen = c.close >= c.open;
              const candleColor = isGreen ? tokens.gain : tokens.loss;
              const yHigh = getY(c.high);
              const yLow = getY(c.low);
              const yTop = getY(Math.max(c.open, c.close));
              const yBottom = getY(Math.min(c.open, c.close));
              const bodyHeight = Math.max(2, yBottom - yTop);

              return (
                <React.Fragment key={`candle-${idx}`}>
                  {/* Upper and lower wick */}
                  <SvgLine
                    x1={xCenter}
                    y1={yHigh}
                    x2={xCenter}
                    y2={yLow}
                    stroke={candleColor}
                    strokeWidth={1.5}
                  />
                  {/* Candle Real Body */}
                  <Rect
                    x={xCenter - candleWidth / 2}
                    y={yTop}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={candleColor}
                    rx={1.5}
                  />
                </React.Fragment>
              );
            })
          )}
        </Svg>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginVertical: 12,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartBadge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  modeToggleRow: {
    flexDirection: 'row',
    borderRadius: 6,
    padding: 2,
  },
  modeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ohlcStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  ohlcItem: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  ohlcLabel: {
    fontWeight: '700',
    opacity: 0.6,
  },
  chartArea: {
    flex: 1,
    justifyContent: 'center',
  },
});
