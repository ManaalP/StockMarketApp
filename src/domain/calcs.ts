import {
  type Quote,
  type Holding,
  type Order,
  type RowMetrics,
  type PortfolioSummary,
  type SummaryTotals,
} from './types';
import { mulQty, safePercent, type Paise } from './money';

/**
 * Typed domain error for invalid order requests.
 */
export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderValidationError';
  }
}

/**
 * Computes metrics for an individual holding row.
 * Rounding to paise is performed per row so displayed values are exact.
 *
 * Missing price rule: If quote or ltp is null, price-dependent metrics are null.
 * OLDCO and unpriced stocks are never assigned 0 as price.
 */
export function rowMetrics(holding: Holding, quote: Quote | null): RowMetrics {
  const investedPaise = mulQty(holding.avgPaise, holding.qty);

  if (!quote || quote.ltp === null) {
    return {
      symbol: holding.symbol,
      qty: holding.qty,
      avgPaise: holding.avgPaise,
      investedPaise,
      valuePaise: null,
      pnlPaise: null,
      pnlPct: null,
      dayPnlPaise: null,
      isPriced: false,
    };
  }

  const valuePaise = mulQty(quote.ltp, holding.qty);
  const pnlPaise = valuePaise - investedPaise;
  const pnlPct = safePercent(pnlPaise, investedPaise);
  // Today's P&L = qty * (ltp - prevClose)
  const dayPnlPaise = mulQty(quote.ltp - quote.prevClose, holding.qty);

  return {
    symbol: holding.symbol,
    qty: holding.qty,
    avgPaise: holding.avgPaise,
    investedPaise,
    valuePaise,
    pnlPaise,
    pnlPct,
    dayPnlPaise,
    isPriced: true,
  };
}

/**
 * Derives portfolio summary by summing the already-rounded rows.
 *
 * RECONCILIATION HARD RULE:
 * Summary totals MUST equal the sum of the displayed rows exactly.
 * Unpriced rows are excluded from current value, P&L, today's P&L,
 * and from the invested figure used for portfolio P&L%.
 */
export function summarize(rows: RowMetrics[]): PortfolioSummary {
  let pricedCount = 0;
  let unpricedCount = 0;
  let unpricedInvestedPaise: Paise = 0;

  let currentValuePaise: Paise = 0;
  let totalInvestedPaise: Paise = 0;
  let totalPnlPaise: Paise = 0;
  let todayPnlPaise: Paise = 0;
  let prevDayValuePaise: Paise = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    if (!row.isPriced || row.valuePaise === null) {
      unpricedCount++;
      unpricedInvestedPaise += row.investedPaise;
    } else {
      pricedCount++;
      currentValuePaise += row.valuePaise;
      totalInvestedPaise += row.investedPaise;
      totalPnlPaise += (row.pnlPaise ?? 0);
      todayPnlPaise += (row.dayPnlPaise ?? 0);
      prevDayValuePaise += (row.valuePaise - (row.dayPnlPaise ?? 0));
    }
  }

  if (pricedCount === 0) {
    return {
      pricedCount,
      unpricedCount,
      unpricedInvestedPaise,
      totals: null,
    };
  }

  const totals: SummaryTotals = {
    currentValuePaise,
    totalInvestedPaise,
    totalPnlPaise,
    totalPnlPct: safePercent(totalPnlPaise, totalInvestedPaise),
    todayPnlPaise,
    todayPnlPct: safePercent(todayPnlPaise, prevDayValuePaise),
  };

  return {
    pricedCount,
    unpricedCount,
    unpricedInvestedPaise,
    totals,
  };
}

/**
 * Applies a buy or sell order to holdings immutably.
 *
 * Rules:
 *   - BUY: New average price = round((oldQty * oldAvg + qty * fill) / newQty) in paise.
 *   - SELL: Leaves average price unchanged.
 *   - SELL ALL: Completely removes the holding.
 *   - Validation: Throws OrderValidationError if qty <= 0, fractional, or sell > held.
 */
export function applyOrder(holdings: Holding[], order: Order): Holding[] {
  if (typeof order.qty !== 'number' || order.qty <= 0 || !Number.isInteger(order.qty)) {
    throw new OrderValidationError('Order quantity must be a positive whole number');
  }

  const existingIndex = holdings.findIndex((h) => h.symbol === order.symbol);
  const existing = existingIndex >= 0 ? holdings[existingIndex] : undefined;

  if (order.side === 'BUY') {
    if (!existing) {
      return [...holdings, { symbol: order.symbol, qty: order.qty, avgPaise: order.fillPaise }];
    }

    const newQty = existing.qty + order.qty;
    const totalCost = existing.qty * existing.avgPaise + order.qty * order.fillPaise;
    const newAvg = Math.round(totalCost / newQty);

    const updated = [...holdings];
    updated[existingIndex] = {
      symbol: existing.symbol,
      qty: newQty,
      avgPaise: newAvg,
    };
    return updated;
  }

  // SELL
  if (!existing || existing.qty < order.qty) {
    const held = existing ? existing.qty : 0;
    throw new OrderValidationError(
      `Cannot sell ${order.qty} shares of ${order.symbol}. Currently held: ${held}`
    );
  }

  if (existing.qty === order.qty) {
    // Selling all shares removes the holding
    return holdings.filter((_, idx) => idx !== existingIndex);
  }

  // Partial sell: quantity drops, average price is unchanged
  const updated = [...holdings];
  updated[existingIndex] = {
    ...existing,
    qty: existing.qty - order.qty,
  };
  return updated;
}

