import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../theme/useTheme';
import { usePrice } from '../stores/priceStore';
import { quoteDayMetrics } from '../domain/calcs';
import { PriceText } from './PriceText';
import { PnLText } from './PnLText';
import { PriceFlash } from './PriceFlash';
import { useRenderCount } from '../utils/useRenderCount';
import { usePerfOverlay } from '../utils/perfOverlay';

export const WATCH_ROW_HEIGHT = 72;

export interface WatchRowProps {
  readonly symbol: string;
  readonly onPress?: (symbol: string) => void;
  readonly onRemove?: (symbol: string) => void;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/**
 * Memoized watchlist row receiving only `symbol` (+ stable callbacks).
 *
 * Requirements:
 * - Subscribes to live quote via `usePrice(symbol)`
 * - Fixed height of 72px for O(1) virtualization indexing
 * - Displays LTP, day change ₹ and %
 * - Missing price cleanly renders "--"
 * - Supports swipe-to-delete via Swipeable
 */
export const WatchRow = memo(function WatchRow({
  symbol,
  onPress,
  onRemove,
  style,
  testID,
}: WatchRowProps) {
  const { tokens } = useTheme();
  const quote = usePrice(symbol);
  const metrics = quoteDayMetrics(quote);

  const renderCount = useRenderCount();
  const showPerf = usePerfOverlay();

  const handlePress = useCallback(() => {
    onPress?.(symbol);
  }, [onPress, symbol]);

  const handleRemove = useCallback(() => {
    onRemove?.(symbol);
  }, [onRemove, symbol]);

  const renderRightActions = useCallback(() => {
    if (!onRemove) return null;
    return (
      <Pressable
        testID={`watch.remove.${symbol}`}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${symbol} from watchlist`}
        onPress={handleRemove}
        style={[styles.removeButton, { backgroundColor: tokens.lossBg }]}
      >
        <Text style={[styles.removeText, { color: tokens.loss }]}>Remove</Text>
      </Pressable>
    );
  }, [handleRemove, onRemove, symbol, tokens.loss, tokens.lossBg]);

  const content = (
    <Pressable
      testID={testID ?? `watch.row.${symbol}`}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${symbol}, ${metrics.isPriced ? 'priced' : 'unpriced'}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? tokens.surfaceContainer : tokens.surface,
          borderBottomColor: tokens.border,
        },
        style,
      ]}
    >
      {/* Left Column: Symbol Name, EQ Badge, Perf badge */}
      <View style={styles.leftCol}>
        <View style={styles.symbolRow}>
          <Text style={[styles.symbolText, { color: tokens.textPrimary }]}>
            {symbol}
          </Text>
          <View style={[styles.badge, { backgroundColor: tokens.surfaceContainer }]}>
            <Text style={[styles.badgeText, { color: tokens.textSecondary }]}>
              EQ
            </Text>
          </View>
          {showPerf ? (
            <View style={[styles.perfBadge, { backgroundColor: tokens.warningBg }]}>
              <Text
                testID={`perf.badge.${symbol}`}
                style={[styles.perfText, { color: tokens.warning }]}
              >
                {`R: ${renderCount}`}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.subText, { color: tokens.textMuted }]}>
          NSE Equity
        </Text>
      </View>

      {/* Right Column: Live LTP, Day change amount and percentage */}
      <View style={styles.rightCol}>
        <PriceFlash ltp={metrics.ltp} testID={`watch.flash.${symbol}`}>
          <PriceText
            paise={metrics.ltp}
            testID={`watch.ltp.${symbol}`}
            style={styles.ltpText}
          />
        </PriceFlash>
        <View style={styles.dayChangeRow}>
          <PnLText
            pnlPaise={metrics.dayChangePaise}
            pnlPct={metrics.dayChangePct}
            testID={`watch.dayChange.${symbol}`}
            style={styles.pnlText}
          />
        </View>
      </View>
    </Pressable>
  );

  if (!onRemove) {
    return content;
  }

  return (
    <Swipeable
      friction={2}
      rightThreshold={40}
      renderRightActions={renderRightActions}
      containerStyle={styles.swipeContainer}
    >
      {content}
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  swipeContainer: {
    height: WATCH_ROW_HEIGHT,
  },
  row: {
    height: WATCH_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftCol: {
    justifyContent: 'center',
    flex: 1,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  perfBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  perfText: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  subText: {
    fontSize: 12,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  ltpText: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pnlText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  dayChangeRow: {
    marginTop: 4,
  },
  removeButton: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
