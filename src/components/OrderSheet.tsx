import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { usePrice, usePaused, priceStore } from '../stores/priceStore';
import { useHolding, portfolioStore } from '../stores/portfolioStore';
import { validateOrder, computeOrderPreview, validateTargetPrice } from '../domain/orders';
import { formatINR } from '../domain/format';
import { checkIndianMarketHours } from '../domain/marketHours';
import type { OrderType, Order } from '../domain/types';
import type { Paise } from '../domain/money';
import { PriceText } from './PriceText';

export interface OrderSheetProps {
  readonly visible: boolean;
  readonly symbol: string;
  readonly initialSide?: 'BUY' | 'SELL';
  readonly isMarketOpenOverride?: boolean;
  readonly onClose: () => void;
  readonly onSuccess?: (message: string) => void;
  readonly testID?: string;
}

interface ConfirmationState {
  readonly type: OrderType;
  readonly side: 'BUY' | 'SELL';
  readonly qty: number;
  readonly fillPaise: Paise;
  readonly targetPaise?: Paise;
}

/**
 * Functional Modal Order Sheet for Buy/Sell trade execution.
 *
 * Requirements:
 * - 100% functional architecture.
 * - Options to execute by Quantity (Market) or Target Price (Limit Order).
 * - Target price orders hold in progress until market price criteria is met.
 * - Clear confirmation screens:
 *   - Market orders show Success Confirmation screen.
 *   - Target price limit orders show Order Placed & In Progress screen.
 * - Native numeric keyboard for quantity and price entry.
 * - Live price estimation and dynamic order previews.
 * - Pure validation: whole number > 0, sell <= held, disabled if unpriced/paused/closed.
 * - Footnote: "Orders are local only and simulated on device."
 */
