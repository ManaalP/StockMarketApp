import { type Paise } from './money';

/**
 * Pure function to format integer strings using the Indian numbering system:
 * The 3 rightmost digits are grouped together, and all preceding digits are grouped in pairs of 2.
 * E.g., "14753650" -> "1,47,53,650"
 *
 * HARD RULE: Do NOT use Intl. Hermes on Android does not guarantee correct en-IN ICU formatting.
 */
function groupIndian(intStr: string): string {
  if (intStr.length <= 3) {
    return intStr;
  }
  const lastThree = intStr.slice(-3);
  const rest = intStr.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
}

/**
 * Formats integer paise into Indian Rupee notation with 2 decimals.
 * Returns "--" if paise is null.
 *
 * Examples:
 *   123456789  -> "₹12,34,567.89"
 *   100000     -> "₹1,000.00"
 *   0          -> "₹0.00"
 *   -123450    -> "-₹1,234.50"
 *   null       -> "--"
 */
export function formatINR(paise: Paise | null): string {
  if (paise === null) {
    return '--';
  }
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const fraction = (absPaise % 100).toString().padStart(2, '0');
  const formatted = groupIndian(rupees.toString()) + '.' + fraction;
  return (isNegative ? '-₹' : '₹') + formatted;
}

/**
 * Formats integer paise with explicit sign ("+₹" or "-₹").
 * Zero renders neutrally as "₹0.00".
 * Returns "--" if paise is null.
 *
 * Examples:
 *   123450  -> "+₹1,234.50"
 *   -123450 -> "-₹1,234.50"
 *   0       -> "₹0.00"
 *   null    -> "--"
 */
export function formatSigned(paise: Paise | null): string {
  if (paise === null) {
    return '--';
  }
  if (paise === 0) {
    return '₹0.00';
  }
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const fraction = (absPaise % 100).toString().padStart(2, '0');
  const formatted = groupIndian(rupees.toString()) + '.' + fraction;
  return (isNegative ? '-₹' : '+₹') + formatted;
}

/**
 * Formats a percentage number to 2 decimal places with a sign.
 * Returns "--" if pct is null.
 *
 * Examples:
 *   1.23  -> "+1.23%"
 *   -0.45 -> "-0.45%"
 *   0     -> "0.00%"
 *   null  -> "--"
 */
export function formatPercent(pct: number | null): string {
  if (pct === null) {
    return '--';
  }
  if (pct === 0 || Object.is(pct, -0)) {
    return '0.00%';
  }
  const sign = pct > 0 ? '+' : '';
  return sign + pct.toFixed(2) + '%';
}

/**
 * Formats an integer volume count using the Indian numbering system without decimals.
 * Returns "--" if volume is null.
 *
 * Examples:
 *   14753650 -> "1,47,53,650"
 *   1000     -> "1,000"
 *   0        -> "0"
 *   null     -> "--"
 */
export function formatVolume(volume: number | null): string {
  if (volume === null) {
    return '--';
  }
  const isNegative = volume < 0;
  const absVol = Math.abs(Math.round(volume));
  const grouped = groupIndian(absVol.toString());
  return (isNegative ? '-' : '') + grouped;
}
