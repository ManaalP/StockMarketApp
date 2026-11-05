import React, { useState, useEffect, useCallback, memo } from 'react';
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
import { validateOrder, computeOrderPreview } from '../domain/orders';
import { formatINR } from '../domain/format';
import { PriceText } from './PriceText';

export interface OrderSheetProps {
  readonly visible: boolean;
  readonly symbol: string;
  readonly initialSide?: 'BUY' | 'SELL';
  readonly onClose: () => void;
  readonly onSuccess?: (message: string) => void;
  readonly testID?: string;
}

/**
 * Functional Modal Order Sheet for Buy/Sell trade execution.
 *
 * Requirements:
 * - 100% functional architecture.
 * - Native numeric keyboard for quantity entry.
 * - Live price estimation and dynamic order previews.
 * - Pure validation: whole number > 0, sell <= held, disabled if unpriced/paused.
 * - Atomic execution via portfolioStore.executeOrder with current LTP.
 * - Footnote: "Orders are local only and simulated on device."
 */
export const OrderSheet = memo(function OrderSheet({
  visible,
  symbol,
  initialSide = 'BUY',
  onClose,
  onSuccess,
  testID,
}: OrderSheetProps) {
  const { tokens } = useTheme();
  const quote = usePrice(symbol);
  const holding = useHolding(symbol);
  const isPaused = usePaused();

  const [side, setSide] = useState<'BUY' | 'SELL'>(initialSide);
  const [qtyStr, setQtyStr] = useState('10');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSide(initialSide);
      setSuccessToast(null);
      // If selling and user holds fewer than 10 shares, default to held qty
      if (initialSide === 'SELL' && holding && holding.qty > 0 && holding.qty < 10) {
        setQtyStr(holding.qty.toString());
      } else {
        setQtyStr('10');
      }
    }
  }, [visible, initialSide, holding]);

  const heldQty = holding ? holding.qty : 0;
  const avgPaise = holding ? holding.avgPaise : 0;
  const ltp = quote ? quote.ltp : null;

  const validation = validateOrder(side, qtyStr, heldQty, ltp, isPaused);

  const preview =
    validation.isValid && ltp !== null
      ? computeOrderPreview(side, validation.qty, heldQty, avgPaise, ltp)
      : null;

  const handleConfirm = useCallback(() => {
    if (!validation.isValid || ltp === null) return;

    // Read current LTP at exact moment of confirm
    const currentQuote = priceStore.getQuote(symbol);
    const fillPaise = currentQuote?.ltp ?? ltp;

    portfolioStore.executeOrder({
      symbol,
      side,
      qty: validation.qty,
      fillPaise,
    });

    const actionPast = side === 'BUY' ? 'Bought' : 'Sold';
    const msg = `${actionPast} ${validation.qty} shares of ${symbol} at ${formatINR(fillPaise)}`;
    setSuccessToast(msg);
    onSuccess?.(msg);

    // Auto-close after brief confirmation
    setTimeout(() => {
      onClose();
    }, 1200);
  }, [validation.isValid, validation.qty, ltp, symbol, side, onSuccess, onClose]);

  const activeColor = side === 'BUY' ? tokens.gain : tokens.loss;

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

          {/* Success Toast */}
          {successToast ? (
            <View
              testID="order.sheet.toast.success"
              style={[styles.toastContainer, { backgroundColor: tokens.gainBg }]}
            >
              <Text style={[styles.toastText, { color: tokens.gain }]}>
                {`✓ ${successToast}`}
              </Text>
            </View>
          ) : null}

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
              autoFocus
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
              <Text
                testID="order.sheet.error"
                style={[styles.errorText, { color: tokens.loss }]}
              >
                {validation.error}
              </Text>
            ) : null}
          </View>

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
                style={[styles.previewSubtext, { color: tokens.textSecondary }]}
              >
                {`Impact: ${preview.previewText}`}
              </Text>
            ) : null}
          </View>

          {/* Footnote */}
          <View style={styles.spacer} />
          <Text style={[styles.footnote, { color: tokens.textMuted }]}>
            Orders are local only and simulated on device.
          </Text>

          {/* Confirm Button */}
          <View style={styles.buttonContainer}>
            <Pressable
              testID="order.sheet.confirm.button"
              accessibilityRole="button"
              accessibilityLabel={`Confirm ${side} order`}
              disabled={!validation.isValid || successToast !== null}
              onPress={handleConfirm}
              style={[
                styles.confirmBtn,
                {
                  backgroundColor:
                    !validation.isValid || successToast !== null
                      ? tokens.surfaceContainer
                      : activeColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.confirmBtnText,
                  {
                    color:
                      !validation.isValid || successToast !== null
                        ? tokens.textMuted
                        : '#ffffff',
                  },
                ]}
              >
                {`Confirm ${side}`}
              </Text>
            </Pressable>
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
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  toastContainer: {
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  toggleBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  priceVal: {
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  inputContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  previewCard: {
    marginHorizontal: 16,
    marginTop: 16,
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
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  previewSubtext: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
  footnote: {
    textAlign: 'center',
    fontSize: 11,
    marginBottom: 10,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  confirmBtn: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
