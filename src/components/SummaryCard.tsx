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
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
        },
        style,
      ]}
    >
      {/* Top Section: Primary Metric (Current value full-width hero + Total return alongside/below) */}
      <View style={styles.primaryContainer}>
        <View style={styles.primaryHeaderRow}>
          <View style={styles.labelRow}>
            <Text style={[styles.primaryLabel, { color: tokens.textMuted }]}>
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
        </View>

        <PriceText
          paise={totals?.currentValuePaise ?? null}
          testID="summary.currentValue"
          style={[styles.currentValueText, { color: tokens.textPrimary }]}
        />

        <View style={styles.pnlSubRow}>
          <Text style={[styles.pnlSubLabel, { color: tokens.textMuted }]}>
            Total P&L
          </Text>
          <View
            style={[
              styles.pnlBadge,
              {
                backgroundColor:
                  (totals?.totalPnlPaise ?? 0) > 0
                    ? tokens.gainBg
                    : (totals?.totalPnlPaise ?? 0) < 0
                    ? tokens.lossBg
                    : tokens.surfaceAlt,
              },
            ]}
          >
            <PnLText
              pnlPaise={totals?.totalPnlPaise ?? null}
              pnlPct={totals?.totalPnlPct ?? null}
              testID="summary.totalPnl"
              style={styles.totalPnlText}
            />
          </View>
        </View>
      </View>

      {/* Secondary Metrics: Space-efficient 3-column / 2-column strip */}
      <View style={[styles.metricsStrip, { borderTopColor: tokens.border }]}>
        {/* Total Invested */}
        <View style={styles.metricItem}>
          <Text style={[styles.subLabel, { color: tokens.textMuted }]}>
            Total invested
          </Text>
          <PriceText
            paise={totals?.totalInvestedPaise ?? null}
            testID="summary.totalInvested"
            style={[styles.metricValue, { color: tokens.textSecondary }]}
          />
        </View>

        {/* Divider */}
        <View style={[styles.verticalDivider, { backgroundColor: tokens.border }]} />

        {/* 1D Today's P&L */}
        <View style={styles.metricItem}>
          <Text style={[styles.subLabel, { color: tokens.textMuted }]}>
            Today's P&L
          </Text>
          <PnLText
            pnlPaise={totals?.todayPnlPaise ?? null}
            pnlPct={totals?.todayPnlPct ?? null}
            testID="summary.todayPnl"
            style={styles.metricValue}
          />
        </View>

        {/* Divider */}
        <View style={[styles.verticalDivider, { backgroundColor: tokens.border }]} />

        {/* Holdings count */}
        <View style={styles.metricItemRight}>
          <Text style={[styles.subLabel, { color: tokens.textMuted }]}>
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

      {/* Subtle unpriced holdings informational note */}
      {unpricedCount > 0 ? (
        <View style={[styles.unpricedNotice, { backgroundColor: tokens.surfaceAlt }]}>
          <Text style={[styles.infoIcon, { color: tokens.textMuted }]}>ℹ</Text>
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
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  primaryContainer: {
    flexDirection: 'column',
  },
  primaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  currentValueText: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  pnlSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  pnlSubLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  pnlBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  totalPnlText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
  metricsStrip: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    justifyContent: 'center',
  },
  metricItemRight: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingLeft: 4,
  },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    marginHorizontal: 8,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  unpricedNotice: {
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoIcon: {
    fontSize: 12,
  },
  unpricedText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
});
