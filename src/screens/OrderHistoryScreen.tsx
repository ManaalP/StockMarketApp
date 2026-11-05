import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { useOrderHistory, orderStore, type ExecutedOrder } from '../stores/orderStore';
import { formatINR, formatOrderTimestamp } from '../domain/format';

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
  const isBuy = order.side === 'BUY';

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
        </View>
        <Text style={[styles.metaText, { color: tokens.textMuted }]}>
          {formatOrderTimestamp(order.timestamp)}
        </Text>
      </View>

      <View style={styles.rightCol}>
        <Text style={[styles.totalText, { color: tokens.textPrimary }]}>
          {formatINR(order.totalPaise)}
        </Text>
        <Text style={[styles.sharesText, { color: tokens.textSecondary }]}>
          {`${order.qty} shares @ ${formatINR(order.pricePaise)}`}
        </Text>
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
        ) : (
          <View style={styles.headerSpacer} />
        )}
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
    height: 72,
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
  metaText: {
    fontSize: 12,
    marginTop: 4,
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
