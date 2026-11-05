import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { priceStore } from '../stores/priceStore';
import { chartPath } from '../domain/chart';
import type { Paise } from '../domain/money';

export const MAX_RING_BUFFER_POINTS = 120;
export const CHART_FLUSH_INTERVAL_MS = 250;

export interface LiveLineChartProps {
  readonly symbol: string;
  readonly height?: number;
  readonly testID?: string;
}

/**
 * High-performance, hand-rolled live tick line chart.
 *
 * Requirements:
 * - Subscribes to live price ticks for the symbol.
 * - Ring buffer capped at 120 points since screen opened.
 * - Batches renders at ~250 ms (never calls setState on every 20 Hz tick!).
 * - Empty state: "Waiting for first tick...".
 * - Line color determined by price direction since opened (gain vs loss).
 */
export const LiveLineChart = memo(function LiveLineChart({
  symbol,
  height = 160,
  testID,
}: LiveLineChartProps) {
  const { tokens } = useTheme();
  const [containerWidth, setContainerWidth] = useState(320);

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
      const quote = priceStore.getQuote(symbol);
      if (quote && quote.ltp !== null) {
        const buf = pointsRef.current;
        buf.push(quote.ltp);
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
  const { path } = chartPath(renderedPoints, containerWidth, height, 12);
  const firstPrice: Paise = renderedPoints[0]!;
  const latestPrice: Paise = renderedPoints[renderedPoints.length - 1]!;
  const isUp = latestPrice >= firstPrice;
  const strokeColor = isUp ? tokens.gain : tokens.loss;

  // Single point case: show flat line across chart
  const displayPath =
    renderedPoints.length === 1
      ? `M 0,${(height / 2).toFixed(1)} L ${containerWidth},${(height / 2).toFixed(1)}`
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
      <View style={styles.chartHeader}>
        <Text style={[styles.chartBadge, { color: strokeColor }]}>
          {`Live Session • ${renderedPoints.length} ${renderedPoints.length === 1 ? 'tick' : 'ticks'}`}
        </Text>
      </View>

      <Svg width={containerWidth} height={height}>
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
            cy={
              renderedPoints.length > 1
                ? height -
                  12 -
                  ((latestPrice - Math.min(...renderedPoints)) /
                    (Math.max(...renderedPoints) - Math.min(...renderedPoints) || 1)) *
                    (height - 24)
                : height / 2
            }
            r={4}
            fill={strokeColor}
          />
        ) : null}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
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
  chartHeader: {
    position: 'absolute',
    top: 10,
    left: 12,
    zIndex: 2,
  },
  chartBadge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
