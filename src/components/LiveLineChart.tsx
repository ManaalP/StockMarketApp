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
import { useTheme } from '../theme/useTheme';
import { priceStore } from '../stores/priceStore';
import { formatINR } from '../domain/format';
import {
  type TickPoint,
  type TimeCandle,
  pushTick,
  computeYDomain,
  buildLinePath,
  buildAreaPath,
  buildTimeCandles,
  chooseBucketMs,
  niceTicks,
  timeLabels,
  direction,
} from '../domain/chart';

export const MAX_RING_BUFFER_POINTS = 120;
export const CHART_FLUSH_INTERVAL_MS = 250;

export type ChartMode = 'line' | 'candle';

export interface LiveLineChartProps {
  readonly symbol: string;
  readonly height?: number;
  readonly initialMode?: ChartMode;
  readonly testID?: string;
}

export const LiveLineChart = memo(function LiveLineChart({
  symbol,
  height = 240,
  initialMode = 'line',
  testID = 'detail.chart',
}: LiveLineChartProps) {
  const { tokens } = useTheme();
  const [containerWidth, setContainerWidth] = useState(340);
  const [chartMode, setChartMode] = useState<ChartMode>(initialMode);
  const [selectedCandle, setSelectedCandle] = useState<TimeCandle | null>(null);

  // Ring buffer of TickPoint ({ t, price }) kept in ref to prevent unthrottled re-renders
  const pointsRef = useRef<TickPoint[]>([]);
  // Rendered points updated only on throttled flush (~250 ms)
  const [renderedPoints, setRenderedPoints] = useState<TickPoint[]>([]);
  const [tickCount, setTickCount] = useState<number>(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      setContainerWidth((prev) => (prev !== w ? w : prev));
    }
  }, []);

  useEffect(() => {
    pointsRef.current = [];
    const initialQuote = priceStore.getQuote(symbol);
    if (initialQuote && initialQuote.ltp !== null) {
      const initPt: TickPoint = { t: Date.now(), price: initialQuote.ltp };
      pointsRef.current = [initPt];
      setRenderedPoints([initPt]);
      setTickCount(1);
    } else {
      setRenderedPoints([]);
      setTickCount(0);
    }
    setSelectedCandle(null);

    let timer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const scheduleFlush = () => {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        if (isMounted) {
          const pts = pointsRef.current;
          setRenderedPoints([...pts]);
          setTickCount(pts.length);
        }
      }, CHART_FLUSH_INTERVAL_MS);
    };

    // Direct priceStore subscription for symbol only. Do NOT call usePrice() in this component.
    const unsubscribe = priceStore.subscribe(symbol, () => {
      const q = priceStore.getQuote(symbol);
      if (q && q.ltp !== null) {
        const pt: TickPoint = { t: Date.now(), price: q.ltp };
        pointsRef.current = pushTick(pointsRef.current, pt, MAX_RING_BUFFER_POINTS);
        scheduleFlush();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [symbol]);

  const currentQuote = priceStore.getQuote(symbol);
  const prevClose = currentQuote?.prevClose ?? null;
  const dir = direction(renderedPoints, prevClose);
  const strokeColor = dir === 'up' ? tokens.gain : dir === 'down' ? tokens.loss : tokens.primary;
  const fillColor = strokeColor;

  // Empty state under 2 points
  if (renderedPoints.length < 2) {
    return (
      <View
        testID={testID}
        onLayout={handleLayout}
        style={[
          styles.container,
          {
            backgroundColor: tokens.surface,
            borderColor: tokens.border,
            height,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: tokens.textSecondary }]}>
            Live ticks since you opened this screen
          </Text>
          <Text style={[styles.tickCount, { color: tokens.textMuted }]}>
            {tickCount} {tickCount === 1 ? 'tick' : 'ticks'}
          </Text>
        </View>

        <View testID="detail.chart.empty" style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={tokens.primary} style={styles.spinner} />
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            Waiting for first tick...
          </Text>
        </View>
      </View>
    );
  }

  const plotPaddingRight = 75; // for niceTicks price labels
  const plotPaddingTop = 16;
  const plotPaddingBottom = 26;
  const usableWidth = Math.max(100, containerWidth - plotPaddingRight - 24);
  const usableHeight = Math.max(80, height - plotPaddingTop - plotPaddingBottom - 80);

  // Y-Domain over points and prevClose
  const yDomain = computeYDomain(renderedPoints, [prevClose]);
  const yTicks = niceTicks(yDomain.min, yDomain.max, 3);
  const xLabels = timeLabels(renderedPoints, 4);

  // Last point coordinates
  const lastPoint = renderedPoints[renderedPoints.length - 1]!;
  const span = Math.max(1, yDomain.max - yDomain.min);
  const lastNorm = (lastPoint.price - yDomain.min) / span;
  const lastY = usableHeight - lastNorm * usableHeight;
  const lastX = usableWidth;

  // PrevClose line position (only if inside range)
  let prevCloseY: number | null = null;
  if (prevClose !== null && prevClose >= yDomain.min && prevClose <= yDomain.max) {
    const pcNorm = (prevClose - yDomain.min) / span;
    prevCloseY = usableHeight - pcNorm * usableHeight;
  }

  // Paths
  const linePath = buildLinePath(renderedPoints, usableWidth, usableHeight, yDomain);
  const areaPath = buildAreaPath(renderedPoints, usableWidth, usableHeight, yDomain);

  // Candles
  const bucketMs = chooseBucketMs(renderedPoints);
  const candles = buildTimeCandles(renderedPoints, bucketMs);
  const candleSlotWidth = candles.length > 0 ? usableWidth / candles.length : 0;
  const candleBodyWidth = Math.max(4, Math.min(20, candleSlotWidth * 0.7));

  return (
    <View
      testID={testID}
      onLayout={handleLayout}
      style={[
        styles.container,
        {
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
          height,
        },
      ]}
    >
      {/* Chart Title Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: tokens.textSecondary }]} numberOfLines={1}>
          Live ticks since you opened this screen
        </Text>
        <Text style={[styles.tickCount, { color: tokens.textMuted }]}>
          {tickCount} {tickCount === 1 ? 'tick' : 'ticks'}
        </Text>
      </View>

      {/* Mode Selector Row (Fits width without clipping) */}
      <View style={styles.controlsRow}>
        <View style={[styles.modeToggleGroup, { backgroundColor: tokens.surfaceAlt, borderColor: tokens.border }]}>
          <Pressable
            testID="detail.chart.mode.line"
            accessibilityRole="button"
            accessibilityLabel="Line chart view"
            onPress={() => {
              setChartMode('line');
              setSelectedCandle(null);
            }}
            style={[
              styles.modeButton,
              chartMode === 'line' && { backgroundColor: tokens.primary },
            ]}
          >
            <Text
              style={[
                styles.modeButtonText,
                { color: chartMode === 'line' ? '#ffffff' : tokens.textSecondary },
              ]}
            >
              Line
            </Text>
          </Pressable>

          <Pressable
            testID="detail.chart.mode.candle"
            accessibilityRole="button"
            accessibilityLabel="Candlestick chart view"
            onPress={() => setChartMode('candle')}
            style={[
              styles.modeButton,
              chartMode === 'candle' && { backgroundColor: tokens.primary },
            ]}
          >
            <Text
              style={[
                styles.modeButtonText,
                { color: chartMode === 'candle' ? '#ffffff' : tokens.textSecondary },
              ]}
            >
              Candles
            </Text>
          </Pressable>
        </View>

        {selectedCandle ? (
          <View style={styles.candleReadoutRow}>
            <Text style={[styles.candleReadoutText, { color: tokens.textSecondary }]}>
              O: {formatINR(selectedCandle.open)} H: {formatINR(selectedCandle.high)} L: {formatINR(selectedCandle.low)} C: {formatINR(selectedCandle.close)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* SVG Plot Canvas */}
      <View style={[styles.plotArea, { height: usableHeight + plotPaddingTop + plotPaddingBottom }]}>
        <Svg width={containerWidth - 24} height={usableHeight + plotPaddingTop + plotPaddingBottom}>
          {/* Prev Close Muted Dashed Reference Line (only when inside domain) */}
          {prevCloseY !== null ? (
            <>
              <SvgLine
                x1={0}
                y1={prevCloseY + plotPaddingTop}
                x2={usableWidth}
                y2={prevCloseY + plotPaddingTop}
                stroke={tokens.textMuted}
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.4}
              />
              <SvgText
                x={usableWidth + 6}
                y={prevCloseY + plotPaddingTop + 3}
                fill={tokens.textMuted}
                fontSize={9}
                opacity={0.7}
              >
                Prev close
              </SvgText>
            </>
          ) : null}

          {/* Line Mode View */}
          {chartMode === 'line' ? (
            <>
              {/* Soft area fill at 8% opacity */}
              <Path
                d={areaPath}
                fill={fillColor}
                opacity={0.08}
                transform={`translate(0, ${plotPaddingTop})`}
              />

              {/* 2px stroke line */}
              <Path
                testID="live.chart.path"
                d={linePath}
                stroke={strokeColor}
                strokeWidth={2}
                fill="none"
                transform={`translate(0, ${plotPaddingTop})`}
              />

              {/* Last price dot */}
              <Circle
                cx={lastX}
                cy={lastY + plotPaddingTop}
                r={3.5}
                fill={strokeColor}
              />

              {/* Last price tag / line on right edge */}
              <SvgLine
                x1={0}
                y1={lastY + plotPaddingTop}
                x2={usableWidth}
                y2={lastY + plotPaddingTop}
                stroke={strokeColor}
                strokeWidth={1}
                strokeDasharray="2 3"
                opacity={0.3}
              />
            </>
          ) : (
            /* Candlestick Mode View */
            candles.map((candle, idx) => {
              const xCenter = idx * candleSlotWidth + candleSlotWidth / 2;
              const openNorm = (candle.open - yDomain.min) / span;
              const closeNorm = (candle.close - yDomain.min) / span;
              const highNorm = (candle.high - yDomain.min) / span;
              const lowNorm = (candle.low - yDomain.min) / span;

              const openY = usableHeight - openNorm * usableHeight + plotPaddingTop;
              const closeY = usableHeight - closeNorm * usableHeight + plotPaddingTop;
              const highY = usableHeight - highNorm * usableHeight + plotPaddingTop;
              const lowY = usableHeight - lowNorm * usableHeight + plotPaddingTop;

              const isGain = candle.close >= candle.open;
              const candleColor = isGain ? tokens.gain : tokens.loss;
              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(2, Math.abs(openY - closeY));

              return (
                <React.Fragment key={candle.startT}>
                  {/* Wick */}
                  <SvgLine
                    testID={`chart.candle.wick.${idx}`}
                    x1={xCenter}
                    y1={highY}
                    x2={xCenter}
                    y2={lowY}
                    stroke={candleColor}
                    strokeWidth={1.5}
                  />

                  {/* Body */}
                  <Rect
                    testID={`chart.candle.body.${idx}`}
                    x={xCenter - candleBodyWidth / 2}
                    y={bodyTop}
                    width={candleBodyWidth}
                    height={bodyHeight}
                    fill={candleColor}
                    rx={1}
                    onPress={() => setSelectedCandle(candle)}
                  />
                </React.Fragment>
              );
            })
          )}

          {/* Right Y-Axis: niceTicks (3 labels max, no collision) */}
          {yTicks.map((tickVal) => {
            const tNorm = (tickVal - yDomain.min) / span;
            const yPos = usableHeight - tNorm * usableHeight + plotPaddingTop + 3;
            return (
              <SvgText
                key={tickVal}
                x={usableWidth + 6}
                y={yPos}
                fill={tokens.textMuted}
                fontSize={10}
                fontWeight="500"
              >
                {formatINR(tickVal)}
              </SvgText>
            );
          })}

          {/* Bottom X-Axis: timeLabels (max 4, no collision) */}
          {xLabels.map((lbl) => {
            const xPos = lbl.xFraction * usableWidth;
            return (
              <SvgText
                key={lbl.t}
                x={xPos}
                y={usableHeight + plotPaddingTop + 18}
                fill={tokens.textMuted}
                fontSize={9}
                textAnchor={lbl.xFraction > 0.8 ? 'end' : lbl.xFraction < 0.2 ? 'start' : 'middle'}
              >
                {lbl.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  tickCount: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modeToggleGroup: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
    alignSelf: 'flex-start',
  },
  modeButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  candleReadoutRow: {
    flex: 1,
    marginLeft: 10,
    alignItems: 'flex-end',
  },
  candleReadoutText: {
    fontSize: 10,
    fontWeight: '500',
  },
  plotArea: {
    width: '100%',
    overflow: 'hidden',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  spinner: {
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
