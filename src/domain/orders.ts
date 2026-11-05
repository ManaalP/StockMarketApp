import { mulQty, toPaise, type Paise } from './money';
import { formatINR } from './format';
import type { Holding, Order } from './types';
import { applyOrder } from './calcs';
import { MAX_ORDER_QUANTITY, MAX_SAFE_VALUE_PAISE } from '../data/constants';

export { MAX_ORDER_QUANTITY, MAX_SAFE_VALUE_PAISE };

export interface OrderValidationResult {
  readonly isValid: boolean;
  readonly error: string | null;
  readonly qty: number;
}

/**
 * Pure function to validate order input parameters before order placement.
 *
 * Rules:
 * - Must be an integer > 0 with no leading zeros or non-numeric characters. Error: "Enter a whole number above 0".
 * - Must not exceed MAX_ORDER_QUANTITY (1,00,000). Error: "Maximum quantity per order is 1,00,000".
 * - Must be a safe integer and (qty * ltp) must stay <= Number.MAX_SAFE_INTEGER.
 * - If SELL:
 *   - heldQty <= 0: "You do not hold shares of this stock. You cannot sell."
 *   - qty > heldQty: "You hold {heldQty} shares. You can't sell {qty}."
 * - If ltp is null: "Live price is unavailable. Orders cannot be placed."
 * - If isPaused is true: "Prices are paused. Orders cannot be placed."
 */
export function validateOrder(
  side: 'BUY' | 'SELL',
  qtyStr: string,
  heldQty: number,
  ltp: Paise | null,
  isPaused: boolean,
  isMarketOpen = true
): OrderValidationResult {
  if (!isMarketOpen) {
    return {
      isValid: false,
      error: 'Market is closed. Regular NSE trading hours are Monday to Friday, 9:15 AM - 3:30 PM IST.',
      qty: 0,
    };
  }

  const trimmed = qtyStr.trim();
  // Strictly positive integer with no leading zeroes (e.g. "007" rejected)
  const isStrictPositiveInteger = /^[1-9]\d*$/.test(trimmed);

  if (!isStrictPositiveInteger) {
    return {
      isValid: false,
      error: 'Enter a whole number above 0',
      qty: 0,
    };
  }

  const parsedNumber = Number(trimmed);
  if (!Number.isSafeInteger(parsedNumber) || parsedNumber > MAX_ORDER_QUANTITY) {
    return {
      isValid: false,
      error: 'Maximum quantity per order is 1,00,000',
      qty: 0,
    };
  }

  const qty = parsedNumber;

  if (ltp === null) {
    return {
      isValid: false,
      error: 'Live price is unavailable. Orders cannot be placed.',
      qty,
    };
  }

  if (isPaused) {
    return {
      isValid: false,
      error: 'Prices are paused. Orders cannot be placed.',
      qty,
    };
  }

  // Check order value does not exceed safe integer range
  const orderValue = qty * ltp;
  if (!Number.isSafeInteger(orderValue) || orderValue > MAX_SAFE_VALUE_PAISE) {
    return {
      isValid: false,
      error: 'Order value exceeds maximum allowed transaction limit',
      qty,
    };
  }

  if (side === 'SELL') {
    if (heldQty <= 0) {
      return {
        isValid: false,
        error: 'You do not hold shares of this stock. You cannot sell.',
        qty,
      };
    }
    if (qty > heldQty) {
      return {
        isValid: false,
        error: `You hold ${heldQty} shares. You can't sell ${qty}.`,
        qty,
      };
    }
  }

  return {
    isValid: true,
    error: null,
    qty,
  };
}

export interface OrderPreviewResult {
  readonly estimatedTotalPaise: Paise;
  readonly previewText: string;
}

/**
 * Pure function to compute the estimated order total and post-trade preview text.
 *
 * Rules:
 * - BUY: New average = round((heldQty * avgPaise + qty * fillPaise) / (heldQty + qty)) in whole paise.
 * - SELL: Remaining shares = heldQty - qty. If 0 remaining: "Position will be closed".
 */
export function computeOrderPreview(
  side: 'BUY' | 'SELL',
  qty: number,
  heldQty: number,
  avgPaise: Paise,
  fillPaise: Paise
): OrderPreviewResult {
  const estimatedTotalPaise = mulQty(fillPaise, qty);

  if (side === 'BUY') {
    const newQty = heldQty + qty;
    const totalCost = heldQty * avgPaise + qty * fillPaise;
    const newAvg = Math.round(totalCost / newQty);
    return {
      estimatedTotalPaise,
      previewText: `New average ${formatINR(newAvg)}`,
    };
  }

  // SELL
  if (qty >= heldQty) {
    return {
      estimatedTotalPaise,
      previewText: 'Position will be closed',
    };
  }

  const remaining = heldQty - qty;
  return {
    estimatedTotalPaise,
    previewText: `${heldQty} shares → ${remaining} shares left`,
  };
}

/**
 * Validates a target limit price entered by user in Rupees.
 */
export function validateTargetPrice(
  priceStr: string
): { isValid: boolean; error: string | null; targetPaise: Paise } {
  const trimmed = priceStr.trim().replace(/,/g, '');
  const num = parseFloat(trimmed);

  if (isNaN(num) || num <= 0 || !Number.isFinite(num)) {
    return {
      isValid: false,
      error: 'Enter a valid target price above ₹0.00',
      targetPaise: 0,
    };
  }

  const targetPaise = toPaise(num);
  return {
    isValid: true,
    error: null,
    targetPaise,
  };
}

export const ORDER_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Checks whether an order has expired (pending for >= 10 minutes).
 */
export function isOrderExpired(order: Order, now: number = Date.now()): boolean {
  if (order.status !== 'PENDING') return false;
  return now - (order.createdAt ?? now) >= ORDER_TIMEOUT_MS;
}

/**
 * Determines whether a target price order should execute immediately or remain pending.
 * - SELL: If target price is <= current market LTP, trigger instantly! Otherwise wait for LTP to rise to target.
 * - BUY: If target price is >= current market LTP, trigger instantly! Otherwise wait for LTP to dip to target.
 */
export function shouldExecuteImmediately(
  side: 'BUY' | 'SELL',
  targetPaise: Paise,
  currentLtp: Paise
): boolean {
  if (side === 'SELL') {
    return targetPaise <= currentLtp;
  }
  return targetPaise >= currentLtp;
}

/**
 * Pure evaluation whether a pending limit order has met its market execution criteria.
 * - SELL LIMIT: Executes when live LTP reaches or exceeds the target price (ltp >= targetPaise).
 * - BUY LIMIT: Executes when live LTP reaches or drops to target price (ltp <= targetPaise).
 */
export function checkOrderTrigger(order: Order, currentLtp: Paise | null): boolean {
  if (order.status !== 'PENDING' || currentLtp === null) {
    return false;
  }

  const target = order.targetPaise ?? order.fillPaise;
  if (order.side === 'SELL') {
    return currentLtp >= target;
  }

  return currentLtp <= target;
}

/**
 * Executes a pending order at the triggered market fill price, immutably updating holdings.
 */
export function executePendingOrder(
  holdings: readonly Holding[],
  order: Order,
  fillPaise: Paise,
  nowTimestamp: number = Date.now()
): { holdings: Holding[]; order: Order } {
  const executedOrder: Order = {
    ...order,
    fillPaise,
    status: 'EXECUTED',
    executedAt: nowTimestamp,
  };

  const updatedHoldings = applyOrder([...holdings], executedOrder);
  return {
    holdings: updatedHoldings,
    order: executedOrder,
  };
}
