/**
 * Pure domain module managing Indian Stock Market (NSE/BSE) trading hours.
 *
 * Rules:
 * - Market hours: Monday through Friday, 09:15 AM to 03:30 PM IST (Indian Standard Time).
 * - Closed on weekends (Saturday & Sunday).
 * - IST is strictly UTC+5:30.
 * - System time is checked against IST representation.
 */

export interface MarketHoursResult {
  readonly isOpen: boolean;
  readonly reason?: string;
  readonly istTimeStr?: string;
}

/**
 * Converts any UTC Date into an IST representation (UTC+5:30).
 */
export function getIstDate(date: Date = new Date()): Date {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000; // 5 hours 30 mins
  return new Date(utcMs + istOffsetMs);
}

/**
 * Checks whether the current system time falls within the official Indian market trading session.
 */
export function checkIndianMarketHours(date: Date = new Date()): MarketHoursResult {
  const ist = getIstDate(date);
  const dayOfWeek = ist.getDay(); // 0 = Sunday, 6 = Saturday

  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const currentMinuteOfDay = hours * 60 + minutes;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const istTimeStr = `${pad(hours)}:${pad(minutes)} IST`;

  // Weekend check
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const dayName = dayOfWeek === 0 ? 'Sunday' : 'Saturday';
    return {
      isOpen: false,
      reason: `Market is closed on weekends (${dayName}). Regular NSE trading hours are Monday to Friday, 9:15 AM - 3:30 PM IST.`,
      istTimeStr,
    };
  }

  // Session time window check: 09:15 to 15:30
  const openMinute = 9 * 60 + 15;  // 09:15
  const closeMinute = 15 * 60 + 30; // 15:30

  if (currentMinuteOfDay < openMinute) {
    return {
      isOpen: false,
      reason: 'Market is closed (Pre-market). Regular NSE trading hours are Monday to Friday, 9:15 AM - 3:30 PM IST.',
      istTimeStr,
    };
  }

  if (currentMinuteOfDay >= closeMinute) {
    return {
      isOpen: false,
      reason: 'Market is closed (Post-market). Regular NSE trading hours are Monday to Friday, 9:15 AM - 3:30 PM IST.',
      istTimeStr,
    };
  }

  return {
    isOpen: true,
    istTimeStr,
  };
}

/**
 * Simple helper to check if trading is permitted, supporting optional dev bypass for tests/development.
 */
export function isTradingAllowed(date: Date = new Date(), devBypass = false): boolean {
  if (devBypass) return true;
  return checkIndianMarketHours(date).isOpen;
}