export const OrderSheet = memo(function OrderSheet({
  visible,
  symbol,
  initialSide = 'BUY',
  isMarketOpenOverride,
  onClose,
  onSuccess,
  testID,
}: OrderSheetProps) {
  const { tokens } = useTheme();
  const quote = usePrice(symbol);
  const holding = useHolding(symbol);
  const isPaused = usePaused();

  const marketHours = checkIndianMarketHours();
  const [devBypassMarketHours, setDevBypassMarketHours] = useState(false);
  const isMarketOpen =
    isMarketOpenOverride ??
    (process.env.NODE_ENV === 'test' ? true : devBypassMarketHours ? true : marketHours.isOpen);

  const [side, setSide] = useState<'BUY' | 'SELL'>(initialSide);
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [qtyStr, setQtyStr] = useState('10');
  const [targetPriceStr, setTargetPriceStr] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setSide(initialSide);
      setOrderType('MARKET');
      setConfirmation(null);
      const initialLtp = quote?.ltp ?? null;
      if (initialLtp !== null) {
        setTargetPriceStr((initialLtp / 100).toFixed(2));
      }
      if (initialSide === 'SELL' && holding && holding.qty > 0 && holding.qty < 10) {
        setQtyStr(holding.qty.toString());
      } else {
        setQtyStr('10');
      }
    }
    prevVisibleRef.current = visible;
  }, [visible, initialSide, holding, quote?.ltp]);

  const heldQty = holding ? holding.qty : 0;
  const avgPaise = holding ? holding.avgPaise : 0;
  const ltp = quote ? quote.ltp : null;

  const validation = validateOrder(side, qtyStr, heldQty, ltp, isPaused, isMarketOpen);
  const targetValidation = validateTargetPrice(targetPriceStr);
  const isTargetValid = orderType === 'MARKET' ? true : targetValidation.isValid;

  const effectiveExecutionPrice: Paise =
    orderType === 'LIMIT' && targetValidation.isValid
      ? targetValidation.targetPaise
      : ltp ?? 0;

  const preview =
    validation.isValid && effectiveExecutionPrice > 0
      ? computeOrderPreview(side, validation.qty, heldQty, avgPaise, effectiveExecutionPrice)
      : null;

  const handleConfirm = useCallback(() => {
    if (!validation.isValid || ltp === null) return;
    if (orderType === 'LIMIT' && !targetValidation.isValid) return;

    // Read current LTP at exact moment of confirm
    const currentQuote = priceStore.getQuote(symbol);
    const currentLtp = currentQuote?.ltp ?? ltp;
    const targetPaise = orderType === 'LIMIT' ? targetValidation.targetPaise : undefined;
    const fillPaise = orderType === 'LIMIT' ? targetValidation.targetPaise : currentLtp;

    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newOrder: Order = {
      id: orderId,
      symbol,
      side,
      qty: validation.qty,
      fillPaise,
      targetPaise,
      type: orderType,
      status: orderType === 'LIMIT' ? 'PENDING' : 'EXECUTED',
      createdAt: Date.now(),
    };

    void portfolioStore.executeOrder(newOrder);

    const actionPast = side === 'BUY' ? 'Bought' : 'Sold';
    const msg =
      orderType === 'MARKET'
        ? `${actionPast} ${validation.qty} shares of ${symbol} at ${formatINR(fillPaise)}`
        : `Limit order placed to ${side.toLowerCase()} ${validation.qty} shares of ${symbol} at ${formatINR(fillPaise)}`;

    onSuccess?.(msg);
    setConfirmation({
      type: orderType,
      side,
      qty: validation.qty,
      fillPaise,
      targetPaise,
    });
  }, [
    validation.isValid,
    validation.qty,
    ltp,
    orderType,
    targetValidation.isValid,
    targetValidation.targetPaise,
    symbol,
    side,
    onSuccess,
  ]);

  const activeColor = side === 'BUY' ? tokens.gain : tokens.loss;

  // Confirmation view (Success for Market, In Progress for Limit)
  if (confirmation) {
    const isMarket = confirmation.type === 'MARKET';
    const isSell = confirmation.side === 'SELL';
    const totalOrderPaise = confirmation.qty * confirmation.fillPaise;

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView
          testID={testID ?? 'order.sheet'}
          style={[styles.container, { backgroundColor: tokens.background }]}
        >
          <View
            style={styles.confirmationContent}
            testID={isMarket ? 'order.sheet.screen.success' : 'order.sheet.screen.progress'}
          >
            {/* Status Icon */}
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: isMarket ? tokens.gainBg : tokens.warningBg },
              ]}
            >
              <Text
                style={[
                  styles.iconText,
                  { color: isMarket ? tokens.gain : tokens.warning },
                ]}
              >
                {isMarket ? '✓' : '⏳'}
              </Text>
            </View>

            {/* Title */}
            <Text style={[styles.confirmTitle, { color: tokens.textPrimary }]}>
              {isMarket ? 'Order Executed Successfully!' : 'Order Placed & In Progress'}
            </Text>

            {/* Subtitle */}
            <Text style={[styles.confirmSubtitle, { color: tokens.textSecondary }]}>
              {isMarket
                ? `${isSell ? 'Sold' : 'Bought'} ${confirmation.qty} shares of ${symbol} at ${formatINR(confirmation.fillPaise)}`
                : `Your order to ${confirmation.side.toLowerCase()} ${confirmation.qty} shares of ${symbol} is active.`}
            </Text>

            {/* Details Card */}
            <View
              style={[
                styles.confirmCard,
                { backgroundColor: tokens.surface, borderColor: tokens.border },
              ]}
            >
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: tokens.textMuted }]}>
                  Order Type
                </Text>
                <Text style={[styles.confirmVal, { color: tokens.textPrimary }]}>
                  {isMarket ? 'Market (Immediate)' : 'Target Price (Limit)'}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: tokens.textMuted }]}>
                  Quantity
                </Text>
                <Text style={[styles.confirmVal, { color: tokens.textPrimary }]}>
                  {`${confirmation.qty} shares`}
                </Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: tokens.textMuted }]}>
                  {isMarket ? 'Executed Price' : 'Target Trigger Price'}
                </Text>
                <Text
                  style={[
                    styles.confirmVal,
                    { color: isMarket ? tokens.gain : tokens.warning },
                  ]}
                >
                  {formatINR(confirmation.fillPaise)}
                </Text>
              </View>

              <View style={[styles.confirmRow, styles.noBorder]}>
                <Text style={[styles.confirmLabel, { color: tokens.textMuted }]}>
                  Total Order Value
                </Text>
                <Text
                  style={[
                    styles.confirmVal,
                    { color: tokens.textPrimary, fontWeight: '700' },
                  ]}
                >
                  {formatINR(totalOrderPaise)}
                </Text>
              </View>
            </View>

            {/* Information Notice for Pending Orders */}
            {!isMarket ? (
              <View
                style={[
                  styles.infoBanner,
                  { backgroundColor: tokens.surfaceContainer },
                ]}
              >
                <Text
                  style={[styles.infoBannerText, { color: tokens.textSecondary }]}
                >
                  ℹ️ This order is held in progress and will automatically execute when {symbol} reaches {formatINR(confirmation.fillPaise)}. You can monitor and refresh its live status on the Order History page.
                </Text>
              </View>
            ) : null}

            {/* Done CTA */}
            <Pressable
              testID="order.sheet.done"
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={onClose}
              style={[styles.doneButton, { backgroundColor: tokens.primary }]}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        testID={testID ?? 'order.sheet'}
        style={[styles.container, { backgroundColor: tokens.background }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flexOne}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: tokens.border }]}>
            <View>
              <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>
                {`${side} ${symbol}`}
              </Text>
              <Text style={[styles.headerSub, { color: tokens.textMuted }]}>
                {heldQty > 0 ? `Currently held: ${heldQty} shares` : 'Not currently held'}
              </Text>
            </View>

            <Pressable
              testID="order.sheet.close"
              accessibilityRole="button"
              accessibilityLabel="Close order sheet"
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.closeBtn}
            >
              <Text style={[styles.closeText, { color: tokens.primary }]}>Done</Text>
            </Pressable>
          </View>

          {/* Side Toggle Selector (BUY / SELL) */}
          <View style={styles.toggleRow}>
            <Pressable
              testID="order.sheet.toggle.buy"
              accessibilityRole="button"
              accessibilityLabel="Switch to Buy"
              onPress={() => setSide('BUY')}
              style={[
                styles.toggleBtn,
                side === 'BUY'
                  ? { backgroundColor: tokens.gain }
                  : { backgroundColor: tokens.surfaceContainer },
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  { color: side === 'BUY' ? '#ffffff' : tokens.textPrimary },
                ]}
              >
                BUY
              </Text>
            </Pressable>

            <Pressable
              testID="order.sheet.toggle.sell"
              accessibilityRole="button"
              accessibilityLabel="Switch to Sell"
              onPress={() => setSide('SELL')}
              style={[
                styles.toggleBtn,
                side === 'SELL'
                  ? { backgroundColor: tokens.loss }
                  : { backgroundColor: tokens.surfaceContainer },
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  { color: side === 'SELL' ? '#ffffff' : tokens.textPrimary },
                ]}
              >
                SELL
              </Text>
            </Pressable>
          </View>

          {/* Order Type Toggle (Market Quantity vs Target Price) */}
          <View style={styles.orderTypeContainer}>
            <View
              style={[
                styles.orderTypeToggle,
                { backgroundColor: tokens.surfaceContainer },
              ]}
            >
              <Pressable
                testID="order.sheet.mode.market"
                accessibilityRole="button"
                accessibilityLabel="Execute by Quantity at Market LTP"
                onPress={() => setOrderType('MARKET')}
                style={[
                  styles.orderTypeBtn,
                  orderType === 'MARKET' && { backgroundColor: tokens.surface },
                ]}
              >
                <Text
                  style={[
                    styles.orderTypeBtnText,
                    {
                      color:
                        orderType === 'MARKET'
                          ? tokens.primary
                          : tokens.textSecondary,
                    },
                  ]}
                >
                  Market (Quantity)
                </Text>
              </Pressable>

              <Pressable
                testID="order.sheet.mode.limit"
                accessibilityRole="button"
                accessibilityLabel="Execute by Target Trigger Price"
                onPress={() => setOrderType('LIMIT')}
                style={[
                  styles.orderTypeBtn,
                  orderType === 'LIMIT' && { backgroundColor: tokens.surface },
                ]}
              >
                <Text
                  style={[
                    styles.orderTypeBtnText,
                    {
                      color:
                        orderType === 'LIMIT'
                          ? tokens.primary
                          : tokens.textSecondary,
                    },
                  ]}
                >
                  Target Price (Limit)
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Live Price Tag */}
          <View style={[styles.priceTag, { backgroundColor: tokens.surface }]}>
            <Text style={[styles.priceLabel, { color: tokens.textMuted }]}>
              Live Market Price:
            </Text>
            <PriceText
              paise={ltp}
              testID="order.sheet.livePrice"
              style={styles.priceVal}
            />
          </View>

          {/* Quantity Input Field */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: tokens.textPrimary }]}>
              Quantity (Shares)
            </Text>
            <TextInput
              testID="order.sheet.qty.input"
              value={qtyStr}
              onChangeText={setQtyStr}
              keyboardType="number-pad"
              selectTextOnFocus
              style={[
                styles.input,
                {
                  backgroundColor: tokens.surface,
                  borderColor: validation.error ? tokens.loss : tokens.border,
                  color: tokens.textPrimary,
                },
              ]}
            />

            {/* Quick preset chips */}
            <View style={styles.chipsRow}>
              {[10, 25, 50, 100].map((num) => (
                <Pressable
                  key={num}
                  testID={`order.sheet.chip.${num}`}
                  onPress={() => setQtyStr(num.toString())}
                  style={[styles.chip, { backgroundColor: tokens.surfaceContainer }]}
                >
                  <Text style={[styles.chipText, { color: tokens.textPrimary }]}>
                    {num}
                  </Text>
                </Pressable>
              ))}
              {side === 'SELL' && heldQty > 0 ? (
                <Pressable
                  testID="order.sheet.chip.all"
                  onPress={() => setQtyStr(heldQty.toString())}
                  style={[styles.chip, { backgroundColor: tokens.surfaceContainer }]}
                >
                  <Text style={[styles.chipText, { color: tokens.primary }]}>
                    Sell All
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Error Message */}
            {validation.error ? (
              <View>
                <Text
                  testID="order.sheet.error"
                  style={[styles.errorText, { color: tokens.loss }]}
                >
                  {validation.error}
                </Text>
                {__DEV__ && !isMarketOpen ? (
                  <Pressable
                    testID="order.dev.bypass.button"
                    onPress={() => setDevBypassMarketHours(true)}
                    style={styles.devBypassPill}
                  >
                    <Text style={styles.devBypassText}>
                      ⚡ Dev Override: Open Market
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Target Price Input (Visible in LIMIT mode) */}
          {orderType === 'LIMIT' ? (
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: tokens.textPrimary }]}>
                Target Trigger Price (₹)
              </Text>
              <TextInput
                testID="order.sheet.targetPrice.input"
                value={targetPriceStr}
                onChangeText={setTargetPriceStr}
                keyboardType="decimal-pad"
                selectTextOnFocus
                placeholder="0.00"
                placeholderTextColor={tokens.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: tokens.surface,
                    borderColor:
                      targetValidation.error ? tokens.loss : tokens.border,
                    color: tokens.textPrimary,
                  },
                ]}
              />

              {/* Target Price Guidance Chips */}
              <View style={styles.chipsRow}>
                {[-1, -0.5, 0, 0.5, 1].map((pct) => {
                  const base = ltp ?? 0;
                  const adjPaise =
                    pct === 0 ? base : Math.round(base * (1 + pct / 100));
                  const label = pct === 0 ? 'LTP' : `${pct > 0 ? '+' : ''}${pct}%`;
                  return (
                    <Pressable
                      key={pct}
                      onPress={() => setTargetPriceStr((adjPaise / 100).toFixed(2))}
                      style={[
                        styles.chip,
                        { backgroundColor: tokens.surfaceContainer },
                      ]}
                    >
                      <Text
                        style={[styles.chipText, { color: tokens.textPrimary }]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {targetValidation.error ? (
                <Text
                  testID="order.sheet.targetError"
                  style={[styles.errorText, { color: tokens.loss }]}
                >
                  {targetValidation.error}
                </Text>
              ) : (
                <Text
                  style={[styles.helperText, { color: tokens.textSecondary }]}
                >
                  {side === 'SELL'
                    ? 'Order will execute once market price rises to or exceeds this price.'
                    : 'Order will execute once market price drops to or below this price.'}
                </Text>
              )}
            </View>
          ) : null}

          {/* Order Preview / Estimated Value */}
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: tokens.surface,
                borderColor: tokens.border,
              },
            ]}
          >
            <View style={styles.previewRow}>
              <Text style={[styles.previewLabel, { color: tokens.textMuted }]}>
                Estimated Order Value
              </Text>
              <PriceText
                paise={preview ? preview.estimatedTotalPaise : null}
                testID="order.sheet.estimatedValue"
                style={styles.previewVal}
              />
            </View>

            {preview ? (
              <Text
                testID="order.sheet.previewText"
                style={[styles.previewSub, { color: tokens.textSecondary }]}
              >
                {preview.previewText}
              </Text>
            ) : null}
          </View>

          {/* Action Button: Confirm BUY / SELL */}
          <View style={styles.confirmSection}>
            <Pressable
              testID="order.sheet.confirm.button"
              accessibilityRole="button"
              accessibilityLabel={`Confirm ${side} order`}
              disabled={!validation.isValid || !isTargetValid || ltp === null}
              onPress={handleConfirm}
              style={[
                styles.confirmButton,
                {
                  backgroundColor:
                    !validation.isValid || !isTargetValid || ltp === null
                      ? tokens.surfaceContainer
                      : activeColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.confirmText,
                  {
                    color:
                      !validation.isValid || !isTargetValid || ltp === null
                        ? tokens.textMuted
                        : '#ffffff',
                  },
                ]}
              >
                {orderType === 'LIMIT'
                  ? `Place ${side} Limit Order`
                  : `Confirm ${side} Order`}
              </Text>
            </Pressable>

            {/* Regulatory Disclaimer */}
            <Text style={[styles.disclaimer, { color: tokens.textMuted }]}>
              Orders are local only and simulated on device.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    gap: 12,
  },
  toggleBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  orderTypeContainer: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  orderTypeToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
  },
  orderTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderTypeBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  priceVal: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  inputContainer: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  devBypassPill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#ff9800',
    alignSelf: 'flex-start',
  },
  devBypassText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '700',
  },
  previewCard: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  previewVal: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  previewSub: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  confirmSection: {
    marginTop: 'auto',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  confirmButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  confirmationContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 36,
    fontWeight: '700',
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 20,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  confirmLabel: {
    fontSize: 14,
  },
  confirmVal: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  infoBanner: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  infoBannerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  doneButton: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    marginBottom: 16,
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
