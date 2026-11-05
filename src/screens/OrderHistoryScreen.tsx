import React, { memo, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { useOrderHistory, orderStore, type ExecutedOrder } from '../stores/orderStore';
import { portfolioStore, useHolding } from '../stores/portfolioStore';
import { usePrice } from '../stores/priceStore';
import { formatINR, formatSigned, formatPercent, formatOrderTimestamp } from '../domain/format';

export interface OrderHistoryScreenProps {
  readonly onBack?: () => void;
  readonly testID?: string;
}

const OrderRow = memo(function OrderRow({
  order,
}: {
  readonly order: ExecutedOrder;
}) {
  const { tokens } = useTheme();
  const quote = usePrice(order.symbol);
  const holding = useHolding(order.symbol);
  const isBuy = order.side === 'BUY';
  const isPending = order.status === 'PENDING';
  const isFailed = order.status === 'FAILED';
  const isExecuted = !isPending && !isFailed;

  // Live tick valuation and P&L
  const currentLtp = quote?.ltp ?? null;
  const executionPrice = order.pricePaise;
  const qty = order.qty;

  // For a BUY order:
  // - Buying price = executionPrice
  // - Current P&L = qty * (currentLtp - executionPrice)
  // For a SELL order:
  // - Selling price = executionPrice
  // - Realized/comparison vs current price = qty * (executionPrice - currentLtp)
  // (i.e. if price went down after selling, user protected money / gained in green; if price went up, user sold cheaper / lost in red)
  const pnlPaise =
    currentLtp !== null && isExecuted
      ? isBuy
        ? qty * (currentLtp - executionPrice)
        : qty * (executionPrice - currentLtp)
      : null;

  const costBasis = qty * executionPrice;
  const pnlPct =
    pnlPaise !== null && costBasis > 0
      ? Math.round((pnlPaise * 10000) / costBasis) / 100
      : null;

  const isProfit = pnlPaise !== null && pnlPaise > 0;
  const isLoss = pnlPaise !== null && pnlPaise < 0;

  return (
    <View
      testID={`order.row.${order.id}`}
      style={[
        styles.row,
        {
          backgroundColor: tokens.surface,
          borderBottomColor: tokens.border,
        },
      ]}
    >
      <View style={styles.leftCol}>
        <View style={styles.symbolRow}>
          <Text style={[styles.symbolText, { color: tokens.textPrimary }]}>
            {order.symbol}
          </Text>
          <View
            style={[
              styles.sideBadge,
              { backgroundColor: isBuy ? tokens.gainBg : tokens.lossBg },
            ]}
          >
            <Text
              style={[
                styles.sideText,
                { color: isBuy ? tokens.gain : tokens.loss },
              ]}
            >
              {order.side}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isFailed
                  ? tokens.lossBg
                  : isPending
                  ? tokens.warningBg
                  : tokens.gainBg,
              },
            ]}
          >
            <Text
              testID={`order.status.${order.id}`}
              style={[
                styles.statusText,
                {
                  color: isFailed
                    ? tokens.loss
                    : isPending
                    ? tokens.warning
                    : tokens.gain,
                },
              ]}
            >
              {isFailed ? 'FAILED' : isPending ? 'IN PROGRESS' : 'EXECUTED'}
            </Text>
          </View>
        </View>

        <Text style={[styles.metaText, { color: tokens.textMuted }]}>
          {formatOrderTimestamp(order.timestamp)}
        </Text>

        {/* Live tick tracking & P&L badge */}
        {isExecuted ? (
          <View style={styles.liveTickRow}>
            <Text style={[styles.liveLtpText, { color: tokens.textSecondary }]}>
              {currentLtp !== null ? `LTP: ${formatINR(currentLtp)}` : 'LTP: --'}
            </Text>
            {pnlPaise !== null ? (
              <View
                style={[
                  styles.pnlPill,
                  {
                    backgroundColor: isProfit
                      ? tokens.gainBg
                      : isLoss
                      ? tokens.lossBg
                      : tokens.surfaceAlt,
                  },
                ]}
              >
                <Text
                  testID={`order.pnl.${order.id}`}
                  style={[
                    styles.pnlPillText,
                    {
                      color: isProfit
                        ? tokens.gain
                        : isLoss
                        ? tokens.loss
                        : tokens.textMuted,
                    },
                  ]}
                >
                  {`${formatSigned(pnlPaise)} (${formatPercent(pnlPct)})`}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {isFailed && order.failureReason ? (
          <Text style={[styles.failureText, { color: tokens.loss }]}>
            {order.failureReason}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightCol}>
        <Text style={[styles.totalText, { color: tokens.textPrimary }]}>
          {formatINR(order.totalPaise)}
        </Text>
        <Text style={[styles.sharesText, { color: tokens.textSecondary }]}>
          {isPending
            ? `${order.qty} shares • Target ${formatINR(order.targetPaise ?? order.pricePaise)}`
            : `${order.qty} shares @ ${formatINR(order.pricePaise)}`}
        </Text>
        {holding && holding.qty > 0 ? (
          <Text
            testID={`order.holdingAvg.${order.id}`}
            style={[styles.holdingAvgText, { color: tokens.textMuted }]}
          >
            {`Holding Avg ${formatINR(holding.avgPaise)}`}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

export const OrderHistoryScreen = memo(function OrderHistoryScreen({
  onBack,
  testID,
}: OrderHistoryScreenProps) {
  const { tokens } = useTheme();
  const orders = useOrderHistory();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await portfolioStore.evaluatePendingOrders();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    void orderStore.clearOrders();
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ExecutedOrder>) => <OrderRow order={item} />,
    []
  );

  const keyExtractor = useCallback((item: ExecutedOrder) => item.id, []);

  return (
    <SafeAreaView
      testID={testID ?? 'order.history.screen'}
      style={[styles.container, { backgroundColor: tokens.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        {onBack ? (
          <Pressable
            testID="order.history.back"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.backButton}
          >
            <Text style={[styles.backText, { color: tokens.primary }]}>‹ Back</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}

        <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>
          Order History
        </Text>

        <View style={styles.headerRightActions}>
          <Pressable
            testID="order.history.refresh"
            accessibilityRole="button"
            accessibilityLabel="Refresh order status"
            onPress={handleRefresh}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.refreshButton}
          >
            <Text style={[styles.refreshText, { color: tokens.primary }]}>↻ Refresh</Text>
          </Pressable>

          {orders.length > 0 ? (
            <Pressable
              testID="order.history.clear"
              accessibilityRole="button"
              accessibilityLabel="Clear order history"
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearButton}
            >
              <Text style={[styles.clearText, { color: tokens.loss }]}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* List or Empty State */}
      {orders.length === 0 ? (
        <View testID="order.history.empty" style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>
            No Orders Yet
          </Text>
          <Text style={[styles.emptyMessage, { color: tokens.textMuted }]}>
            Trades executed through the Buy/Sell order sheet are recorded locally and persisted across app launches.
          </Text>
        </View>
      ) : (
        <FlatList
          testID="order.history.list"
          data={orders}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={tokens.primary}
              colors={[tokens.primary]}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 44,
  },
  listContent: {
    flexGrow: 1,
  },
  row: {
    minHeight: 76,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  liveTickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  liveLtpText: {
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  pnlPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pnlPillText: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  leftCol: {
    flex: 1,
    justifyContent: 'center',
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: '700',
  },
  sideBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sideText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  metaText: {
    fontSize: 12,
    marginTop: 4,
  },
  failureText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  totalText: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sharesText: {
    fontSize: 13,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  holdingAvgText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
