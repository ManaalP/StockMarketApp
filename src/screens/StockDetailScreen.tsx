import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { useAppSafeArea } from '../theme/useSafeArea';
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
import { OrderSheet } from '../components/OrderSheet';
import { PriceFlash } from '../components/PriceFlash';
import { COMPANY_NAMES } from '../data/constants';

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
  const { bottomPadding } = useAppSafeArea();
  const quote = usePrice(symbol);
  const isPaused = usePaused();
  const inWatchlist = useIsInWatchlist(symbol);

  const metrics = quoteDayMetrics(quote);
  const isPriced = metrics.isPriced && metrics.ltp !== null;
  const isTradingDisabled = !isPriced || isPaused;

  const [orderSheetVisible, setOrderSheetVisible] = useState(false);
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');

  const handleToggleWatchlist = useCallback(async () => {
    if (inWatchlist) {
      await watchlistStore.remove(symbol);
    } else {
      await watchlistStore.add(symbol);
    }
  }, [inWatchlist, symbol]);

  const handleBuy = useCallback(() => {
    if (!isTradingDisabled) {
      setOrderSide('BUY');
      setOrderSheetVisible(true);
      onBuy?.(symbol);
    }
  }, [isTradingDisabled, onBuy, symbol]);

  const handleSell = useCallback(() => {
    if (!isTradingDisabled) {
      setOrderSide('SELL');
      setOrderSheetVisible(true);
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
      edges={['top']}
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
          <Text style={[styles.headerSub, { color: tokens.textMuted }]} numberOfLines={1}>
            {COMPANY_NAMES[symbol] ?? 'NSE Equity'}
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
          <View style={styles.priceAndPillRow}>
            <PriceFlash ltp={metrics.ltp} testID="stock.detail.flash" style={styles.flashCenter}>
              <PriceText
                paise={metrics.ltp}
                testID="stock.detail.ltp"
                style={styles.priceText}
              />
            </PriceFlash>

            <View
              style={[
                styles.dayChangePill,
                {
                  backgroundColor:
                    (metrics.dayChangePaise ?? 0) > 0
                      ? tokens.gainBg
                      : (metrics.dayChangePaise ?? 0) < 0
                      ? tokens.lossBg
                      : tokens.surfaceAlt,
                },
              ]}
            >
              <PnLText
                pnlPaise={metrics.dayChangePaise}
                pnlPct={metrics.dayChangePct}
                testID="stock.detail.dayChange"
                style={styles.pnlText}
              />
            </View>
          </View>
        </View>

        {/* Live SVG Line Chart */}
        <LiveLineChart symbol={symbol} testID="detail.chart" />

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
            paddingBottom: Math.max(12, bottomPadding),
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

      <OrderSheet
        visible={orderSheetVisible}
        symbol={symbol}
        initialSide={orderSide}
        onClose={() => setOrderSheetVisible(false)}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerCenter: {
    alignItems: 'center',
    maxWidth: '65%',
  },
  headerSymbol: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11,
    marginTop: 1,
    fontWeight: '500',
  },
  starButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  starText: {
    fontSize: 22,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  priceBlock: {
    marginVertical: 10,
  },
  priceAndPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  flashCenter: {
    alignSelf: 'center',
  },
  priceText: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
  },
  dayChangePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'center',
  },
  pnlText: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  noticeBanner: {
    padding: 14,
    borderRadius: 12,
    marginVertical: 12,
    borderWidth: 1,
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
    marginTop: 18,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
