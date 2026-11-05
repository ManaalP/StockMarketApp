import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/useTheme';
import { usePrice } from '../stores/priceStore';
import { useHolding } from '../stores/portfolioStore';
import { rowMetrics } from '../domain/calcs';
import { formatINR } from '../domain/format';
import { PriceText } from './PriceText';
import { PnLText } from './PnLText';

export const HOLDING_ROW_HEIGHT = 72;

export interface HoldingRowProps {
  readonly symbol: string;
  readonly onPress?: (symbol: string) => void;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/**
 * Highly optimized, memoized holding row component.
 *
 * Requirements:
 * - Only receives `symbol` string prop (+ stable onPress callback).
 * - Reads its own quote via `usePrice(symbol)` and holding via `useHolding(symbol)`.
 * - Fixed height of 72px for O(1) FlatList getItemLayout indexing.
 * - Missing price / unpriced holdings (like OLDCO) cleanly render "--".
 * - Never does floating-point money calculations.
 */
export const HoldingRow = memo(function HoldingRow({
  symbol,
  onPress,
  style,
  testID,
}: HoldingRowProps) {
  const { tokens } = useTheme();
  const quote = usePrice(symbol);
  const holding = useHolding(symbol);

  const metrics = holding ? rowMetrics(holding, quote) : null;

  const handlePress = useCallback(() => {
    onPress?.(symbol);
  }, [onPress, symbol]);

  return (
    <Pressable
      testID={testID ?? `holding.row.${symbol}`}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${symbol}, ${holding ? holding.qty : 0} shares`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? tokens.surfaceContainer : tokens.surface,
          borderBottomColor: tokens.border,
        },
        style,
      ]}
    >
      {/* Left Column: Symbol Name, EQ Badge, Quantity and Average Price */}
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
        </View>
        <Text style={[styles.sharesText, { color: tokens.textMuted }]}>
          {holding
            ? `${holding.qty} shares • Avg ${formatINR(holding.avgPaise)}`
            : '--'}
        </Text>
      </View>

      {/* Right Column: Live LTP, Total Gain/Loss (Amount + %) */}
      <View style={styles.rightCol}>
        <PriceText
          paise={quote?.ltp ?? null}
          testID={`holding.ltp.${symbol}`}
          style={styles.ltpText}
        />
        <PnLText
          pnlPaise={metrics?.pnlPaise ?? null}
          pnlPct={metrics?.pnlPct ?? null}
          testID={`holding.pnl.${symbol}`}
          style={styles.pnlText}
        />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: HOLDING_ROW_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftCol: {
    flex: 1,
    justifyContent: 'center',
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  symbolText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  sharesText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  ltpText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  pnlText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});
