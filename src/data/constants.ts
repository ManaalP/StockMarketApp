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

export const MAX_ORDER_QUANTITY = 100_000;
export const MAX_SAFE_VALUE_PAISE = Number.MAX_SAFE_INTEGER;

export type AllowedSymbol = (typeof ALLOWED_SYMBOLS)[number];

/**
 * All symbols requested on initial OHLC load and refresh (25 allowed symbols + OLDCO holding).
 */
export const INITIAL_FETCH_SYMBOLS = [...ALLOWED_SYMBOLS, 'OLDCO'] as const;

/**
 * Full registered company names for the 25 NSE symbols and OLDCO holding.
 * Enables search filtering across both ticker symbol and company name.
 */
export const COMPANY_NAMES: Record<string, string> = {
  RELIANCE: 'Reliance Industries Ltd',
  TCS: 'Tata Consultancy Services',
  HDFCBANK: 'HDFC Bank Ltd',
  INFY: 'Infosys Ltd',
  ICICIBANK: 'ICICI Bank Ltd',
  SBIN: 'State Bank of India',
  BHARTIARTL: 'Bharti Airtel Ltd',
  ITC: 'ITC Ltd',
  LT: 'Larsen & Toubro Ltd',
  HINDUNILVR: 'Hindustan Unilever Ltd',
  KOTAKBANK: 'Kotak Mahindra Bank',
  AXISBANK: 'Axis Bank Ltd',
  BAJFINANCE: 'Bajaj Finance Ltd',
  MARUTI: 'Maruti Suzuki India Ltd',
  SUNPHARMA: 'Sun Pharmaceutical Industries',
  TITAN: 'Titan Company Ltd',
  ASIANPAINT: 'Asian Paints Ltd',
  ULTRACEMCO: 'UltraTech Cement Ltd',
  WIPRO: 'Wipro Ltd',
  NTPC: 'NTPC Ltd',
  POWERGRID: 'Power Grid Corporation of India',
  ONGC: 'Oil & Natural Gas Corporation',
  TATASTEEL: 'Tata Steel Ltd',
  ADANIENT: 'Adani Enterprises Ltd',
  HCLTECH: 'HCL Technologies Ltd',
  OLDCO: 'Old Company Ltd',
};
