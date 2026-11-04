/**
 * Domain layer: Money primitives.
 *
 * HARD RULE: Money is represented as integer paise inside the domain layer.
 * Floating-point money arithmetic is strictly forbidden.
 * API floats must be converted to Paise once, at the boundary, using toPaise().
 */

export type Paise = number;

/**
 * Converts a floating-point or integer rupee amount into integer paise.
 * Rounds to the nearest whole paise (e.g., 0.005 -> 1, 1.005 -> 101).
 */
export function toPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

/**
 * Multiplies an integer paise amount by quantity.
 * Rounds the result to guarantee the return value is strictly an integer paise amount.
 */
export function mulQty(paise: Paise, qty: number): Paise {
  return Math.round(paise * qty);
}

/**
 * Sums an arbitrary list of integer paise amounts without floating-point accumulation.
 */
export function addPaise(...amounts: Paise[]): Paise {
  let total = 0;
  for (let i = 0; i < amounts.length; i++) {
    const val = amounts[i];
    if (val !== undefined) {
      total += val;
    }
  }
  return total;
}

/**
 * Subtracts integer paise amount b from a.
 */
export function subPaise(a: Paise, b: Paise): Paise {
  return a - b;
}

/**
 * Computes P&L percentage rounded to 2 decimal places using integer arithmetic where possible.
 *
 * Formula: ((pnlPaise * 10000) / investedPaise) rounded, then divided by 100.
 * Returns null if investedPaise is 0 or negative/unpriced to avoid division by zero.
 */
export function safePercent(pnlPaise: Paise, investedPaise: Paise): number | null {
  if (investedPaise === 0) {
    return null;
  }
  return Math.round((pnlPaise * 10000) / investedPaise) / 100;
}
