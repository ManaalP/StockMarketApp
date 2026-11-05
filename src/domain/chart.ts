import type { Paise } from './money';

export interface TickPoint {
  readonly t: number; // epoch ms
  readonly price: Paise;
}

export interface ChartPathResult {
  readonly path: string;
  readonly min: number;
  readonly max: number;
  readonly pointsCount: number;
}

/**
 * Backward-compatible chart path generator for components transitioning to buildLinePath.
 */
export function chartPath(
  points: readonly number[],
  width: number,
  height: number,
  verticalPadding: number = 8
): ChartPathResult {
  if (points.length === 0) {
    return { path: '', min: 0, max: 0, pointsCount: 0 };
  }

  const min = Math.min(...points);
  const max = Math.max(...points);

  if (points.length < 2) {
    return { path: '', min, max, pointsCount: points.length };
  }

  const count = points.length;
  const clampedPadding = Math.min(verticalPadding, height / 4);
  const usableHeight = height - 2 * clampedPadding;

  if (min === max) {
    const midY = height / 2;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const x = (i / (count - 1)) * width;
      const cmd = i === 0 ? 'M' : 'L';
      parts.push(`${cmd} ${x.toFixed(1)},${midY.toFixed(1)}`);
    }
    return { path: parts.join(' '), min, max, pointsCount: count };
  }

  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const val = points[i]!;
    const x = (i / (count - 1)) * width;
    const normalized = (val - min) / (max - min);
    const y = height - clampedPadding - normalized * usableHeight;
    const cmd = i === 0 ? 'M' : 'L';
    parts.push(`${cmd} ${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return { path: parts.join(' '), min, max, pointsCount: count };
}

export interface YDomain {
  readonly min: Paise;
  readonly max: Paise;
}

export interface TimeCandle {
  readonly startT: number;
  readonly open: Paise;
  readonly high: Paise;
  readonly low: Paise;
  readonly close: Paise;
}

export type Direction = 'up' | 'down' | 'flat';

/**
 * Pushes a tick into a ring buffer capped at maxPoints (default 120).
 * Pure function returning a new array without mutating input.
 */
export function pushTick(
  buffer: readonly TickPoint[],
  point: TickPoint,
  cap: number = 120
): TickPoint[] {
  const next = [...buffer, point];
  if (next.length > cap) {
    return next.slice(next.length - cap);
  }
  return next;
}

/**
 * Computes "nice" price gridline values in paise for the Y axis (default 3 ticks).
 */
export function niceTicks(min: Paise, max: Paise, count: number = 3): Paise[] {
  if (min === max) {
    return [min];
  }
  if (count <= 1) {
    return [Math.round((min + max) / 2) as Paise];
  }

  const step = (max - min) / (count - 1);
  const ticks: Paise[] = [];
  for (let i = 0; i < count; i++) {
    ticks.push(Math.round(min + i * step) as Paise);
  }
  return ticks;
}

/**
 * Computes Y domain over points plus reference lines (e.g. open, prevClose)
 * if within +-1.5% of the range, with 6% padding. Never returns a zero-height domain.
 */
export function computeYDomain(
  points: readonly TickPoint[],
  referenceLines: readonly (Paise | null | undefined)[] = []
): YDomain {
  if (points.length === 0) {
    const validRefs = referenceLines.filter((r): r is Paise => r !== null && r !== undefined);
    if (validRefs.length > 0) {
      const minRef = Math.min(...validRefs) as Paise;
      const maxRef = Math.max(...validRefs) as Paise;
      if (minRef === maxRef) {
        const pad = Math.max(100, Math.round(minRef * 0.01)) as Paise;
        return { min: (minRef - pad) as Paise, max: (minRef + pad) as Paise };
      }
      return { min: minRef, max: maxRef };
    }
    return { min: 0 as Paise, max: 100 as Paise };
  }

  let min = points[0]!.price;
  let max = points[0]!.price;

  for (let i = 1; i < points.length; i++) {
    const p = points[i]!.price;
    if (p < min) min = p;
    if (p > max) max = p;
  }

  const range = max - min;
  const tolerance = Math.max(Math.round(range * 0.015), Math.round(max * 0.005));

  for (const ref of referenceLines) {
    if (ref !== null && ref !== undefined) {
      if (ref >= min - tolerance && ref <= max + tolerance) {
        if (ref < min) min = ref;
        if (ref > max) max = ref;
      }
    }
  }

  if (min === max) {
    const pad = Math.max(100, Math.round(min * 0.01)) as Paise;
    return { min: Math.max(0, min - pad) as Paise, max: (min + pad) as Paise };
  }

  const span = max - min;
  const padding = Math.max(1, Math.round(span * 0.06)) as Paise;
  return {
    min: Math.max(0, min - padding) as Paise,
    max: (max + padding) as Paise,
  };
}

/**
 * Decimates points to at most one pair of (min, max) per 2 px column so peaks are strictly preserved.
 */
export function decimatePoints(
  points: readonly TickPoint[],
  w: number
): TickPoint[] {
  if (points.length <= 2 || w <= 0) {
    return [...points];
  }

  const columnWidth = 2; // 2px per bin
  const numBins = Math.max(1, Math.floor(w / columnWidth));

  if (points.length <= numBins) {
    return [...points];
  }

  const startTime = points[0]!.t;
  const endTime = points[points.length - 1]!.t;
  const timeSpan = Math.max(1, endTime - startTime);

  const bins: TickPoint[][] = Array.from({ length: numBins }, () => []);

  for (const pt of points) {
    const fraction = (pt.t - startTime) / timeSpan;
    const binIdx = Math.min(numBins - 1, Math.max(0, Math.floor(fraction * numBins)));
    bins[binIdx]!.push(pt);
  }

  const result: TickPoint[] = [];

  for (let b = 0; b < bins.length; b++) {
    const pts = bins[b]!;
    if (pts.length === 0) continue;
    if (pts.length <= 2) {
      result.push(...pts);
      continue;
    }

    // Find min and max in this bucket
    let minPt = pts[0]!;
    let maxPt = pts[0]!;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i]!.price < minPt.price) minPt = pts[i]!;
      if (pts[i]!.price > maxPt.price) maxPt = pts[i]!;
    }

    // Preserve temporal order between min and max
    if (minPt.t <= maxPt.t) {
      result.push(minPt);
      if (minPt !== maxPt) result.push(maxPt);
    } else {
      result.push(maxPt);
      result.push(minPt);
    }
  }

  // Ensure first and last points are preserved
  if (result[0] !== points[0]) {
    result.unshift(points[0]!);
  }
  if (result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1]!);
  }

  return result;
}

/**
 * Builds SVG line path string for decimated points mapped onto width and height.
 */
export function buildLinePath(
  points: readonly TickPoint[],
  w: number,
  h: number,
  domain: YDomain
): string {
  if (points.length < 2 || w <= 0 || h <= 0) {
    return '';
  }

  const decimated = decimatePoints(points, w);
  const span = Math.max(1, domain.max - domain.min);
  const startTime = decimated[0]!.t;
  const endTime = decimated[decimated.length - 1]!.t;
  const timeSpan = Math.max(1, endTime - startTime);

  const parts: string[] = [];
  for (let i = 0; i < decimated.length; i++) {
    const pt = decimated[i]!;
    const x = timeSpan > 0 ? ((pt.t - startTime) / timeSpan) * w : (i / (decimated.length - 1)) * w;
    const norm = (pt.price - domain.min) / span;
    const y = h - norm * h;
    const cmd = i === 0 ? 'M' : 'L';
    parts.push(`${cmd} ${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return parts.join(' ');
}

/**
 * Builds closed SVG area path string for area fill.
 */
export function buildAreaPath(
  points: readonly TickPoint[],
  w: number,
  h: number,
  domain: YDomain
): string {
  const line = buildLinePath(points, w, h, domain);
  if (!line || w <= 0 || h <= 0) {
    return '';
  }
  return `${line} L ${w.toFixed(1)},${h.toFixed(1)} L 0.0,${h.toFixed(1)} Z`;
}

/**
 * Chooses an optimal bucket size in milliseconds so that there are between 6 and 12 candles.
 */
export function chooseBucketMs(points: readonly TickPoint[]): number {
  if (points.length < 2) return 5000;
  const span = points[points.length - 1]!.t - points[0]!.t;
  if (span <= 0) return 5000;

  // Aim for ~8 candles
  const target = Math.round(span / 8);
  if (target <= 1000) return 1000;
  if (target <= 2000) return 2000;
  if (target <= 5000) return 5000;
  if (target <= 10000) return 10000;
  if (target <= 15000) return 15000;
  if (target <= 30000) return 30000;
  return 60000;
}

/**
 * Groups ticks into time buckets (default 5s or derived).
 * Empty buckets are omitted; no synthetic candles.
 */
export function buildTimeCandles(
  points: readonly TickPoint[],
  bucketMs: number = 5000
): TimeCandle[] {
  if (points.length === 0) return [];

  const buckets = new Map<number, TickPoint[]>();

  for (const pt of points) {
    const bucketStart = Math.floor(pt.t / bucketMs) * bucketMs;
    const existing = buckets.get(bucketStart);
    if (existing) {
      existing.push(pt);
    } else {
      buckets.set(bucketStart, [pt]);
    }
  }

  const sortedStarts = Array.from(buckets.keys()).sort((a, b) => a - b);
  const candles: TimeCandle[] = [];

  for (const startT of sortedStarts) {
    const pts = buckets.get(startT)!;
    if (pts.length === 0) continue;

    let high = pts[0]!.price;
    let low = pts[0]!.price;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i]!.price > high) high = pts[i]!.price;
      if (pts[i]!.price < low) low = pts[i]!.price;
    }

    candles.push({
      startT,
      open: pts[0]!.price,
      high,
      low,
      close: pts[pts.length - 1]!.price,
    });
  }

  return candles;
}

