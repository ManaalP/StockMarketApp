import React, { memo } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { PriceText } from './PriceText';
import { PnLText } from './PnLText';
import { useSummary } from '../stores/summaryStore';
import { formatINR } from '../domain/format';
import type { PortfolioSummary } from '../domain/types';
import { useRenderCount } from '../utils/useRenderCount';
import { usePerfOverlay } from '../utils/perfOverlay';

export interface SummaryCardProps {
  readonly summary?: PortfolioSummary;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/**
 * Functional component displaying the portfolio summary card.
 *
 * Requirements:
 * - Current value, Total invested, Total P&L (₹ and %), Today's P&L (₹ and %).
 * - Driven by throttled `useSummary()` hook (~4 Hz) to prevent layout thrash at 20 Hz.
 * - Displays unpriced footnote when unpriced holdings exist (e.g. OLDCO).
 * - Renders "--" when nothing is priced.
 * - Layout, hierarchy, and tokens adhere to Stitch design specifications.
 */
export const SummaryCard = memo(function SummaryCard({
  summary: propSummary,
  style,
  testID,
}: SummaryCardProps) {
  const { tokens } = useTheme();
  const storeSummary = useSummary();
  const summary = propSummary ?? storeSummary;

  const renderCount = useRenderCount();
  const showPerf = usePerfOverlay();

  const totals = summary.totals;
  const unpricedCount = summary.unpricedCount;

  return (
    <View
      testID={testID ?? 'portfolio.summaryCard'}
      style={[
        styles.card,
        {
          backgroundColor: tokens.surfaceAlt,
          borderColor: tokens.border,
        },
        style,
      ]}
    >
      {/* Current Portfolio Value */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.label, { color: tokens.textMuted }]}>
            Current value
          </Text>
          {showPerf ? (
            <View style={[styles.perfBadge, { backgroundColor: tokens.warningBg }]}>
              <Text testID="perf.badge.summary" style={[styles.perfBadgeText, { color: tokens.warning }]}>
                {`R: ${renderCount}`}
              </Text>
            </View>
          ) : null}
        </View>
        <PriceText
          paise={totals?.currentValuePaise ?? null}
          testID="summary.currentValue"
          style={[styles.currentValueText, { color: tokens.textPrimary }]}
        />
      </View>

      {/* 2x2 Details Grid */}
      <View style={[styles.grid, { borderTopColor: tokens.border }]}>
        <View style={styles.gridRow}>
          {/* Total Invested */}
          <View style={styles.gridCol}>
            <Text style={[styles.label, { color: tokens.textMuted }]}>
              Total invested
            </Text>
            <PriceText
              paise={totals?.totalInvestedPaise ?? null}
              testID="summary.totalInvested"
              style={[styles.metricValue, { color: tokens.textSecondary }]}
            />
          </View>

          {/* Total P&L */}
          <View style={styles.gridCol}>
            <Text style={[styles.label, { color: tokens.textMuted }]}>
              Total P&L
            </Text>
            <PnLText
              pnlPaise={totals?.totalPnlPaise ?? null}
              pnlPct={totals?.totalPnlPct ?? null}
              testID="summary.totalPnl"
              style={styles.metricValue}
            />
          </View>
        </View>

        <View style={[styles.gridRow, { marginTop: 12 }]}>
          {/* Today's P&L */}
          <View style={styles.gridCol}>
            <Text style={[styles.label, { color: tokens.textMuted }]}>
              Today's P&L
            </Text>
            <PnLText
              pnlPaise={totals?.todayPnlPaise ?? null}
              pnlPct={totals?.todayPnlPct ?? null}
              testID="summary.todayPnl"
              style={styles.metricValue}
            />
          </View>

          {/* Holdings Count */}
          <View style={styles.gridCol}>
            <Text style={[styles.label, { color: tokens.textMuted }]}>
              Holdings
            </Text>
            <Text
              testID="summary.holdingsCount"
              style={[
                styles.metricValue,
                { color: tokens.textSecondary, fontVariant: ['tabular-nums'] },
              ]}
            >
              {`${summary.pricedCount} priced`}
            </Text>
          </View>
        </View>
      </View>

      {/* Unpriced Notice (e.g. OLDCO) */}
      {unpricedCount > 0 ? (
        <View style={[styles.unpricedNotice, { borderTopColor: tokens.border }]}>
          <Text style={[styles.infoIcon, { color: tokens.textMuted }]}>ⓘ</Text>
          <Text
            testID="summary.unpricedNote"
            style={[styles.unpricedText, { color: tokens.textMuted }]}
          >
            {unpricedCount === 1
              ? `1 holding has no price and is left out of these totals (${formatINR(
                  summary.unpricedInvestedPaise
                )} invested).`
              : `${unpricedCount} holdings have no price and are left out of these totals (${formatINR(
                  summary.unpricedInvestedPaise
                )} invested).`}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'column',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  perfBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  perfBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
  },
  currentValueText: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    marginTop: 2,
  },
  grid: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridCol: {
    flex: 1,
  },
  metricValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 2,
  },
  unpricedNotice: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 12,
    lineHeight: 16,
    marginRight: 6,
    marginTop: 1,
  },
  unpricedText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
});
