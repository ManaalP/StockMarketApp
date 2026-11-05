import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Path, Circle, Line as SvgLine, Rect, Text as SvgText } from 'react-native-svg';
import {
  PinchGestureHandler,
  type PinchGestureHandlerGestureEvent,
  State,
} from 'react-native-gesture-handler';
import { useTheme } from '../theme/useTheme';
import { priceStore, usePrice } from '../stores/priceStore';
import { chartPath } from '../domain/chart';
import { formatINR } from '../domain/format';
import {
  generateCandlesForTimeframe,
  applyZoomToCandles,
  type ChartTimeframe,
  type CandleData,
} from '../domain/candles';
import type { Quote } from '../domain/types';
import type { Paise } from '../domain/money';

export const MAX_RING_BUFFER_POINTS = 120;
export const CHART_FLUSH_INTERVAL_MS = 250;

export type ChartMode = 'candle' | 'line';
export { type CandleData, type ChartTimeframe };

export interface LiveLineChartProps {
  readonly symbol: string;
  readonly height?: number;
  readonly initialMode?: ChartMode;
  readonly testID?: string;
}

/**
 * Backward-compatible helper for 1D candle generation.
 */
export function generateCandles(
  quote: Quote | null,
  renderedPoints: number[]
): CandleData[] {
  return generateCandlesForTimeframe('1D', quote, renderedPoints);
}

const TIMEFRAMES: readonly ChartTimeframe[] = ['1D', '1W', '1M', '1Y'];

/**
 * High-performance, professional live market chart supporting OHLC Candlestick,
 * timeframe filters (1D, 1W, 1M, 1Y), pinch-to-zoom, Y-axis price labels, and candle inspection.
 */
