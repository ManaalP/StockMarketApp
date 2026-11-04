import { type Paise } from './money';

/**
 * Live market quote data for a symbol.
 * All price points are integer Paise; volume is an integer share count.
 */
export interface Quote {
  ltp: Paise | null;
  open: Paise;
  high: Paise;
  low: Paise;
  prevClose: Paise;
  volume: number;
}

/**
 * Portfolio position for a stock.
 */
export interface Holding {
  symbol: string;
  qty: number;
  avgPaise: Paise;
}

/**
 * Order payload for local order execution.
 */
export interface Order {
  side: 'BUY' | 'SELL';
  symbol: string;
  qty: number;
  fillPaise: Paise;
}

/**
 * Computed metrics for an individual holding row.
 * Rounded to whole paise per row.
 */
export interface RowMetrics {
  symbol: string;
  qty: number;
  avgPaise: Paise;
  investedPaise: Paise;
  valuePaise: Paise | null;
  pnlPaise: Paise | null;
  pnlPct: number | null;
  dayPnlPaise: Paise | null;
  isPriced: boolean;
}

/**
 * Reconciled summary totals across all priced holdings.
 */
export interface SummaryTotals {
  currentValuePaise: Paise;
  totalInvestedPaise: Paise;
  totalPnlPaise: Paise;
  totalPnlPct: number | null;
  todayPnlPaise: Paise;
  todayPnlPct: number | null;
}

/**
 * Derived portfolio summary output.
 */
export interface PortfolioSummary {
  pricedCount: number;
  unpricedCount: number;
  unpricedInvestedPaise: Paise;
  totals: SummaryTotals | null;
}
