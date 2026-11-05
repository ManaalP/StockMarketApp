import { portfolioStore } from '../../src/stores/portfolioStore';
import { priceStore } from '../../src/stores/priceStore';
import { summaryStore } from '../../src/stores/summaryStore';
import { rowMetrics, summarize } from '../../src/domain/calcs';

describe('Integration: Order Execution and Portfolio Reconciliation', () => {
  beforeEach(async () => {
    // Replace portfolioStore private holdings via fresh instance or execute orders
    priceStore.seed({
      RELIANCE: {
        ltp: 260000,
        open: 250000,
        prevClose: 250000,
        high: 265000,
        low: 248000,
        volume: 50000,
      },
      TCS: {
        ltp: 320000,
        open: 315000,
        prevClose: 310000,
        high: 325000,
        low: 310000,
        volume: 30000,
      },
      // OLDCO unpriced
    });
  });

  test('executing BUY order updates holding and reconciles Summary exactly to the sum of rows', () => {
    const initialHolding = portfolioStore.getHolding('RELIANCE');
    expect(initialHolding).toBeDefined();
    const prevQty = initialHolding!.qty;
    const prevAvg = initialHolding!.avgPaise;

    // BUY 10 shares of RELIANCE at ₹2,600.00 (260000 paise)
    portfolioStore.executeOrder({
      symbol: 'RELIANCE',
      side: 'BUY',
      qty: 10,
      fillPaise: 260000,
    });

    const updatedHolding = portfolioStore.getHolding('RELIANCE')!;
    expect(updatedHolding.qty).toBe(prevQty + 10);

    // Verify average price rounding: Math.round((prevQty * prevAvg + 10 * 260000) / (prevQty + 10))
    const expectedAvg = Math.round((prevQty * prevAvg + 10 * 260000) / (prevQty + 10));
    expect(updatedHolding.avgPaise).toBe(expectedAvg);

    // Verify Summary Reconciliation:
    // Compute row metrics manually for every holding
    const allHoldings = portfolioStore.getHoldings();
    const rows = allHoldings.map((h) => rowMetrics(h, priceStore.getQuote(h.symbol)));
    const expectedSummary = summarize(rows);

    const actualSummary = summaryStore.getSnapshot();

    expect(actualSummary.pricedCount).toBe(expectedSummary.pricedCount);
    expect(actualSummary.unpricedCount).toBe(expectedSummary.unpricedCount);
    expect(actualSummary.totals?.currentValuePaise).toBe(expectedSummary.totals?.currentValuePaise);
    expect(actualSummary.totals?.totalInvestedPaise).toBe(expectedSummary.totals?.totalInvestedPaise);
    expect(actualSummary.totals?.totalPnlPaise).toBe(expectedSummary.totals?.totalPnlPaise);
  });

  test('executing SELL ALL removes holding completely and updates Summary immediately', () => {
    const initialTcs = portfolioStore.getHolding('TCS');
    expect(initialTcs).toBeDefined();
    const heldQty = initialTcs!.qty;

    // SELL ALL shares of TCS
    portfolioStore.executeOrder({
      symbol: 'TCS',
      side: 'SELL',
      qty: heldQty,
      fillPaise: 320000,
    });

    // TCS is completely removed from holdings
    expect(portfolioStore.getHolding('TCS')).toBeUndefined();
    expect(portfolioStore.getHoldings().some((h) => h.symbol === 'TCS')).toBe(false);

    // Summary recomputed immediately without TCS
    const allHoldings = portfolioStore.getHoldings();
    const rows = allHoldings.map((h) => rowMetrics(h, priceStore.getQuote(h.symbol)));
    const expectedSummary = summarize(rows);

    const actualSummary = summaryStore.getSnapshot();
    expect(actualSummary.totals?.currentValuePaise).toBe(expectedSummary.totals?.currentValuePaise);
    expect(actualSummary.totals?.totalInvestedPaise).toBe(expectedSummary.totals?.totalInvestedPaise);
  });
});
