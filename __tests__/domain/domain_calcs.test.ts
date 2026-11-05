import {
  type Quote,
  type Holding,
  type Order,
  rowMetrics,
  summarize,
  applyOrder,
  getSortedHoldingSymbols,
  quoteDayMetrics,
  dayRangePosition,
  priceFlashDirection,
  OrderValidationError,
  toPaise,
} from '@/domain';

describe('Domain: Pure Calculations (src/domain/calcs.ts)', () => {
  const sampleQuotePriced: Quote = {
    ltp: toPaise(2500.0), // ₹2,500.00 = 250000 paise
    open: toPaise(2480.0),
    high: toPaise(2520.0),
    low: toPaise(2470.0),
    prevClose: toPaise(2450.0), // ₹2,450.00 = 245000 paise
    volume: 1500000,
  };

  const sampleHolding: Holding = {
    symbol: 'RELIANCE',
    qty: 10,
    avgPaise: toPaise(2400.0), // ₹2,400.00 = 240000 paise
  };

  describe('rowMetrics', () => {
    it('computes exact row metrics for a priced holding', () => {
      const metrics = rowMetrics(sampleHolding, sampleQuotePriced);

      expect(metrics.symbol).toBe('RELIANCE');
      expect(metrics.qty).toBe(10);
      expect(metrics.avgPaise).toBe(240000);

      // Invested: 10 * ₹2,400.00 = ₹24,000.00 (2400000 paise)
      expect(metrics.investedPaise).toBe(2400000);

      // Value: 10 * ₹2,500.00 = ₹25,000.00 (2500000 paise)
      expect(metrics.valuePaise).toBe(2500000);

      // P&L: ₹25,000 - ₹24,000 = ₹1,000.00 (100000 paise)
      expect(metrics.pnlPaise).toBe(100000);

      // P&L %: (1,000 / 24,000) * 100 = 4.1666...% -> rounds to 4.17%
      expect(metrics.pnlPct).toBe(4.17);

      // Today's P&L: 10 * (2500 - 2450) = 10 * ₹50 = ₹500.00 (50000 paise)
      expect(metrics.dayPnlPaise).toBe(50000);

      expect(metrics.isPriced).toBe(true);
    });

    it('returns null fields for unpriced holding (quote is null, e.g. OLDCO)', () => {
      const oldcoHolding: Holding = {
        symbol: 'OLDCO',
        qty: 100,
        avgPaise: toPaise(123.75), // 12375 paise
      };

      const metrics = rowMetrics(oldcoHolding, null);

      expect(metrics.symbol).toBe('OLDCO');
      expect(metrics.qty).toBe(100);
      expect(metrics.avgPaise).toBe(12375);
      // Invested is known even if unpriced: 100 * 12375 = 1237500 paise (₹12,375.00)
      expect(metrics.investedPaise).toBe(1237500);

      // All price-dependent metrics MUST be null
      expect(metrics.valuePaise).toBeNull();
      expect(metrics.pnlPaise).toBeNull();
      expect(metrics.pnlPct).toBeNull();
      expect(metrics.dayPnlPaise).toBeNull();
      expect(metrics.isPriced).toBe(false);
    });

    it('returns null fields when quote exists but ltp is null', () => {
      const unquotedQuote: Quote = {
        ltp: null,
        open: toPaise(100),
        high: toPaise(100),
        low: toPaise(100),
        prevClose: toPaise(100),
        volume: 0,
      };

      const metrics = rowMetrics(sampleHolding, unquotedQuote);
      expect(metrics.valuePaise).toBeNull();
      expect(metrics.pnlPaise).toBeNull();
      expect(metrics.isPriced).toBe(false);
    });
  });

  describe('summarize (Reconciliation Rule)', () => {
    it('reconciles totals exactly with the sum of already-rounded rows', () => {
      const row1 = rowMetrics(
        { symbol: 'TCS', qty: 5, avgPaise: toPaise(3500.0) },
        { ltp: toPaise(3600.0), open: toPaise(3550), high: toPaise(3620), low: toPaise(3540), prevClose: toPaise(3580), volume: 500000 }
      );
      const row2 = rowMetrics(
        { symbol: 'INFY', qty: 20, avgPaise: toPaise(1500.0) },
        { ltp: toPaise(1450.0), open: toPaise(1480), high: toPaise(1490), low: toPaise(1440), prevClose: toPaise(1480), volume: 1000000 }
      );

      const summary = summarize([row1, row2]);

      expect(summary.pricedCount).toBe(2);
      expect(summary.unpricedCount).toBe(0);
      expect(summary.unpricedInvestedPaise).toBe(0);
      expect(summary.totals).not.toBeNull();

      if (summary.totals) {
        // Reconciliation: sum of displayed rows == totals
        expect(summary.totals.currentValuePaise).toBe(row1.valuePaise! + row2.valuePaise!);
        expect(summary.totals.totalPnlPaise).toBe(row1.pnlPaise! + row2.pnlPaise!);
        expect(summary.totals.todayPnlPaise).toBe(row1.dayPnlPaise! + row2.dayPnlPaise!);
        expect(summary.totals.totalInvestedPaise).toBe(row1.investedPaise + row2.investedPaise);
      }
    });

    it('correctly excludes unpriced rows (e.g. OLDCO) from totals, value, and P&L%', () => {
      const pricedRow = rowMetrics(
        { symbol: 'RELIANCE', qty: 10, avgPaise: toPaise(2400.0) },
        sampleQuotePriced
      );
      const unpricedRow = rowMetrics(
        { symbol: 'OLDCO', qty: 100, avgPaise: toPaise(123.75) },
        null
      );

      const summary = summarize([pricedRow, unpricedRow]);

      expect(summary.pricedCount).toBe(1);
      expect(summary.unpricedCount).toBe(1);
      // Unpriced invested: 100 * 12375 = 1237500 (₹12,375.00)
      expect(summary.unpricedInvestedPaise).toBe(1237500);
      expect(summary.totals).not.toBeNull();

      if (summary.totals) {
        // Current value only includes RELIANCE, OLDCO is NOT counted as 0
        expect(summary.totals.currentValuePaise).toBe(pricedRow.valuePaise);
        expect(summary.totals.totalPnlPaise).toBe(pricedRow.pnlPaise);
        expect(summary.totals.todayPnlPaise).toBe(pricedRow.dayPnlPaise);
        // Invested used for totals only includes priced holdings
        expect(summary.totals.totalInvestedPaise).toBe(pricedRow.investedPaise);
        expect(summary.totals.totalPnlPct).toBe(pricedRow.pnlPct);
      }
    });

    it('returns totals: null when all holdings are unpriced', () => {
      const unpricedRow1 = rowMetrics({ symbol: 'OLDCO', qty: 10, avgPaise: toPaise(100) }, null);
      const unpricedRow2 = rowMetrics({ symbol: 'NEWCO', qty: 5, avgPaise: toPaise(200) }, null);

      const summary = summarize([unpricedRow1, unpricedRow2]);

      expect(summary.pricedCount).toBe(0);
      expect(summary.unpricedCount).toBe(2);
      expect(summary.unpricedInvestedPaise).toBe(unpricedRow1.investedPaise + unpricedRow2.investedPaise);
      expect(summary.totals).toBeNull();
    });

    it('handles empty rows list cleanly', () => {
      const summary = summarize([]);
      expect(summary.pricedCount).toBe(0);
      expect(summary.unpricedCount).toBe(0);
      expect(summary.unpricedInvestedPaise).toBe(0);
      expect(summary.totals).toBeNull();
    });
  });

  describe('applyOrder', () => {
    const initialHoldings: Holding[] = [
      { symbol: 'RELIANCE', qty: 10, avgPaise: toPaise(2400.0) }, // 240000 paise
      { symbol: 'TCS', qty: 5, avgPaise: toPaise(3500.0) },
    ];

    it('applies a BUY to an existing holding, re-weighting average price correctly', () => {
      // Hold 10 @ 2400. Buy 10 @ 2600.
      // New average = (10*240000 + 10*260000) / 20 = 5000000 / 20 = 250000 (₹2,500.00)
      const order: Order = {
        side: 'BUY',
        symbol: 'RELIANCE',
        qty: 10,
        fillPaise: toPaise(2600.0),
      };

      const result = applyOrder(initialHoldings, order);
      const updated = result.find((h) => h.symbol === 'RELIANCE');

      expect(updated).toBeDefined();
      expect(updated?.qty).toBe(20);
      expect(updated?.avgPaise).toBe(250000);
      // Other holdings untouched
      expect(result.find((h) => h.symbol === 'TCS')?.qty).toBe(5);
    });

    it('rounds new average price to whole paise on buy', () => {
      // Hold 10 @ 240000 paise. Buy 7 @ 255555 paise.
      // Total cost = 2400000 + 1788885 = 4188885
      // New qty = 17
      // 4188885 / 17 = 246405.0 -> Math.round -> 246405 paise
      const order: Order = {
        side: 'BUY',
        symbol: 'RELIANCE',
        qty: 7,
        fillPaise: 255555,
      };

      const result = applyOrder(initialHoldings, order);
      const updated = result.find((h) => h.symbol === 'RELIANCE');
      expect(updated?.qty).toBe(17);
      expect(updated?.avgPaise).toBe(246405);
    });

    it('adds a new holding on BUY when not previously held', () => {
      const order: Order = {
        side: 'BUY',
        symbol: 'INFY',
        qty: 15,
        fillPaise: toPaise(1500.0),
      };

      const result = applyOrder(initialHoldings, order);
      expect(result.length).toBe(3);
      const infy = result.find((h) => h.symbol === 'INFY');
      expect(infy).toEqual({
        symbol: 'INFY',
        qty: 15,
        avgPaise: toPaise(1500.0),
      });
    });

    it('applies a partial SELL, leaving average price unchanged', () => {
      // Hold 10 @ 2400. Sell 4 @ 2700.
      const order: Order = {
        side: 'SELL',
        symbol: 'RELIANCE',
        qty: 4,
        fillPaise: toPaise(2700.0),
      };

      const result = applyOrder(initialHoldings, order);
      const updated = result.find((h) => h.symbol === 'RELIANCE');

      expect(updated).toBeDefined();
      expect(updated?.qty).toBe(6);
      expect(updated?.avgPaise).toBe(240000); // Average price MUST remain unchanged
    });

    it('verifies that selling shares proportionally decreases both invested value and current value', () => {
      // 10 shares held @ 240000 paise (invested: 24,00,000 paise)
      // Current market quote is 250000 paise (value: 25,00,000 paise)
      const quote: Quote = sampleQuotePriced; // ltp = 250000 paise
      const initialHolding: Holding = { symbol: 'RELIANCE', qty: 10, avgPaise: 240000 };

      const beforeMetrics = rowMetrics(initialHolding, quote);
      expect(beforeMetrics.investedPaise).toBe(2400000);
      expect(beforeMetrics.valuePaise).toBe(2500000);

      // Sell 4 shares
      const sellOrder: Order = {
        side: 'SELL',
        symbol: 'RELIANCE',
        qty: 4,
        fillPaise: quote.ltp!,
      };
      const updatedHoldings = applyOrder([initialHolding], sellOrder);
      const afterHolding = updatedHoldings[0]!;

      expect(afterHolding.qty).toBe(6);
      expect(afterHolding.avgPaise).toBe(240000);

      const afterMetrics = rowMetrics(afterHolding, quote);
      // Invested value must drop by exactly 4 * 240000 = 960000 paise
      expect(afterMetrics.investedPaise).toBe(6 * 240000); // 1440000
      expect(beforeMetrics.investedPaise - afterMetrics.investedPaise).toBe(4 * 240000);

      // Current value MUST drop by exactly 4 * quote.ltp = 1000000 paise
      expect(afterMetrics.valuePaise).toBe(6 * 250000); // 1500000
      expect(beforeMetrics.valuePaise! - afterMetrics.valuePaise!).toBe(4 * 250000);

      // Summaries before and after must also reflect exact reduction
      const beforeSummary = summarize([beforeMetrics]);
      const afterSummary = summarize([afterMetrics]);
      expect(beforeSummary.totals?.currentValuePaise).toBe(2500000);
      expect(afterSummary.totals?.currentValuePaise).toBe(1500000);
      expect(beforeSummary.totals?.totalInvestedPaise).toBe(2400000);
      expect(afterSummary.totals?.totalInvestedPaise).toBe(1440000);
    });

    it('removes the holding completely when selling all shares', () => {
      const order: Order = {
        side: 'SELL',
        symbol: 'RELIANCE',
        qty: 10,
        fillPaise: toPaise(2700.0),
      };

      const result = applyOrder(initialHoldings, order);
      expect(result.find((h) => h.symbol === 'RELIANCE')).toBeUndefined();
      expect(result.length).toBe(1);
      expect(result[0]?.symbol).toBe('TCS');
    });

    it('throws OrderValidationError when selling more shares than held', () => {
      const order: Order = {
        side: 'SELL',
        symbol: 'RELIANCE',
        qty: 11,
        fillPaise: toPaise(2700.0),
      };

      expect(() => applyOrder(initialHoldings, order)).toThrow(OrderValidationError);
    });

    it('throws OrderValidationError when selling a stock that is not held', () => {
      const order: Order = {
        side: 'SELL',
        symbol: 'WIPRO',
        qty: 5,
        fillPaise: toPaise(500.0),
      };

      expect(() => applyOrder(initialHoldings, order)).toThrow(OrderValidationError);
    });

    it('throws OrderValidationError for non-positive or fractional quantity', () => {
      expect(() =>
        applyOrder(initialHoldings, {
          side: 'BUY',
          symbol: 'INFY',
          qty: 0,
          fillPaise: 100,
        })
      ).toThrow(OrderValidationError);

      expect(() =>
        applyOrder(initialHoldings, {
          side: 'BUY',
          symbol: 'INFY',
          qty: -5,
          fillPaise: 100,
        })
      ).toThrow(OrderValidationError);

      expect(() =>
        applyOrder(initialHoldings, {
          side: 'BUY',
          symbol: 'INFY',
          qty: 2.5,
          fillPaise: 100,
        })
      ).toThrow(OrderValidationError);

      expect(() =>
        applyOrder(initialHoldings, {
          side: 'BUY',
          symbol: 'INFY',
          qty: 100001,
          fillPaise: 100,
        })
      ).toThrow('Maximum quantity per order is 1,00,000');

      expect(() =>
        applyOrder(initialHoldings, {
          side: 'BUY',
          symbol: 'INFY',
          qty: 1e15,
          fillPaise: 100,
        })
      ).toThrow('Maximum quantity per order is 1,00,000');

      expect(() =>
        applyOrder(initialHoldings, {
          side: 'BUY',
          symbol: 'INFY',
          qty: Number.MAX_SAFE_INTEGER + 1,
          fillPaise: 100,
        })
      ).toThrow('Order quantity must be a positive whole number');
    });

    it('successfully applies a BUY at the maximum 1,00,000 on an existing holding with safe arithmetic', () => {
      const result = applyOrder(initialHoldings, {
        side: 'BUY',
        symbol: 'RELIANCE',
        qty: 100000,
        fillPaise: 250000,
      });

      const updated = result.find((h) => h.symbol === 'RELIANCE');
      expect(updated).toBeDefined();
      expect(updated?.qty).toBe(100010);
      expect(Number.isSafeInteger(updated!.qty * updated!.avgPaise)).toBe(true);
    });
  });

  describe('getSortedHoldingSymbols', () => {
    const holdings: Holding[] = [
      { symbol: 'RELIANCE', qty: 10, avgPaise: 250000 }, // Invested 25,00,000 | Value 26,00,000 | P&L +1,00,000
      { symbol: 'TCS', qty: 5, avgPaise: 350000 },      // Invested 17,50,000 | Value 16,00,000 | P&L -1,50,000
      { symbol: 'INFY', qty: 20, avgPaise: 150000 },    // Invested 30,00,000 | Value 36,00,000 | P&L +6,00,000
      { symbol: 'OLDCO', qty: 100, avgPaise: 12375 },   // Unpriced
    ];

    const quotes = {
      RELIANCE: { ltp: 260000, open: 250000, high: 265000, low: 248000, prevClose: 250000, volume: 1000, seq: 1 },
      TCS: { ltp: 320000, open: 350000, high: 355000, low: 318000, prevClose: 350000, volume: 2000, seq: 1 },
      INFY: { ltp: 180000, open: 150000, high: 185000, low: 149000, prevClose: 150000, volume: 3000, seq: 1 },
      OLDCO: { ltp: null, open: 0, high: 0, low: 0, prevClose: 0, volume: 0, seq: 0 },
    };

    it('filters symbols and company names by case-insensitive substring', () => {
      expect(getSortedHoldingSymbols(holdings, quotes, { searchQuery: 'rel' })).toEqual(['RELIANCE']);
      expect(getSortedHoldingSymbols(holdings, quotes, { searchQuery: 'old' })).toEqual(['OLDCO']);
      expect(getSortedHoldingSymbols(holdings, quotes, { searchQuery: 'consultancy' })).toEqual(['TCS']);
      expect(getSortedHoldingSymbols(holdings, quotes, { searchQuery: 'co' })).toEqual(['OLDCO', 'TCS']);
      expect(getSortedHoldingSymbols(holdings, quotes, { searchQuery: 'tc' })).toEqual(['TCS']);
      expect(getSortedHoldingSymbols(holdings, quotes, { searchQuery: '   ' })).toEqual([
        'INFY',
        'OLDCO',
        'RELIANCE',
        'TCS',
      ]);
    });

    it('filters holdings by category: gainers, losers, unpriced', () => {
      expect(getSortedHoldingSymbols(holdings, quotes, { filter: 'gainers' })).toEqual(['INFY', 'RELIANCE']);
      expect(getSortedHoldingSymbols(holdings, quotes, { filter: 'losers' })).toEqual(['TCS']);
      expect(getSortedHoldingSymbols(holdings, quotes, { filter: 'unpriced' })).toEqual(['OLDCO']);
      expect(getSortedHoldingSymbols(holdings, quotes, { filter: 'all' })).toEqual([
        'INFY',
        'OLDCO',
        'RELIANCE',
        'TCS',
      ]);
    });

    it('sorts by name ascending and descending', () => {
      const asc = getSortedHoldingSymbols(holdings, quotes, { sortBy: 'name', direction: 'asc' });
      expect(asc).toEqual(['INFY', 'OLDCO', 'RELIANCE', 'TCS']);

      const desc = getSortedHoldingSymbols(holdings, quotes, { sortBy: 'name', direction: 'desc' });
      expect(desc).toEqual(['TCS', 'RELIANCE', 'OLDCO', 'INFY']);
    });

    it('sorts by value with unpriced placed last in descending order', () => {
      // Values:
      // INFY: 20 * 180000 = 36,00,000
      // RELIANCE: 10 * 260000 = 26,00,000
      // TCS: 5 * 320000 = 16,00,000
      // OLDCO: unpriced (null)
      const desc = getSortedHoldingSymbols(holdings, quotes, { sortBy: 'value', direction: 'desc' });
      expect(desc).toEqual(['INFY', 'RELIANCE', 'TCS', 'OLDCO']);

      const asc = getSortedHoldingSymbols(holdings, quotes, { sortBy: 'value', direction: 'asc' });
      expect(asc).toEqual(['OLDCO', 'TCS', 'RELIANCE', 'INFY']);
    });

    it('sorts by P&L with unpriced placed last in descending order', () => {
      // P&L:
      // INFY: +6,00,000
      // RELIANCE: +1,00,000
      // TCS: -1,50,000
      // OLDCO: unpriced
      const desc = getSortedHoldingSymbols(holdings, quotes, { sortBy: 'pnl', direction: 'desc' });
      expect(desc).toEqual(['INFY', 'RELIANCE', 'TCS', 'OLDCO']);

      const asc = getSortedHoldingSymbols(holdings, quotes, { sortBy: 'pnl', direction: 'asc' });
      expect(asc).toEqual(['OLDCO', 'TCS', 'RELIANCE', 'INFY']);
    });
  });

  describe('quoteDayMetrics', () => {
    it('calculates day change paise and percentage for a priced quote', () => {
      // ltp: 250000, prevClose: 245000 -> change: +5000 paise (+₹50.00)
      // pct: (5000 / 245000) * 100 = 2.0408... -> 2.04%
      const metrics = quoteDayMetrics(sampleQuotePriced);
      expect(metrics.isPriced).toBe(true);
      expect(metrics.ltp).toBe(250000);
      expect(metrics.dayChangePaise).toBe(5000);
      expect(metrics.dayChangePct).toBe(2.04);
    });

    it('calculates negative day change accurately', () => {
      const downQuote: Quote = {
        ltp: toPaise(2400.0), // 240000
        open: toPaise(2450.0),
        high: toPaise(2460.0),
        low: toPaise(2390.0),
        prevClose: toPaise(2500.0), // 250000
        volume: 800000,
      };
      // change: 240000 - 250000 = -10000 (-₹100.00)
      // pct: (-10000 / 250000) * 100 = -4.00%
      const metrics = quoteDayMetrics(downQuote);
      expect(metrics.isPriced).toBe(true);
      expect(metrics.ltp).toBe(240000);
      expect(metrics.dayChangePaise).toBe(-10000);
      expect(metrics.dayChangePct).toBe(-4.0);
    });

    it('returns nulls when quote is null or ltp is null', () => {
      const nullMetrics = quoteDayMetrics(null);
      expect(nullMetrics.isPriced).toBe(false);
      expect(nullMetrics.ltp).toBeNull();
      expect(nullMetrics.dayChangePaise).toBeNull();
      expect(nullMetrics.dayChangePct).toBeNull();

      const unpricedQuote: Quote = {
        ltp: null,
        open: toPaise(2400.0),
        high: toPaise(2400.0),
        low: toPaise(2400.0),
        prevClose: toPaise(2400.0),
        volume: 0,
      };
      const unpricedMetrics = quoteDayMetrics(unpricedQuote);
      expect(unpricedMetrics.isPriced).toBe(false);
      expect(unpricedMetrics.ltp).toBeNull();
      expect(unpricedMetrics.dayChangePaise).toBeNull();
      expect(unpricedMetrics.dayChangePct).toBeNull();
    });
  });

  describe('dayRangePosition', () => {
    it('calculates the normalized ratio between low and high', () => {
      // low = 2400, high = 2600, ltp = 2500 -> 0.5
      expect(dayRangePosition(240000, 260000, 250000)).toBe(0.5);
      // at low -> 0
      expect(dayRangePosition(240000, 260000, 240000)).toBe(0);
      // at high -> 1
      expect(dayRangePosition(240000, 260000, 260000)).toBe(1);
      // at 25% -> 0.25
      expect(dayRangePosition(240000, 260000, 245000)).toBe(0.25);
    });

    it('clamps values outside [0, 1]', () => {
      expect(dayRangePosition(240000, 260000, 230000)).toBe(0);
      expect(dayRangePosition(240000, 260000, 270000)).toBe(1);
    });

    it('returns null if any value is null or range is invalid', () => {
      expect(dayRangePosition(null, 260000, 250000)).toBeNull();
      expect(dayRangePosition(240000, null, 250000)).toBeNull();
      expect(dayRangePosition(240000, 260000, null)).toBeNull();
      // high <= low
      expect(dayRangePosition(260000, 240000, 250000)).toBeNull();
      expect(dayRangePosition(240000, 240000, 240000)).toBeNull();
    });
  });

  describe('priceFlashDirection', () => {
    it('returns none when either previous or next LTP is null', () => {
      expect(priceFlashDirection(null, 250000)).toBe('none');
      expect(priceFlashDirection(250000, null)).toBe('none');
      expect(priceFlashDirection(null, null)).toBe('none');
    });

    it('returns none when prices are identical', () => {
      expect(priceFlashDirection(250000, 250000)).toBe('none');
    });

    it('returns up when next LTP is greater than previous LTP', () => {
      expect(priceFlashDirection(250000, 250050)).toBe('up');
      expect(priceFlashDirection(100, 200)).toBe('up');
    });

    it('returns down when next LTP is less than previous LTP', () => {
      expect(priceFlashDirection(250050, 250000)).toBe('down');
      expect(priceFlashDirection(200, 100)).toBe('down');
    });
  });
});
