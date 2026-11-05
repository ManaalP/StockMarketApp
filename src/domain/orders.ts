import { mulQty, toPaise, type Paise } from './money';
import { formatINR } from './format';
import type { Holding, Order } from './types';
import { applyOrder } from './calcs';

export interface OrderValidationResult {
  readonly isValid: boolean;
  readonly error: string | null;
  readonly qty: number;
}

/**
 * Pure function to validate order input parameters before order placement.
 *
 * Rules:
 * - Must be an integer > 0. Error: "Enter a whole number above 0".
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
  const isPositiveInteger = /^[1-9]\d*$/.test(trimmed);

  if (!isPositiveInteger) {
    return {
      isValid: false,
      error: 'Enter a whole number above 0',
      qty: 0,
    };
  }

  const qty = parseInt(trimmed, 10);

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
