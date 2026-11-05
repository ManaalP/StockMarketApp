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
import { useLtp, useDayRefs } from '../stores/priceStore';
import { useHolding } from '../stores/portfolioStore';
import { COMPANY_NAMES } from '../data/constants';
import { rowMetrics } from '../domain/calcs';
import { formatINR } from '../domain/format';
import { PriceText } from './PriceText';
import { PnLText } from './PnLText';
import { PriceFlash } from './PriceFlash';
import { PerfBadge } from './PerfBadge';
import { useRenderCount } from '../utils/useRenderCount';

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
 * - Minimal, clean financial hierarchy (Groww / Zerodha style).
 */
export const HoldingRow = memo(function HoldingRow({
  symbol,
  onPress,
  style,
  testID,
}: HoldingRowProps) {
  const { tokens } = useTheme();
  const ltp = useLtp(symbol);
  const dayRefs = useDayRefs(symbol);
  const holding = useHolding(symbol);

  const metrics = holding
    ? rowMetrics(holding, { ltp, prevClose: dayRefs.prevClose })
    : null;
  const companyName = COMPANY_NAMES[symbol] ?? symbol;
  const renderCount = useRenderCount();

  const handlePress = useCallback(() => {
    onPress?.(symbol);
  }, [onPress, symbol]);

  return (
    <Pressable
      testID={testID ?? `holding.row.${symbol}`}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${symbol}, ${companyName}, ${holding ? holding.qty : 0} shares`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? tokens.surfaceAlt : tokens.surface,
          borderBottomColor: tokens.border,
        },
        style,
      ]}
    >
      {/* Left Column: Stock Symbol, Badge, Company Name, Quantity, Avg, LTP */}
      <View style={styles.leftCol}>
        <View style={styles.symbolRow}>
          <Text
            style={[styles.symbolText, { color: tokens.textPrimary }]}
            numberOfLines={1}
          >
            {symbol}
          </Text>
          <View style={[styles.badge, { backgroundColor: tokens.surfaceContainer }]}>
            <Text style={[styles.badgeText, { color: tokens.textSecondary }]}>
              EQ
            </Text>
          </View>
          <PerfBadge symbol={symbol} renderCount={renderCount} />
        </View>

        <Text
          style={[styles.companyText, { color: tokens.textMuted }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {companyName}
        </Text>

        <Text
          style={[styles.sharesText, { color: tokens.textMuted }]}
          numberOfLines={1}
        >
          {holding
            ? `${holding.qty} shares • Avg ${formatINR(holding.avgPaise)} • LTP ${formatINR(ltp)}`
            : '--'}
        </Text>
      </View>

      {/* Right Column: Holding Current Value (qty * ltp), Total Gain/Loss (Amount + %) */}
      <View style={styles.rightCol}>
        <PriceFlash ltp={metrics?.valuePaise ?? null} testID={`holding.flash.${symbol}`}>
          <PriceText
            paise={metrics?.valuePaise ?? null}
            testID={`holding.value.${symbol}`}
            style={[styles.holdingValueText, { color: tokens.textPrimary }]}
          />
        </PriceFlash>
        <PnLText
          pnlPaise={metrics?.pnlPaise ?? null}
          pnlPct={metrics?.pnlPct ?? null}
          testID={`holding.pnl.${symbol}`}
          style={styles.pnlText}
        />
        <PriceText
          paise={ltp}
          testID={`holding.ltp.${symbol}`}
          style={styles.hiddenLtp}
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
    paddingRight: 12,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  symbolText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  badge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  perfBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  perfText: {
    fontSize: 9,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  companyText: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  sharesText: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  holdingValueText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  pnlText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    fontWeight: '500',
  },
  hiddenLtp: {
    display: 'none',
  },
});
