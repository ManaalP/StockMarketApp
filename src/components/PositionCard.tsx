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
      {/* Header with Title and Quantity Badge */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>
            Your Position
          </Text>
          <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
            Portfolio Holding
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: tokens.surfaceAlt, borderColor: tokens.border }]}>
          <Text style={[styles.badgeText, { color: tokens.primary }]}>
            {`${holding.qty} SHARES`}
          </Text>
        </View>
      </View>

      {/* Primary Value & P&L Hero Strip */}
      <View style={[styles.heroStrip, { backgroundColor: tokens.surfaceAlt, borderColor: tokens.border }]}>
        <View style={styles.heroCol}>
          <Text style={[styles.label, { color: tokens.textMuted }]}>
            Current Value
          </Text>
          <PriceText
            paise={metrics.valuePaise}
            testID={`position.value.${symbol}`}
            style={[styles.heroVal, { color: tokens.textPrimary }]}
          />
        </View>

        <View style={[styles.heroCol, styles.alignRight]}>
          <Text style={[styles.label, { color: tokens.textMuted }]}>
            Total P&L
          </Text>
          <PnLText
            pnlPaise={metrics.pnlPaise}
            pnlPct={metrics.pnlPct}
            testID={`position.pnl.${symbol}`}
            style={styles.heroPnlVal}
          />
        </View>
      </View>

      {/* Secondary Metrics: 3-column structured grid */}
      <View style={styles.gridContainer}>
        <View style={styles.metricItem}>
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

        <View style={styles.metricItem}>
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

        <View style={[styles.metricItem, styles.alignRight]}>
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
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  heroCol: {
    flex: 1,
  },
  heroVal: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  heroPnlVal: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  gridContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 3,
  },
  val: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