export interface TimeLabelItem {
  readonly t: number;
  readonly label: string;
  readonly xFraction: number;
}

/**
 * Returns up to maxLabels (default 4) evenly spaced HH:MM:SS labels (24h device local time).
 */
export function timeLabels(
  points: readonly TickPoint[],
  maxLabels: number = 4
): TimeLabelItem[] {
  if (points.length === 0 || maxLabels <= 0) return [];

  const startT = points[0]!.t;
  const endT = points[points.length - 1]!.t;
  const span = endT - startT;

  const count = Math.min(maxLabels, points.length);
  if (count === 1 || span <= 0) {
    const d = new Date(startT);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return [{ t: startT, label: `${hh}:${mm}:${ss}`, xFraction: 0.5 }];
  }

  const labels: TimeLabelItem[] = [];
  for (let i = 0; i < count; i++) {
    const frac = i / (count - 1);
    const t = Math.round(startT + frac * span);
    const d = new Date(t);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    labels.push({
      t,
      label: `${hh}:${mm}:${ss}`,
      xFraction: frac,
    });
  }

  return labels;
}

/**
 * Finds index of nearest point to scrub x position, clamped to range.
 */
export function nearestPointIndex(
  points: readonly TickPoint[],
  x: number,
  w: number
): number {
  if (points.length === 0) return -1;
  if (points.length === 1 || w <= 0) return 0;

  const clampedX = Math.max(0, Math.min(w, x));
  const startTime = points[0]!.t;
  const endTime = points[points.length - 1]!.t;
  const timeSpan = endTime - startTime;

  if (timeSpan <= 0) {
    const fraction = clampedX / w;
    return Math.min(points.length - 1, Math.max(0, Math.round(fraction * (points.length - 1))));
  }

  const targetTime = startTime + (clampedX / w) * timeSpan;

  let closestIdx = 0;
  let minDiff = Math.abs(points[0]!.t - targetTime);

  for (let i = 1; i < points.length; i++) {
    const diff = Math.abs(points[i]!.t - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }

  return closestIdx;
}

/**
 * Determines chart direction versus previous close: 'up' | 'down' | 'flat'.
 */
export function direction(
  points: readonly TickPoint[],
  prevClose: Paise | null | undefined
): Direction {
  if (points.length === 0 || prevClose === null || prevClose === undefined) {
    return 'flat';
  }
  const lastPrice = points[points.length - 1]!.price;
  if (lastPrice > prevClose) return 'up';
  if (lastPrice < prevClose) return 'down';
  return 'flat';
}
