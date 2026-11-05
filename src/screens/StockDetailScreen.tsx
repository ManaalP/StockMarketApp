import React, { useCallback, memo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { usePrice, usePaused } from '../stores/priceStore';
import { useIsInWatchlist, watchlistStore } from '../stores/watchlistStore';
import { quoteDayMetrics } from '../domain/calcs';
import { PriceText } from '../components/PriceText';
import { PnLText } from '../components/PnLText';
import { PausedBanner } from '../components/PausedBanner';
import { DayRangeBar } from '../components/DayRangeBar';
import { StockStatsGrid } from '../components/StockStatsGrid';
import { LiveLineChart } from '../components/LiveLineChart';
import { PositionCard } from '../components/PositionCard';

export interface StockDetailScreenProps {
  readonly symbol: string;
  readonly onBack?: () => void;
  readonly onBuy?: (symbol: string) => void;
  readonly onSell?: (symbol: string) => void;
  readonly testID?: string;
}

/**
 * Functional Stock Detail Screen.
 *
 * Requirements:
 * - 100% functional architecture.
 * - Subscribes to live price via `usePrice(symbol)` and pause state via `usePaused()`.
 * - Isolated Stat components for minimal re-rendering.
 * - Price unavailable state cleanly renders "--" everywhere and disables trading.
 * - Watchlist star button for quick toggle.
 * - Does NOT show P/E, market cap, 52-week, depth, or range tabs.
 */
export const StockDetailScreen = memo(function StockDetailScreen({
  symbol,
  onBack,
  onBuy,
  onSell,
  testID,
}: StockDetailScreenProps) {
  const { tokens } = useTheme();
  const quote = usePrice(symbol);
  const isPaused = usePaused();
  const inWatchlist = useIsInWatchlist(symbol);

  const metrics = quoteDayMetrics(quote);
  const isPriced = metrics.isPriced && metrics.ltp !== null;
  const isTradingDisabled = !isPriced || isPaused;

  const handleToggleWatchlist = useCallback(async () => {
    if (inWatchlist) {
      await watchlistStore.remove(symbol);
    } else {
      await watchlistStore.add(symbol);
    }
  }, [inWatchlist, symbol]);

  const handleBuy = useCallback(() => {
    if (!isTradingDisabled) {
      onBuy?.(symbol);
    }
  }, [isTradingDisabled, onBuy, symbol]);

  const handleSell = useCallback(() => {
    if (!isTradingDisabled) {
      onSell?.(symbol);
    }
  }, [isTradingDisabled, onSell, symbol]);

  const tradingDisabledReason = !isPriced
    ? 'Price unavailable'
    : isPaused
    ? 'Prices paused'
    : null;

  return (
    <SafeAreaView
      testID={testID ?? `stock.detail.${symbol}`}
      style={[styles.safeArea, { backgroundColor: tokens.background }]}
    >
      <PausedBanner />

      {/* Navigation Header */}
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <Pressable
          testID="stock.detail.back"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backButton}
        >
          <Text style={[styles.backText, { color: tokens.primary }]}>‹ Back</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerSymbol, { color: tokens.textPrimary }]}>
            {symbol}
          </Text>
          <Text style={[styles.headerSub, { color: tokens.textMuted }]}>
            NSE Equity
          </Text>
        </View>

        <Pressable
          testID="stock.detail.watchlist.star"
          accessibilityRole="button"
          accessibilityLabel={inWatchlist ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
          onPress={handleToggleWatchlist}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.starButton}
        >
          <Text
            style={[
              styles.starText,
              { color: inWatchlist ? tokens.warning : tokens.textMuted },
            ]}
          >
            {inWatchlist ? '★' : '☆'}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Price Block */}
        <View style={styles.priceBlock}>
          <PriceText
            paise={metrics.ltp}
            testID="stock.detail.ltp"
            style={styles.priceText}
          />
          <View style={styles.dayChangeRow}>
            <PnLText
              pnlPaise={metrics.dayChangePaise}
              pnlPct={metrics.dayChangePct}
              testID="stock.detail.dayChange"
              style={styles.pnlText}
            />
          </View>
        </View>

        {/* Live SVG Line Chart */}
        <LiveLineChart symbol={symbol} />

        {/* Unavailable Notice */}
        {!isPriced ? (
          <View
            testID="stock.detail.unavailable.banner"
            style={[styles.noticeBanner, { backgroundColor: tokens.surfaceContainer }]}
          >
            <Text style={[styles.noticeTitle, { color: tokens.textPrimary }]}>
              Price Unavailable
            </Text>
            <Text style={[styles.noticeText, { color: tokens.textMuted }]}>
              This scrip does not currently have live trade data from the feed. Trading is disabled.
            </Text>
          </View>
        ) : null}

        {/* Position Section (Rendered only when held) */}
        <PositionCard symbol={symbol} />

        {/* Day Range Bar */}
        <DayRangeBar
          low={quote?.low ?? null}
          high={quote?.high ?? null}
          ltp={quote?.ltp ?? null}
        />

        {/* Live Market Statistics */}
        <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
          Market Statistics
        </Text>
        <StockStatsGrid
          open={quote?.open ?? null}
          high={quote?.high ?? null}
          low={quote?.low ?? null}
          prevClose={quote?.prevClose ?? null}
          volume={quote?.volume ?? null}
        />
      </ScrollView>

      {/* Sticky Bottom Action Buttons */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: tokens.surface,
            borderTopColor: tokens.border,
          },
        ]}
      >
        {tradingDisabledReason ? (
          <Text
            testID="stock.detail.disabled.reason"
            style={[styles.disabledReasonText, { color: tokens.textMuted }]}
          >
            {`Orders disabled (${tradingDisabledReason})`}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            testID="stock.detail.buy.button"
            accessibilityRole="button"
            accessibilityLabel="Buy stock"
            disabled={isTradingDisabled}
            onPress={handleBuy}
            style={[
              styles.actionButton,
              {
                backgroundColor: isTradingDisabled ? tokens.surfaceContainer : tokens.gain,
              },
            ]}
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: isTradingDisabled ? tokens.textMuted : '#ffffff' },
              ]}
            >
              Buy
            </Text>
          </Pressable>

          <Pressable
            testID="stock.detail.sell.button"
            accessibilityRole="button"
            accessibilityLabel="Sell stock"
            disabled={isTradingDisabled}
            onPress={handleSell}
            style={[
              styles.actionButton,
              {
                backgroundColor: isTradingDisabled ? tokens.surfaceContainer : tokens.loss,
              },
            ]}
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: isTradingDisabled ? tokens.textMuted : '#ffffff' },
              ]}
            >
              Sell
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerSymbol: {
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  headerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  starButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  starText: {
    fontSize: 22,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  priceBlock: {
    marginVertical: 12,
  },
  priceText: {
    fontSize: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  dayChangeRow: {
    marginTop: 6,
  },
  pnlText: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  noticeBanner: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  disabledReasonText: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
