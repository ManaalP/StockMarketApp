/**
 * The 25 allowed NSE equity symbols for the application and watchlist picker.
 */
export const ALLOWED_SYMBOLS = [
  'RELIANCE',
  'TCS',
  'HDFCBANK',
  'INFY',
  'ICICIBANK',
  'SBIN',
  'BHARTIARTL',
  'ITC',
  'LT',
  'HINDUNILVR',
  'KOTAKBANK',
  'AXISBANK',
  'BAJFINANCE',
  'MARUTI',
  'SUNPHARMA',
  'TITAN',
  'ASIANPAINT',
  'ULTRACEMCO',
  'WIPRO',
  'NTPC',
  'POWERGRID',
  'ONGC',
  'TATASTEEL',
  'ADANIENT',
  'HCLTECH',
] as const;

export type AllowedSymbol = (typeof ALLOWED_SYMBOLS)[number];

/**
 * All symbols requested on initial OHLC load and refresh (25 allowed symbols + OLDCO holding).
 */
export const INITIAL_FETCH_SYMBOLS = [...ALLOWED_SYMBOLS, 'OLDCO'] as const;
