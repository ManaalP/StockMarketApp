import {
  checkIndianMarketHours,
  isTradingAllowed,
  getIstDate,
} from '../../src/domain/marketHours';

describe('Indian Stock Market Trading Hours (marketHours)', () => {
  // IST is UTC+5:30.
  // Helper to create UTC Date that maps to a specific IST date & time:
  // year, monthIndex (0-11), day, istHours, istMinutes
  function makeIstDate(year: number, monthIndex: number, day: number, istHours: number, istMinutes: number): Date {
    // IST = UTC + 5h 30m => UTC = IST - 5h 30m
    return new Date(Date.UTC(year, monthIndex, day, istHours - 5, istMinutes - 30));
  }

  test('converts any UTC date accurately to IST (UTC+5:30)', () => {
    // 2026-11-02 04:00 UTC -> 09:30 IST
    const date = new Date(Date.UTC(2026, 10, 2, 4, 0));
    const ist = getIstDate(date);
    expect(ist.getHours()).toBe(9);
    expect(ist.getMinutes()).toBe(30);
  });

  test('allows trading during standard market hours (Monday-Friday 9:15 AM - 3:30 PM IST)', () => {
    // Monday Nov 2, 2026 at 10:30 AM IST
    const mondayOpen = makeIstDate(2026, 10, 2, 10, 30);
    const result = checkIndianMarketHours(mondayOpen);
    expect(result.isOpen).toBe(true);
    expect(isTradingAllowed(mondayOpen)).toBe(true);

    // Wednesday Nov 4, 2026 at 09:15 AM IST (market open minute)
    const marketOpenTick = makeIstDate(2026, 10, 4, 9, 15);
    expect(checkIndianMarketHours(marketOpenTick).isOpen).toBe(true);

    // Friday Nov 6, 2026 at 03:29 PM IST (just before market close)
    const marketJustBeforeClose = makeIstDate(2026, 10, 6, 15, 29);
    expect(checkIndianMarketHours(marketJustBeforeClose).isOpen).toBe(true);
  });

  test('blocks trading before market open (e.g. 9:14 AM IST or earlier)', () => {
    // Monday Nov 2, 2026 at 09:14 AM IST
    const preMarket = makeIstDate(2026, 10, 2, 9, 14);
    const result = checkIndianMarketHours(preMarket);
    expect(result.isOpen).toBe(false);
    expect(result.reason).toContain('9:15 AM - 3:30 PM IST');
    expect(isTradingAllowed(preMarket)).toBe(false);

    // 08:00 AM IST
    const earlyMorning = makeIstDate(2026, 10, 2, 8, 0);
    expect(checkIndianMarketHours(earlyMorning).isOpen).toBe(false);
  });

  test('blocks trading after market close (e.g. 3:30 PM IST or later)', () => {
    // Tuesday Nov 3, 2026 at 03:30 PM IST
    const postMarket = makeIstDate(2026, 10, 3, 15, 30);
    const result = checkIndianMarketHours(postMarket);
    expect(result.isOpen).toBe(false);
    expect(result.reason).toContain('9:15 AM - 3:30 PM IST');
    expect(isTradingAllowed(postMarket)).toBe(false);

    // Night 08:00 PM IST
    const night = makeIstDate(2026, 10, 3, 20, 0);
    expect(checkIndianMarketHours(night).isOpen).toBe(false);
  });

  test('blocks trading on weekends (Saturday and Sunday)', () => {
    // Saturday Nov 7, 2026 at 11:00 AM IST
    const saturday = makeIstDate(2026, 10, 7, 11, 0);
    const satResult = checkIndianMarketHours(saturday);
    expect(satResult.isOpen).toBe(false);
    expect(satResult.reason).toContain('weekends');
    expect(isTradingAllowed(saturday)).toBe(false);

    // Sunday Nov 8, 2026 at 01:00 PM IST
    const sunday = makeIstDate(2026, 10, 8, 13, 0);
    const sunResult = checkIndianMarketHours(sunday);
    expect(sunResult.isOpen).toBe(false);
    expect(sunResult.reason).toContain('weekends');
    expect(isTradingAllowed(sunday)).toBe(false);
  });

  test('allows dev bypass override for testing in non-trading hours', () => {
    // Sunday night
    const sundayNight = makeIstDate(2026, 10, 8, 22, 0);
    expect(isTradingAllowed(sundayNight, false)).toBe(false);
    expect(isTradingAllowed(sundayNight, true)).toBe(true);
  });
});
