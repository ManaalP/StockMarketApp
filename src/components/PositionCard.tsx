import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { useHolding } from '../stores/portfolioStore';
import { usePrice } from '../stores/priceStore';
import { rowMetrics } from '../domain/calcs';
import { formatINR } from '../domain/format';
import { PriceText } from './PriceText';
import { PnLText } from './PnLText';

export interface PositionCardProps {
  readonly symbol: string;
  readonly testID?: string;
}

/**
 * Functional component displaying the user's current holding position in a stock.
 *
 * Requirements:
 * - Rendered ONLY when the stock is held in portfolio (returns null if not held).
 * - Displays Quantity, Average price, Invested, Current value, Total P&L, and Today's P&L.
 * - Computes values using pure domain `rowMetrics`.
 * - Missing price cleanly renders "--" without guessing or assuming 0.
 */
export const PositionCard = memo(function PositionCard({
  symbol,
  testID,
}: PositionCardProps) {
  const { tokens } = useTheme();
  const holding = useHolding(symbol);
  const quote = usePrice(symbol);

  if (!holding) {
    return null;
  }

  const metrics = rowMetrics(holding, quote);

  return (
    <View
      testID={testID ?? `position.card.${symbol}`}
      style={[
        styles.card,
        {
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>
          Your Position
        </Text>
        <View style={[styles.badge, { backgroundColor: tokens.surfaceContainer }]}>
          <Text style={[styles.badgeText, { color: tokens.textSecondary }]}>
            {`${holding.qty} SHARES`}
          </Text>
        </View>
      </View>

      {/* Row 1: Avg Price & Total Invested */}
      <View style={styles.metricRow}>
        <View style={styles.metricCol}>
          <Text style={[styles.label, { color: tokens.textMuted }]}>
            Avg. Price
          </Text>
          <Text
            testID={`position.avgPrice.${symbol}`}
            style={[styles.val, { color: tokens.textPrimary }]}
          >
            {formatINR(holding.avgPaise)}
          </Text>
        </View>

        <View style={[styles.metricCol, styles.alignRight]}>
          <Text style={[styles.label, { color: tokens.textMuted }]}>
            Total Invested
          </Text>
          <Text
            testID={`position.invested.${symbol}`}
            style={[styles.val, { color: tokens.textPrimary }]}
          >
            {formatINR(metrics.investedPaise)}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: tokens.border }]} />

      {/* Row 2: Current Value & Total P&L */}
      <View style={styles.metricRow}>
        <View style={styles.metricCol}>
          <Text style={[styles.label, { color: tokens.textMuted }]}>
            Current Value
          </Text>
          <PriceText
            paise={metrics.valuePaise}
            testID={`position.value.${symbol}`}
            style={styles.val}
          />
        </View>

        <View style={[styles.metricCol, styles.alignRight]}>
          <Text style={[styles.label, { color: tokens.textMuted }]}>
            Total P&L
          </Text>
          <PnLText
            pnlPaise={metrics.pnlPaise}
            pnlPct={metrics.pnlPct}
            testID={`position.pnl.${symbol}`}
            style={styles.val}
          />
        </View>
      </View>

      {/* Row 3: Today's P&L */}
      <View style={[styles.metricRow, styles.marginTopSmall]}>
        <View style={styles.metricCol}>
          <Text style={[styles.label, { color: tokens.textMuted }]}>
            Today's P&L
          </Text>
          <PnLText
            pnlPaise={metrics.dayPnlPaise}
            testID={`position.todayPnl.${symbol}`}
            style={styles.val}
          />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  marginTopSmall: {
    marginTop: 8,
  },
  metricCol: {
    flex: 1,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  val: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
});
