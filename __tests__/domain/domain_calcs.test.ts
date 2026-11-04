import {
  type Quote,
  type Holding,
  type Order,
  rowMetrics,
  summarize,
  applyOrder,
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
    });
  });
});
