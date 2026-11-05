import {
  type Quote,
  type Holding,
  type Order,
  type RowMetrics,
  type PortfolioSummary,
  type SummaryTotals,
} from './types';
import { mulQty, safePercent, type Paise } from './money';
import { COMPANY_NAMES } from '../data/constants';
import { MAX_ORDER_QUANTITY, MAX_SAFE_VALUE_PAISE } from './orders';

/**
 * Typed domain error for invalid order requests.
 */
export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderValidationError';
  }
}

export interface RowPriceInput {
  readonly ltp: Paise | null;
  readonly prevClose?: Paise | null;
}

/**
 * Computes metrics for an individual holding row.
 * Rounding to paise is performed per row so displayed values are exact.
 *
 * Missing price rule: If quote or ltp is null, price-dependent metrics are null.
 * OLDCO and unpriced stocks are never assigned 0 as price.
 */
export function rowMetrics(
  holding: Holding,
  quote: Quote | RowPriceInput | null
): RowMetrics {
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
  const prevClose = quote.prevClose ?? quote.ltp;
  const dayPnlPaise = mulQty(quote.ltp - prevClose, holding.qty);

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
 *   - Validation: Throws OrderValidationError if qty <= 0, fractional, exceeds MAX_ORDER_QUANTITY,
 *     or exceeds Number.MAX_SAFE_INTEGER in value arithmetic.
 */
export function applyOrder(holdings: Holding[], order: Order): Holding[] {
  if (
    typeof order.qty !== 'number' ||
    order.qty <= 0 ||
    !Number.isInteger(order.qty) ||
    !Number.isSafeInteger(order.qty)
  ) {
    throw new OrderValidationError('Order quantity must be a positive whole number');
  }

  if (order.qty > MAX_ORDER_QUANTITY) {
    throw new OrderValidationError('Maximum quantity per order is 1,00,000');
  }

  const orderValue = order.qty * order.fillPaise;
  if (!Number.isSafeInteger(orderValue) || orderValue > MAX_SAFE_VALUE_PAISE) {
    throw new OrderValidationError('Order value exceeds maximum safe arithmetic limit');
  }

  const existingIndex = holdings.findIndex((h) => h.symbol === order.symbol);
  const existing = existingIndex >= 0 ? holdings[existingIndex] : undefined;

  if (order.side === 'BUY') {
    if (!existing) {
      return [...holdings, { symbol: order.symbol, qty: order.qty, avgPaise: order.fillPaise }];
    }

    const newQty = existing.qty + order.qty;
    if (!Number.isSafeInteger(newQty)) {
      throw new OrderValidationError('Holding quantity exceeds maximum safe arithmetic limit');
    }

    const existingCost = existing.qty * existing.avgPaise;
    if (!Number.isSafeInteger(existingCost)) {
      throw new OrderValidationError('Holding value exceeds maximum safe arithmetic limit');
    }

    const totalCost = existingCost + orderValue;
    if (!Number.isSafeInteger(totalCost)) {
      throw new OrderValidationError('Total holding investment exceeds maximum safe arithmetic limit');
    }

    const newAvg = Math.round(totalCost / newQty) as Paise;

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

export type SortField =
  | 'name'
  | 'change'
  | 'ltp'
  | 'pnl'
  | 'pnlPct'
  | 'invested'
  | 'value';
export type SortDirection = 'asc' | 'desc';
export type HoldingCategoryFilter = 'all' | 'gainers' | 'losers' | 'unpriced';

export interface SortFilterOptions {
  readonly searchQuery?: string;
  readonly sortBy?: SortField;
  readonly direction?: SortDirection;
  readonly filter?: HoldingCategoryFilter;
}

/**
 * Pure function to filter and sort holdings, returning an array of symbol strings.
 *
 * Supports Kite-style sorting:
 *   - 'name': Alphabetically (A-Z)
 *   - 'change': % Day Change ((ltp - prevClose) / prevClose)
 *   - 'ltp': Last Traded Price
 *   - 'pnl': Profit & Loss Absolute ₹
 *   - 'pnlPct': Profit & Loss Percent %
 *   - 'invested': Invested capital ₹
 *   - 'value': Holding current value (qty * ltp)
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
  const categoryFilter = options.filter ?? 'all';
  if (categoryFilter !== 'all') {
    filtered = filtered.filter((h) => {
      const q = quotes[h.symbol];
      if (categoryFilter === 'unpriced') {
        return !q || q.ltp === null;
      }
      if (!q || q.ltp === null) return false;
      const pnl = q.ltp - h.avgPaise;
      if (categoryFilter === 'gainers') return pnl > 0;
      if (categoryFilter === 'losers') return pnl < 0;
      return true;
    });
  }

  if (searchQuery && searchQuery.length > 0) {
    filtered = holdings.filter((h) => {
      const symMatch = h.symbol.toUpperCase().includes(searchQuery);
      const companyName = COMPANY_NAMES[h.symbol]?.toUpperCase() ?? '';
      return symMatch || companyName.includes(searchQuery);
    });
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') {
      const comp = a.symbol.localeCompare(b.symbol);
      return direction === 'asc' ? comp : -comp;
    }

    if (sortBy === 'invested') {
      const invA = a.qty * a.avgPaise;
      const invB = b.qty * b.avgPaise;
      const diff = invA - invB;
      return direction === 'asc' ? diff : -diff;
    }

    const quoteA = quotes[a.symbol];
    const quoteB = quotes[b.symbol];
    const ltpA = quoteA?.ltp ?? null;
    const ltpB = quoteB?.ltp ?? null;

    // Unpriced rows are placed last in descending order
    if (ltpA === null && ltpB === null) return 0;
    if (ltpA === null) return direction === 'asc' ? -1 : 1;
    if (ltpB === null) return direction === 'asc' ? 1 : -1;

    if (sortBy === 'ltp') {
      const diff = ltpA - ltpB;
      return direction === 'asc' ? diff : -diff;
    }

    if (sortBy === 'change') {
      const prevA = quoteA?.prevClose ?? ltpA;
      const prevB = quoteB?.prevClose ?? ltpB;
      const chgPctA = prevA > 0 ? ((ltpA - prevA) / prevA) * 100 : 0;
      const chgPctB = prevB > 0 ? ((ltpB - prevB) / prevB) * 100 : 0;
      const diff = chgPctA - chgPctB;
      return direction === 'asc' ? diff : -diff;
    }

    if (sortBy === 'value') {
      const valA = a.qty * ltpA;
      const valB = b.qty * ltpB;
      const diff = valA - valB;
      return direction === 'asc' ? diff : -diff;
    }

    if (sortBy === 'pnlPct') {
      const invA = a.qty * a.avgPaise;
      const invB = b.qty * b.avgPaise;
      const pnlA = a.qty * ltpA - invA;
      const pnlB = b.qty * ltpB - invB;
      const pctA = invA > 0 ? (pnlA / invA) * 100 : 0;
      const pctB = invB > 0 ? (pnlB / invB) * 100 : 0;
      const diff = pctA - pctB;
      return direction === 'asc' ? diff : -diff;
    }

    // Default: 'pnl' (Profit & Loss Absolute)
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
export function quoteDayMetrics(
  quote: Quote | RowPriceInput | null
): QuoteDayMetrics {
  if (!quote || quote.ltp === null) {
    return {
      ltp: null,
      dayChangePaise: null,
      dayChangePct: null,
      isPriced: false,
    };
  }

  const prevClose = quote.prevClose ?? quote.ltp;
  const dayChangePaise = quote.ltp - prevClose;
  const dayChangePct = safePercent(dayChangePaise, prevClose);

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