export type SortField = 'name' | 'value' | 'pnl';
export type SortDirection = 'asc' | 'desc';

export interface SortFilterOptions {
  readonly searchQuery?: string;
  readonly sortBy?: SortField;
  readonly direction?: SortDirection;
}

/**
 * Pure function to filter and sort holdings, returning an array of symbol strings.
 *
 * Rules:
 *   - Search query: case-insensitive substring match on symbol name.
 *   - Sort by 'name': alphabetical order.
 *   - Sort by 'value': current total holding value (qty * ltp). Unpriced holdings placed last in descending order.
 *   - Sort by 'pnl': total rupee P&L. Unpriced holdings placed last in descending order.
 */
export function getSortedHoldingSymbols(
  holdings: readonly Holding[],
  quotes: Record<string, (Quote & { seq?: number }) | null | undefined>,
  options: SortFilterOptions = {}
): string[] {
  const searchQuery = options.searchQuery?.trim().toUpperCase();
  const sortBy = options.sortBy ?? 'name';
  const direction = options.direction ?? 'asc';

  let filtered = holdings;
  if (searchQuery && searchQuery.length > 0) {
    filtered = holdings.filter((h) => h.symbol.toUpperCase().includes(searchQuery));
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') {
      const comp = a.symbol.localeCompare(b.symbol);
      return direction === 'asc' ? comp : -comp;
    }

    const quoteA = quotes[a.symbol];
    const quoteB = quotes[b.symbol];

    if (sortBy === 'value') {
      const ltpA = quoteA?.ltp ?? null;
      const ltpB = quoteB?.ltp ?? null;

      // Handle unpriced rows: unpriced rows are placed last in descending order
      if (ltpA === null && ltpB === null) return 0;
      if (ltpA === null) return direction === 'asc' ? -1 : 1;
      if (ltpB === null) return direction === 'asc' ? 1 : -1;

      const valA = a.qty * ltpA;
      const valB = b.qty * ltpB;
      const diff = valA - valB;
      return direction === 'asc' ? diff : -diff;
    }

    // sortBy === 'pnl'
    const ltpA = quoteA?.ltp ?? null;
    const ltpB = quoteB?.ltp ?? null;

    if (ltpA === null && ltpB === null) return 0;
    if (ltpA === null) return direction === 'asc' ? -1 : 1;
    if (ltpB === null) return direction === 'asc' ? 1 : -1;

    const pnlA = a.qty * ltpA - a.qty * a.avgPaise;
    const pnlB = b.qty * ltpB - b.qty * b.avgPaise;
    const diff = pnlA - pnlB;
    return direction === 'asc' ? diff : -diff;
  });

  return sorted.map((h) => h.symbol);
}

export interface QuoteDayMetrics {
  readonly ltp: Paise | null;
  readonly dayChangePaise: Paise | null;
  readonly dayChangePct: number | null;
  readonly isPriced: boolean;
}

/**
 * Computes day change metrics for a quote (used by Watchlist rows and Stock Detail).
 *
 * Rules:
 *   - If quote is null or quote.ltp is null, all metrics are null and isPriced is false.
 *   - Missing prices are never guessed or defaulted to 0.
 *   - Day change = ltp - prevClose.
 *   - Day change % = safePercent(dayChangePaise, prevClose).
 */
export function quoteDayMetrics(quote: Quote | null): QuoteDayMetrics {
  if (!quote || quote.ltp === null) {
    return {
      ltp: null,
      dayChangePaise: null,
      dayChangePct: null,
      isPriced: false,
    };
  }

  const dayChangePaise = quote.ltp - quote.prevClose;
  const dayChangePct = safePercent(dayChangePaise, quote.prevClose);

  return {
    ltp: quote.ltp,
    dayChangePaise,
    dayChangePct,
    isPriced: true,
  };
}

/**
 * Computes the normalized day range position (0 to 1) for the range bar.
 *
 * Rules:
 *   - If low, high, or ltp is null, returns null.
 *   - If high <= low, returns null.
 *   - Clamps the result between 0.0 and 1.0.
 */
export function dayRangePosition(
  low: Paise | null,
  high: Paise | null,
  ltp: Paise | null
): number | null {
  if (low === null || high === null || ltp === null) {
    return null;
  }
  if (high <= low) {
    return null;
  }

  const ratio = (ltp - low) / (high - low);
  if (ratio < 0) return 0;
  if (ratio > 1) return 1;
  return Math.round(ratio * 10000) / 10000;
}

export type PriceFlashDirection = 'up' | 'down' | 'none';

/**
 * Determines whether a price change should trigger an upward, downward, or no flash.
 * Pure function: ignores initial load (prevLtp === null) and unpriced ticks.
 */
export function priceFlashDirection(
  prevLtp: Paise | null,
  nextLtp: Paise | null
): PriceFlashDirection {
  if (prevLtp === null || nextLtp === null) {
    return 'none';
  }
  if (nextLtp > prevLtp) {
    return 'up';
  }
  if (nextLtp < prevLtp) {
    return 'down';
  }
  return 'none';
}