export const LiveLineChart = memo(function LiveLineChart({
  symbol,
  height = 240,
  initialMode = 'candle',
  testID,
}: LiveLineChartProps) {
  const { tokens } = useTheme();
  const quote = usePrice(symbol);
  const [containerWidth, setContainerWidth] = useState(340);
  const [chartMode, setChartMode] = useState<ChartMode>(initialMode);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1D');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [selectedCandleIndex, setSelectedCandleIndex] = useState<number | null>(null);

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
    setSelectedCandleIndex(null);

    let timer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const scheduleFlush = () => {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        if (isMounted) {
          setRenderedPoints([...pointsRef.current]);
        }
      }, CHART_FLUSH_INTERVAL_MS);
    };

    const unsubscribe = priceStore.subscribe(symbol, () => {
      const q = priceStore.getQuote(symbol);
      if (q && q.ltp !== null) {
        const buf = pointsRef.current;
        buf.push(q.ltp);
        if (buf.length > MAX_RING_BUFFER_POINTS) {
          buf.shift();
        }
        scheduleFlush();
      }
    });

    return () => {
      isMounted = false;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      unsubscribe();
    };
  }, [symbol]);

  const handlePinchGesture = useCallback((event: PinchGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      const scale = event.nativeEvent.scale;
      setZoomLevel((prev) => {
        const next = Math.max(0.6, Math.min(2.2, prev * (1 + (scale - 1) * 0.1)));
        return Math.round(next * 100) / 100;
      });
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((z) => Math.min(2.0, Math.round((z + 0.25) * 100) / 100));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((z) => Math.max(0.75, Math.round((z - 0.25) * 100) / 100));
  }, []);

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

  const plotHeight = height - 76; // reserve space for top bar, timeframe filter, and X-axis
  const firstPrice: Paise = renderedPoints[0]!;
  const latestPrice: Paise = renderedPoints[renderedPoints.length - 1]!;
  const isUp = latestPrice >= firstPrice;
  const strokeColor = isUp ? tokens.gain : tokens.loss;

  // Generate candles for chosen timeframe and zoom
  const allCandles = generateCandlesForTimeframe(timeframe, quote, renderedPoints);
  const visibleCandles = applyZoomToCandles(allCandles, zoomLevel);

  // Selected candle (or fallback to latest)
  const activeCandle =
    selectedCandleIndex !== null && visibleCandles[selectedCandleIndex]
      ? visibleCandles[selectedCandleIndex]
      : visibleCandles[visibleCandles.length - 1] ?? null;

  const openPaise = activeCandle?.open ?? quote?.open ?? firstPrice;
  const highPaise = activeCandle?.high ?? quote?.high ?? Math.max(...renderedPoints);
  const lowPaise = activeCandle?.low ?? quote?.low ?? Math.min(...renderedPoints);
  const closePaise = activeCandle?.close ?? latestPrice;

  // Domain range
  const candleHighs = visibleCandles.map((c) => c.high);
  const candleLows = visibleCandles.map((c) => c.low);
  const minVal = Math.min(...candleLows, quote?.low ?? latestPrice, ...renderedPoints);
  const maxVal = Math.max(...candleHighs, quote?.high ?? latestPrice, ...renderedPoints);
  const spread = Math.max(maxVal - minVal, 100);
  const paddingVal = Math.round(spread * 0.08);
  const domainMin = minVal - paddingVal;
  const domainMax = maxVal + paddingVal;
  const domainRange = domainMax - domainMin || 1;

  const yRailWidth = 58;
  const usableWidth = containerWidth - yRailWidth;

  const getY = (val: number) => {
    const clampedVal = Math.max(domainMin, Math.min(domainMax, val));
    return plotHeight - 18 - ((clampedVal - domainMin) / domainRange) * (plotHeight - 34);
  };

  // Line chart path calculation
  const { path } = chartPath(renderedPoints, usableWidth, plotHeight, 14);
  const displayPath =
    renderedPoints.length === 1
      ? `M 0,${(plotHeight / 2).toFixed(1)} L ${usableWidth},${(plotHeight / 2).toFixed(1)}`
      : path;

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
      {/* Top Header Row: Mode Switcher, Timeframe Filters, and Zoom Controls */}
      <View style={[styles.topBar, { borderBottomColor: tokens.border }]}>
        {/* Timeframe Filters (1D, 1W, 1M, 1Y) */}
        <View style={styles.timeframeRow}>
          {TIMEFRAMES.map((tf) => {
            const isActive = timeframe === tf;
            return (
              <Pressable
                key={tf}
                testID={`chart.filter.${tf}`}
                accessibilityRole="button"
                accessibilityLabel={`Select ${tf} timeframe`}
                onPress={() => {
                  setTimeframe(tf);
                  setSelectedCandleIndex(null);
                }}
                style={[
                  styles.filterPill,
                  isActive && { backgroundColor: tokens.primary + '20', borderColor: tokens.primary },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: isActive ? tokens.primary : tokens.textMuted },
                  ]}
                >
                  {tf}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Zoom In/Out Controls */}
        <View style={styles.zoomRow}>
          <Pressable
            testID="chart.zoom.out"
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
            onPress={handleZoomOut}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={[styles.zoomBtn, { backgroundColor: tokens.surfaceContainer }]}
          >
            <Text style={[styles.zoomBtnText, { color: tokens.textPrimary }]}>−</Text>
          </Pressable>
          <Text style={[styles.zoomText, { color: tokens.textMuted }]}>{`${zoomLevel.toFixed(1)}x`}</Text>
          <Pressable
            testID="chart.zoom.in"
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
            onPress={handleZoomIn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={[styles.zoomBtn, { backgroundColor: tokens.surfaceContainer }]}
          >
            <Text style={[styles.zoomBtnText, { color: tokens.textPrimary }]}>+</Text>
          </Pressable>
        </View>

        {/* View Toggle: Candles vs Line */}
        <View style={[styles.modeToggleRow, { backgroundColor: tokens.surfaceContainer }]}>
          <Pressable
            testID="chart.mode.candle"
            accessibilityRole="button"
            accessibilityLabel="Switch to Candlestick chart"
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
              Candles
            </Text>
          </Pressable>
          <Pressable
            testID="chart.mode.line"
            accessibilityRole="button"
            accessibilityLabel="Switch to Line chart"
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
        {activeCandle ? (
          <Text style={[styles.ohlcItem, { color: tokens.primary, fontWeight: '600' }]}>
            {activeCandle.label}
          </Text>
        ) : null}
      </View>

      {/* Interactive Pinch Gesture Canvas */}
      <PinchGestureHandler onGestureEvent={handlePinchGesture}>
        <View style={styles.chartArea}>
          <Svg width={containerWidth} height={plotHeight}>
            {/* Grid line for High */}
            <SvgLine
              x1={0}
              y1={getY(highPaise)}
              x2={usableWidth}
              y2={getY(highPaise)}
              stroke={tokens.border}
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <SvgText
              x={usableWidth + 4}
              y={getY(highPaise) + 3}
              fill={tokens.gain}
              fontSize="9"
              fontWeight="600"
            >
              {formatINR(highPaise)}
            </SvgText>

            {/* Grid line for Low */}
            <SvgLine
              x1={0}
              y1={getY(lowPaise)}
              x2={usableWidth}
              y2={getY(lowPaise)}
              stroke={tokens.border}
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <SvgText
              x={usableWidth + 4}
              y={getY(lowPaise) + 3}
              fill={tokens.loss}
              fontSize="9"
              fontWeight="600"
            >
              {formatINR(lowPaise)}
            </SvgText>

            {/* Previous close line */}
            {quote?.prevClose ? (
              <>
                <SvgLine
                  x1={0}
                  y1={getY(quote.prevClose)}
                  x2={usableWidth}
                  y2={getY(quote.prevClose)}
                  stroke={tokens.border}
                  strokeDasharray="2 3"
                  strokeWidth={0.8}
                />
                <SvgText
                  x={usableWidth + 4}
                  y={getY(quote.prevClose) + 3}
                  fill={tokens.textMuted}
                  fontSize="8"
                >
                  Prev
                </SvgText>
              </>
            ) : null}

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
                    cx={usableWidth}
                    cy={getY(latestPrice)}
                    r={4}
                    fill={strokeColor}
                  />
                ) : null}
              </>
            ) : (
              // Candlesticks with labels and interactive touch columns
              visibleCandles.map((c, idx) => {
                const slotWidth = usableWidth / visibleCandles.length;
                const candleWidth = Math.max(10, Math.min(26, Math.floor(slotWidth * 0.65)));
                const xCenter = idx * slotWidth + slotWidth / 2;
                const isGreen = c.close >= c.open;
                const candleColor = isGreen ? tokens.gain : tokens.loss;
                const yHigh = getY(c.high);
                const yLow = getY(c.low);
                const yTop = getY(Math.max(c.open, c.close));
                const yBottom = getY(Math.min(c.open, c.close));
                const bodyHeight = Math.max(2.5, yBottom - yTop);
                const isSelected = selectedCandleIndex === idx;

                return (
                  <React.Fragment key={`candle-${idx}`}>
                    {/* Selected column highlight vertical line */}
                    {isSelected ? (
                      <SvgLine
                        x1={xCenter}
                        y1={0}
                        x2={xCenter}
                        y2={plotHeight - 14}
                        stroke={tokens.primary}
                        strokeDasharray="2 2"
                        strokeWidth={1}
                        opacity={0.7}
                      />
                    ) : null}

                    {/* Wick */}
                    <SvgLine
                      testID={`chart.candle.wick.${idx}`}
                      x1={xCenter}
                      y1={yHigh}
                      x2={xCenter}
                      y2={yLow}
                      stroke={candleColor}
                      strokeWidth={1.5}
                    />

                    {/* Body */}
                    <Rect
                      testID={`chart.candle.body.${idx}`}
                      x={xCenter - candleWidth / 2}
                      y={yTop}
                      width={candleWidth}
                      height={bodyHeight}
                      fill={candleColor}
                      rx={1.5}
                    />

                    {/* Candle X-Axis Date/Time Label */}
                    <SvgText
                      testID={`chart.candle.label.${idx}`}
                      x={xCenter}
                      y={plotHeight - 2}
                      textAnchor="middle"
                      fill={isSelected ? tokens.primary : tokens.textMuted}
                      fontSize="9"
                      fontWeight={isSelected ? '700' : '500'}
                    >
                      {c.label}
                    </SvgText>
                  </React.Fragment>
                );
              })
            )}

            {/* Current Active Price Pill Badge on Right Rail */}
            <Rect
              x={usableWidth + 2}
              y={getY(latestPrice) - 7}
              width={yRailWidth - 4}
              height={14}
              fill={isUp ? tokens.gain : tokens.loss}
              rx={3}
            />
            <SvgText
              testID="chart.active.price.badge"
              x={usableWidth + (yRailWidth - 4) / 2 + 2}
              y={getY(latestPrice) + 3}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="8"
              fontWeight="700"
            >
              {formatINR(latestPrice)}
            </SvgText>
          </Svg>

          {/* Invisible tap targets overlay for candle inspection */}
          {chartMode === 'candle' ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <View style={[styles.touchTargetRow, { width: usableWidth, height: plotHeight }]}>
                {visibleCandles.map((c, idx) => (
                  <Pressable
                    key={`touch-${idx}`}
                    testID={`chart.candle.touch.${idx}`}
                    accessibilityLabel={`Candle ${c.label}`}
                    onPress={() => setSelectedCandleIndex((prev) => (prev === idx ? null : idx))}
                    style={styles.candleTouchTarget}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </PinchGestureHandler>
    </View>
  );
});

export const CandlestickChart = LiveLineChart;

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  timeframeRow: {
    flexDirection: 'row',
    gap: 3,
  },
  filterPill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  zoomBtn: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 14,
  },
  zoomText: {
    fontSize: 9,
    fontWeight: '600',
    minWidth: 22,
    textAlign: 'center',
  },
  modeToggleRow: {
    flexDirection: 'row',
    borderRadius: 5,
    padding: 2,
  },
  modeBtn: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3,
  },
  modeBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ohlcStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
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
    position: 'relative',
  },
  touchTargetRow: {
    flexDirection: 'row',
  },
  candleTouchTarget: {
    flex: 1,
    height: '100%',
  },
});
