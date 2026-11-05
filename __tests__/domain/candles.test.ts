import {
  generateCandlesForTimeframe,
  applyZoomToCandles,
  type ChartTimeframe,
} from '../../src/domain/candles';
import type { Quote } from '../../src/domain/types';

describe('candles domain logic', () => {
  const mockQuote: Quote = {
    ltp: 249521,
    open: 245000,
    high: 251000,
    low: 244000,
    prevClose: 241830,
    volume: 120000,
  };

  test('generates valid 1D candles with session tick chunking', () => {
    const fewTicks = [249000, 249521];
    const candlesFew = generateCandlesForTimeframe('1D', mockQuote, fewTicks);
    expect(candlesFew).toHaveLength(5);
    expect(candlesFew[0]?.open).toBe(245000); // Anchored to day open
    expect(candlesFew[candlesFew.length - 1]?.close).toBe(249521); // Anchored to latest tick
    expect(candlesFew[0]?.label).toBe('09:15');

    const manyTicks = [245000, 246000, 247000, 248000, 249000, 250000, 250500, 249521];
    const candlesMany = generateCandlesForTimeframe('1D', mockQuote, manyTicks);
    expect(candlesMany.length).toBeGreaterThanOrEqual(4);
    expect(candlesMany[candlesMany.length - 1]?.close).toBe(249521);
  });

  test('generates 1W, 1M, and 1Y candles anchored to authentic price levels without floats', () => {
    const timeframes: ChartTimeframe[] = ['1W', '1M', '1Y'];
    for (const tf of timeframes) {
      const candles = generateCandlesForTimeframe(tf, mockQuote, [249521]);
      expect(candles.length).toBeGreaterThan(0);
      for (const c of candles) {
        expect(Number.isInteger(c.open)).toBe(true);
        expect(Number.isInteger(c.high)).toBe(true);
        expect(Number.isInteger(c.low)).toBe(true);
        expect(Number.isInteger(c.close)).toBe(true);
        expect(c.label.length).toBeGreaterThan(0);
        expect(c.high).toBeGreaterThanOrEqual(Math.min(c.open, c.close));
        expect(c.low).toBeLessThanOrEqual(Math.max(c.open, c.close));
      }
      // Last candle always ends on the current live price
      expect(candles[candles.length - 1]?.close).toBe(249521);
    }
  });

  test('applyZoomToCandles adjusts visible candle count', () => {
    const baseCandles = generateCandlesForTimeframe('1Y', mockQuote, [249521]);
    expect(baseCandles.length).toBe(6);

    // Zoomed out (<= 1) retains all candles
    const zoomedOut = applyZoomToCandles(baseCandles, 0.8);
    expect(zoomedOut.length).toBe(6);

    // Zoomed in (1.5x) slices subset of candles (at least 3)
    const zoomedIn = applyZoomToCandles(baseCandles, 2.0);
    expect(zoomedIn.length).toBeLessThanOrEqual(baseCandles.length);
    expect(zoomedIn.length).toBeGreaterThanOrEqual(3);
    // Last candle is preserved
    expect(zoomedIn[zoomedIn.length - 1]?.close).toBe(baseCandles[baseCandles.length - 1]?.close);
  });
});
