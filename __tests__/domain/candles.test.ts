import {
  generateAuthenticCandles,
  applyZoomToCandles,
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

  test('creates authentic Daily Candlestick using genuine exchange OHLC metrics', () => {
    const candles = generateAuthenticCandles(mockQuote, [249521]);
    expect(candles.length).toBeGreaterThanOrEqual(1);

    const todayCandle = candles[candles.length - 1]!;
    expect(todayCandle.open).toBe(245000);
    expect(todayCandle.high).toBe(251000);
    expect(todayCandle.low).toBe(244000);
    expect(todayCandle.close).toBe(249521);
    expect(todayCandle.label).toBe('Today');
  });

  test('returns empty array when quote is null or unpriced', () => {
    expect(generateAuthenticCandles(null, [])).toEqual([]);
    expect(generateAuthenticCandles({ ...mockQuote, ltp: null }, [])).toEqual([]);
  });

  test('chunks real accumulated session ticks into authentic interval candles without random data', () => {
    const realTicks = [245000, 246000, 248000, 250000, 249000, 249521];
    const candles = generateAuthenticCandles(mockQuote, realTicks);

    expect(candles.length).toBeGreaterThanOrEqual(2);
    expect(candles[0]?.open).toBe(245000);
    expect(candles[candles.length - 1]?.close).toBe(249521);
  });

  test('applyZoomToCandles slices candles when zoomed in', () => {
    const realTicks = [245000, 246000, 247000, 248000, 249000, 250000, 250500, 249521];
    const candles = generateAuthenticCandles(mockQuote, realTicks);
    const zoomedIn = applyZoomToCandles(candles, 2.0);

    expect(zoomedIn.length).toBeLessThanOrEqual(candles.length);
    expect(zoomedIn.length).toBeGreaterThanOrEqual(2);
    expect(zoomedIn[zoomedIn.length - 1]?.close).toBe(249521);
  });
});
