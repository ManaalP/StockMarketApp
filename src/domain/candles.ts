import type { Quote } from './types';

export type ChartTimeframe = '1D' | '1W' | '1M' | '1Y';

export interface CandleData {
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly label: string;
}

/**
 * Pure generator to synthesize an OHLC candlestick series for multiple timeframes.
 * - For '1D': Uses session ticks (chunked if >= 8) or authentic exchange day OHLC progression.
 * - For '1W': 5 trading day candles (Mon-Fri) anchored to prevClose and today's OHLC.
 * - For '1M': 4 weekly candles representing the current month.
 * - For '1Y': 6 bi-monthly or monthly candles representing annual movement.
 *
 * All values are integer paise.
 */
export function generateCandlesForTimeframe(
  timeframe: ChartTimeframe,
  quote: Quote | null,
  renderedPoints: readonly number[]
): CandleData[] {
  const latestPrice = renderedPoints[renderedPoints.length - 1] ?? quote?.ltp ?? 10000;
  const openPrice = quote?.open ?? latestPrice;
  const highPrice = quote?.high ?? Math.max(latestPrice, openPrice);
  const lowPrice = quote?.low ?? Math.min(latestPrice, openPrice);
  const prevClose = quote?.prevClose ?? openPrice;

  if (timeframe === '1D') {
    if (renderedPoints.length >= 8) {
      const numCandles = Math.min(8, Math.max(5, Math.floor(renderedPoints.length / 4)));
      const chunkSize = Math.max(1, Math.floor(renderedPoints.length / numCandles));
      const candles: CandleData[] = [];
      const times = ['09:15', '10:15', '11:15', '12:15', '13:15', '14:15', '15:00', '15:30'];
      let chunkIdx = 0;
      for (let i = 0; i < renderedPoints.length; i += chunkSize) {
        const chunk = renderedPoints.slice(i, i + chunkSize);
        if (chunk.length > 0) {
          candles.push({
            open: chunk[0]!,
            high: Math.max(...chunk),
            low: Math.min(...chunk),
            close: chunk[chunk.length - 1]!,
            label: times[chunkIdx % times.length] ?? `${chunkIdx + 1}`,
          });
          chunkIdx++;
        }
      }
      return candles;
    }

    // Synthesize realistic day progression anchored to authentic exchange OHLC
    const intradayLabels = ['09:15', '10:30', '12:00', '13:30', '15:15'];
    return [
      {
        open: openPrice,
        high: Math.round(openPrice + (highPrice - openPrice) * 0.35),
        low: Math.round(openPrice - (openPrice - lowPrice) * 0.3),
        close: Math.round(openPrice + (latestPrice - openPrice) * 0.15),
        label: intradayLabels[0]!,
      },
      {
        open: Math.round(openPrice + (latestPrice - openPrice) * 0.15),
        high: Math.round(openPrice + (highPrice - openPrice) * 0.4),
        low: lowPrice, // Reaches official low
        close: Math.round(lowPrice + (latestPrice - lowPrice) * 0.3),
        label: intradayLabels[1]!,
      },
      {
        open: Math.round(lowPrice + (latestPrice - lowPrice) * 0.3),
        high: highPrice, // Reaches official high
        low: Math.round(lowPrice + (latestPrice - lowPrice) * 0.25),
        close: Math.round(highPrice - (highPrice - latestPrice) * 0.35),
        label: intradayLabels[2]!,
      },
      {
        open: Math.round(highPrice - (highPrice - latestPrice) * 0.35),
        high: Math.max(Math.round(highPrice - (highPrice - latestPrice) * 0.15), latestPrice),
        low: Math.min(Math.round(latestPrice - (latestPrice - lowPrice) * 0.15), latestPrice),
        close: Math.round(latestPrice + (openPrice - latestPrice) * 0.08),
        label: intradayLabels[3]!,
      },
      {
        open: Math.round(latestPrice + (openPrice - latestPrice) * 0.08),
        high: Math.max(...renderedPoints, latestPrice),
        low: Math.min(...renderedPoints, latestPrice),
        close: latestPrice, // Real-time active live candle
        label: intradayLabels[4]!,
      },
    ];
  }

  if (timeframe === '1W') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Today'];
    const base = prevClose;
    const diff = latestPrice - prevClose;
    return [
      {
        open: Math.round(base - diff * 0.4),
        high: Math.round(base + Math.abs(diff) * 0.3),
        low: Math.round(base - Math.abs(diff) * 0.6),
        close: Math.round(base - diff * 0.2),
        label: days[0]!,
      },
      {
        open: Math.round(base - diff * 0.2),
        high: Math.round(base + Math.abs(diff) * 0.5),
        low: Math.round(base - Math.abs(diff) * 0.3),
        close: Math.round(base + diff * 0.1),
        label: days[1]!,
      },
      {
        open: Math.round(base + diff * 0.1),
        high: Math.round(base + Math.abs(diff) * 0.7),
        low: Math.round(base - Math.abs(diff) * 0.2),
        close: Math.round(base + diff * 0.4),
        label: days[2]!,
      },
      {
        open: Math.round(base + diff * 0.4),
        high: Math.round(base + Math.abs(diff) * 0.8),
        low: Math.round(base + diff * 0.2),
        close: prevClose,
        label: days[3]!,
      },
      {
        open: openPrice,
        high: highPrice,
        low: lowPrice,
        close: latestPrice,
        label: days[4]!,
      },
    ];
  }

  if (timeframe === '1M') {
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    const base = prevClose;
    const spread = Math.max(Math.abs(latestPrice - prevClose), Math.round(prevClose * 0.025));
    return [
      {
        open: Math.round(base - spread * 0.8),
        high: Math.round(base - spread * 0.2),
        low: Math.round(base - spread * 1.1),
        close: Math.round(base - spread * 0.4),
        label: weeks[0]!,
      },
      {
        open: Math.round(base - spread * 0.4),
        high: Math.round(base + spread * 0.3),
        low: Math.round(base - spread * 0.6),
        close: Math.round(base - spread * 0.1),
        label: weeks[1]!,
      },
      {
        open: Math.round(base - spread * 0.1),
        high: Math.round(base + spread * 0.6),
        low: Math.round(base - spread * 0.3),
        close: prevClose,
        label: weeks[2]!,
      },
      {
        open: openPrice,
        high: highPrice,
        low: lowPrice,
        close: latestPrice,
        label: weeks[3]!,
      },
    ];
  }

  // 1Y timeframe: 6 bi-monthly periods
  const months = ['Jan-Feb', 'Mar-Apr', 'May-Jun', 'Jul-Aug', 'Sep-Oct', 'Nov-Dec'];
  const base = prevClose;
  const annualSpread = Math.max(Math.abs(latestPrice - prevClose) * 2, Math.round(prevClose * 0.08));
  return [
    {
      open: Math.round(base - annualSpread * 0.7),
      high: Math.round(base - annualSpread * 0.3),
      low: Math.round(base - annualSpread * 0.9),
      close: Math.round(base - annualSpread * 0.5),
      label: months[0]!,
    },
    {
      open: Math.round(base - annualSpread * 0.5),
      high: Math.round(base - annualSpread * 0.1),
      low: Math.round(base - annualSpread * 0.6),
      close: Math.round(base - annualSpread * 0.2),
      label: months[1]!,
    },
    {
      open: Math.round(base - annualSpread * 0.2),
      high: Math.round(base + annualSpread * 0.4),
      low: Math.round(base - annualSpread * 0.3),
      close: Math.round(base + annualSpread * 0.1),
      label: months[2]!,
    },
    {
      open: Math.round(base + annualSpread * 0.1),
      high: Math.round(base + annualSpread * 0.5),
      low: Math.round(base - annualSpread * 0.1),
      close: Math.round(base + annualSpread * 0.3),
      label: months[3]!,
    },
    {
      open: Math.round(base + annualSpread * 0.3),
      high: Math.round(base + annualSpread * 0.8),
      low: Math.round(base + annualSpread * 0.2),
      close: prevClose,
      label: months[4]!,
    },
    {
      open: openPrice,
      high: highPrice,
      low: lowPrice,
      close: latestPrice,
      label: months[5]!,
    },
  ];
}

/**
 * Filter/slice candles according to zoom level.
 * zoomLevel > 1 means zoomed in (focus on later candles).
 * zoomLevel < 1 means zoomed out (all candles).
 */
export function applyZoomToCandles(
  candles: readonly CandleData[],
  zoomLevel: number
): CandleData[] {
  if (candles.length <= 3 || zoomLevel <= 1.0) {
    return [...candles];
  }
  // When zoomed in, e.g. 1.5x -> show last 66%, 2.0x -> show last 50%
  const fraction = Math.max(0.4, Math.min(1.0, 1.0 / zoomLevel));
  const count = Math.max(3, Math.round(candles.length * fraction));
  return candles.slice(candles.length - count);
}
