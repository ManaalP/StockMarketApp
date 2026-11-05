import { mulQty, type Paise } from './money';
import { formatINR } from './format';

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
