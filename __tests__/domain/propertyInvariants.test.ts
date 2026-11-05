import fc from 'fast-check';
import { type Paise } from '../../src/domain/money';
import { formatINR } from '../../src/domain/format';
import {
  rowMetrics,
  summarize,
  applyOrder,
  OrderValidationError,
} from '../../src/domain/calcs';
import { mergeTick, type QuotesState } from '../../src/domain/tickMerge';
import type { Holding, Quote, Order, RowMetrics } from '../../src/domain/types';
import type { Tick } from '../../src/feed/types';

describe('Property-Based Invariants (fast-check)', () => {
  // Invariant 1: Summary totals strictly equal the arithmetic sum of rounded displayed rows
  test('Invariant 1: summary totals equal sum of priced rounded rows across 1,000 permutations', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            symbol: fc.stringMatching(/^[A-Z]{3,6}$/),
            qty: fc.integer({ min: 1, max: 10000 }),
            avgPaise: fc.integer({ min: 100, max: 500000 }) as fc.Arbitrary<Paise>,
          }),
          { minLength: 1, maxLength: 25 }
        ),
        fc.array(fc.integer({ min: 100, max: 1000000 }), { minLength: 25, maxLength: 25 }),
        (rawHoldings, rawLtps) => {
          // De-duplicate symbols
          const seen = new Set<string>();
          const holdings: Holding[] = [];
          for (const h of rawHoldings) {
            if (!seen.has(h.symbol)) {
              seen.add(h.symbol);
              holdings.push(h);
            }
          }

          const quotes: Record<string, Quote> = {};
          holdings.forEach((h, idx) => {
            const rawLtp = rawLtps[idx];
            // 20% chance of unpriced holding
            const ltp = rawLtp && rawLtp % 5 === 0 ? null : (rawLtp as Paise);
            quotes[h.symbol] = {
              ltp,
              open: ltp ?? (0 as Paise),
              prevClose: ltp ?? (0 as Paise),
              high: ltp ?? (0 as Paise),
              low: ltp ?? (0 as Paise),
              volume: 1000,
            };
          });

          const rows: RowMetrics[] = holdings.map((h) => rowMetrics(h, quotes[h.symbol] ?? null));
          const summary = summarize(rows);

          // Calculate sum of rows
          let sumPricedValue = 0;
          let sumPricedInvested = 0;
          let sumPricedPnl = 0;

          for (const r of rows) {
            if (r.isPriced && r.valuePaise !== null && r.pnlPaise !== null) {
              sumPricedValue += r.valuePaise;
              sumPricedInvested += r.investedPaise;
              sumPricedPnl += r.pnlPaise;
            }
          }

          if (summary.totals !== null) {
            expect(summary.totals.currentValuePaise).toBe(sumPricedValue);
            expect(summary.totals.totalInvestedPaise).toBe(sumPricedInvested);
            expect(summary.totals.totalPnlPaise).toBe(sumPricedPnl);
          } else {
            expect(sumPricedValue).toBe(0);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  // Invariant 2: No holding ever has qty <= 0, NaN, or Infinity after any order mutation
  test('Invariant 2: holdings retain positive integers and finite numbers after valid order mutations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }), // initial qty
        fc.integer({ min: 1, max: 100000 }), // initial avgPaise
        fc.constantFrom('BUY', 'SELL'), // order side
        fc.integer({ min: 1, max: 1000 }), // order qty
        fc.integer({ min: 1, max: 100000 }), // executed price
        (initQty, initAvg, side, orderQty, price) => {
          const initialHolding: Holding = {
            symbol: 'TEST',
            qty: initQty,
            avgPaise: initAvg as Paise,
          };

          const order: Order = {
            symbol: 'TEST',
            side: side as 'BUY' | 'SELL',
            qty: orderQty,
            fillPaise: price as Paise,
          };

          try {
            const result = applyOrder([initialHolding], order);
            for (const h of result) {
              expect(h.qty).toBeGreaterThan(0);
              expect(Number.isInteger(h.qty)).toBe(true);
              expect(Number.isFinite(h.avgPaise)).toBe(true);
            }
          } catch (err: unknown) {
            expect(err).toBeInstanceOf(OrderValidationError);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  // Invariant 3: Average price only changes on BUY, and equals weighted formula rounded to paise
  test('Invariant 3: average price is strictly preserved on SELL and mathematically exact on BUY', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 500 }), // initial qty
        fc.integer({ min: 100, max: 50000 }), // initial avg
        fc.integer({ min: 1, max: 4 }), // sell qty (< initial qty)
        fc.integer({ min: 1, max: 100 }), // buy qty
        fc.integer({ min: 100, max: 50000 }), // new price
        (initQty, initAvg, sellQty, buyQty, newPrice) => {
          const holding: Holding = {
            symbol: 'INFY',
            qty: initQty,
            avgPaise: initAvg as Paise,
          };

          // 1. Partial Sell preserves avgPaise exactly
          const sellOrder: Order = {
            symbol: 'INFY',
            side: 'SELL',
            qty: sellQty,
            fillPaise: newPrice as Paise,
          };
          const afterSell = applyOrder([holding], sellOrder);
          expect(afterSell[0]?.avgPaise).toBe(holding.avgPaise);

          // 2. Buy computes weighted formula rounded to paise
          const buyOrder: Order = {
            symbol: 'INFY',
            side: 'BUY',
            qty: buyQty,
            fillPaise: newPrice as Paise,
          };
          const afterBuy = applyOrder([holding], buyOrder);
          const initialInvested = holding.qty * holding.avgPaise;
          const orderTotal = buyOrder.qty * buyOrder.fillPaise;
          const expectedAvg = Math.round((initialInvested + orderTotal) / (holding.qty + buyOrder.qty));
          expect(afterBuy[0]?.avgPaise).toBe(expectedAvg);
        }
      ),
      { numRuns: 1000 }
    );
  });

  // Invariant 4: An unpriced holding never contributes to any summary total
  test('Invariant 4: unpriced holdings never alter summary currentValue or PnL totals', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }), // unpriced qty
        fc.integer({ min: 100, max: 50000 }), // unpriced cost
        (qty, cost) => {
          const unpricedHolding: Holding = {
            symbol: 'OLDCO',
            qty,
            avgPaise: cost as Paise,
          };

          const row = rowMetrics(unpricedHolding, null);
          const summary = summarize([row]);

          expect(summary.totals).toBeNull();
          expect(summary.pricedCount).toBe(0);
          expect(summary.unpricedCount).toBe(1);
          expect(summary.unpricedInvestedPaise).toBe(qty * cost);
        }
      ),
      { numRuns: 1000 }
    );
  });

  // Invariant 5: A tick with seq <= last applied seq never changes state
  test('Invariant 5: ticks with seq <= lastSeq are strict no-ops returning identical reference', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 1000 }), // base seq
        fc.integer({ min: 1, max: 10 }), // seq delta <= 0
        (baseSeq, delta) => {
          const prevState: QuotesState = {
            TCS: {
              ltp: 350000 as Paise,
              open: 350000 as Paise,
              prevClose: 350000 as Paise,
              high: 350000 as Paise,
              low: 350000 as Paise,
              volume: 1000,
              seq: baseSeq,
            },
          };

          const lateTick: Tick = {
            symbol: 'TCS',
            seq: baseSeq - delta, // strictly older seq
            ltp: 360000 as Paise,
          };

          const nextState = mergeTick(prevState, lateTick);
          expect(nextState).toBe(prevState); // Reference equality check
          expect(nextState.TCS?.ltp).toBe(350000);
        }
      ),
      { numRuns: 1000 }
    );
  });

  // Invariant 6: High is always at least ltp and low is at most ltp after merging
  test('Invariant 6: high is always >= ltp and low is always <= ltp after tick merge', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 500000 }), // initial ltp
        fc.integer({ min: 1000, max: 500000 }), // new tick ltp
        (initLtp, tickLtp) => {
          const prevState: QuotesState = {
            SBIN: {
              ltp: initLtp as Paise,
              open: initLtp as Paise,
              prevClose: initLtp as Paise,
              high: initLtp as Paise,
              low: initLtp as Paise,
              volume: 5000,
              seq: 1,
            },
          };

          const tick: Tick = {
            symbol: 'SBIN',
            seq: 2,
            ltp: tickLtp as Paise,
          };

          const nextState = mergeTick(prevState, tick);
          const quote = nextState.SBIN;
          expect(quote).toBeDefined();
          if (!quote || quote.ltp === null) return;

          expect(quote.high).toBeGreaterThanOrEqual(quote.ltp);
          expect(quote.low).toBeLessThanOrEqual(quote.ltp);
        }
      ),
      { numRuns: 1000 }
    );
  });

  // Invariant 7: formatINR output always round-trips cleanly
  test('Invariant 7: formatINR produces deterministic rupee and paisa formatting without Intl', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000000000 }), // 0 to ₹10 Crore
        (paise) => {
          const formatted = formatINR(paise as Paise);
          expect(formatted.startsWith('₹')).toBe(true);

          // Strip symbol and commas
          const cleaned = formatted.replace(/[₹,]/g, '');
          const parsedPaise = Math.round(parseFloat(cleaned) * 100);
          expect(parsedPaise).toBe(paise);
        }
      ),
      { numRuns: 1000 }
    );
  });
});
