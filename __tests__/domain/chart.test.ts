import {
  pushTick,
  niceTicks,
  computeYDomain,
  decimatePoints,
  buildLinePath,
  buildAreaPath,
  chooseBucketMs,
  buildTimeCandles,
  timeLabels,
  nearestPointIndex,
  direction,
  type TickPoint,
} from '../../src/domain/chart';
import type { Paise } from '../../src/domain/money';

describe('Domain: Chart Pure Functions (src/domain/chart.ts)', () => {
  const p = (t: number, price: number): TickPoint => ({ t, price: price as Paise });

  describe('pushTick', () => {
    test('appends point immutably and caps buffer at specified limit', () => {
      let buf: TickPoint[] = [];
      for (let i = 1; i <= 5; i++) {
        buf = pushTick(buf, p(i * 1000, 250000 + i), 3);
      }
      expect(buf.length).toBe(3);
      expect(buf[0]!.price).toBe(250003);
      expect(buf[2]!.price).toBe(250005);
    });
  });

  describe('niceTicks', () => {
    test('returns exact 3 values evenly spaced between min and max', () => {
      const ticks = niceTicks(10000 as Paise, 30000 as Paise, 3);
      expect(ticks).toEqual([10000, 20000, 30000]);
    });

    test('handles single or identical min/max', () => {
      const ticks = niceTicks(250000 as Paise, 250000 as Paise, 3);
      expect(ticks).toEqual([250000]);
    });
  });

  describe('computeYDomain', () => {
    test('handles empty points', () => {
      const domain = computeYDomain([]);
      expect(domain.max).toBeGreaterThan(domain.min);
    });

    test('handles single point without zero-height domain', () => {
      const domain = computeYDomain([p(1000, 250000)]);
      expect(domain.max).toBeGreaterThan(domain.min);
      expect(domain.min).toBeLessThanOrEqual(250000);
      expect(domain.max).toBeGreaterThanOrEqual(250000);
    });

    test('handles flat series', () => {
      const domain = computeYDomain([p(1000, 250000), p(2000, 250000)]);
      expect(domain.max).toBeGreaterThan(domain.min);
    });

    test('incorporates reference lines if within range +-1.5% and adds 6% padding', () => {
      const points = [p(1000, 250000), p(2000, 260000)];
      // PrevClose at 259000 is within range
      const domain = computeYDomain(points, [259000 as Paise]);
      expect(domain.min).toBeLessThan(250000);
      expect(domain.max).toBeGreaterThan(260000);
    });

    test('handles huge swings cleanly', () => {
      const points = [p(1000, 100000), p(2000, 500000)];
      const domain = computeYDomain(points);
      expect(domain.min).toBeLessThan(100000);
      expect(domain.max).toBeGreaterThan(500000);
    });
  });

  describe('decimatePoints, buildLinePath & buildAreaPath', () => {
    test('preserves peaks (min and max) per pixel column', () => {
      // 10 points within a narrow 10px width
      const pts: TickPoint[] = [
        p(100, 200),
        p(101, 150),
        p(102, 500), // peak
        p(103, 50),  // trough
        p(104, 300),
      ];
      const decimated = decimatePoints(pts, 4); // 2 bins
      const prices = decimated.map((x) => x.price);
      expect(prices).toContain(500);
      expect(prices).toContain(50);
      expect(decimated[0]!.price).toBe(200);
      expect(decimated[decimated.length - 1]!.price).toBe(300);
    });

    test('returns empty path for < 2 points', () => {
      expect(buildLinePath([], 100, 100, { min: 0 as Paise, max: 100 as Paise })).toBe('');
      expect(buildLinePath([p(100, 200)], 100, 100, { min: 0 as Paise, max: 100 as Paise })).toBe('');
      expect(buildAreaPath([], 100, 100, { min: 0 as Paise, max: 100 as Paise })).toBe('');
    });

    test('builds valid line and area SVG commands', () => {
      const pts = [p(1000, 100), p(2000, 200), p(3000, 150)];
      const domain = { min: 100 as Paise, max: 200 as Paise };
      const line = buildLinePath(pts, 300, 100, domain);
      expect(line.startsWith('M 0.0,')).toBe(true);
      expect(line).toContain('L ');

      const area = buildAreaPath(pts, 300, 100, domain);
      expect(area.endsWith('Z')).toBe(true);
    });
  });

  describe('buildTimeCandles & chooseBucketMs', () => {
    test('groups points by time buckets and generates open, high, low, close', () => {
      const pts = [
        p(0, 100),
        p(1000, 150),
        p(2000, 80),
        p(4000, 120),
        // next bucket (5000ms bucket)
        p(5100, 130),
        p(6000, 200),
      ];
      const candles = buildTimeCandles(pts, 5000);
      expect(candles.length).toBe(2);

      // Bucket 1 (0ms)
      expect(candles[0]!.open).toBe(100);
      expect(candles[0]!.high).toBe(150);
      expect(candles[0]!.low).toBe(80);
      expect(candles[0]!.close).toBe(120);

      // Bucket 2 (5000ms)
      expect(candles[1]!.open).toBe(130);
      expect(candles[1]!.high).toBe(200);
      expect(candles[1]!.low).toBe(130);
      expect(candles[1]!.close).toBe(200);
    });

    test('skips empty buckets with zero synthetic data', () => {
      const pts = [p(0, 100), p(20000, 200)]; // 20s gap
      const candles = buildTimeCandles(pts, 5000);
      expect(candles.length).toBe(2);
      expect(candles[0]!.startT).toBe(0);
      expect(candles[1]!.startT).toBe(20000);
    });

    test('chooseBucketMs scales bucket duration with data range', () => {
      expect(chooseBucketMs([p(0, 100), p(60000, 100)])).toBe(10000);
    });
  });

  describe('timeLabels', () => {
    test('never exceeds maxLabels and formats HH:MM:SS', () => {
      const pts = [p(1700000000000, 100), p(1700000060000, 200), p(1700000120000, 300)];
      const labels = timeLabels(pts, 4);
      expect(labels.length).toBeLessThanOrEqual(4);
      for (const l of labels) {
        expect(l.label).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      }
    });

    test('handles empty points gracefully', () => {
      expect(timeLabels([], 4)).toEqual([]);
    });
  });

  describe('nearestPointIndex', () => {
    test('clamps scrub x to nearest index', () => {
      const pts = [p(1000, 100), p(2000, 200), p(3000, 300)];
      expect(nearestPointIndex(pts, -50, 300)).toBe(0);
      expect(nearestPointIndex(pts, 0, 300)).toBe(0);
      expect(nearestPointIndex(pts, 150, 300)).toBe(1);
      expect(nearestPointIndex(pts, 290, 300)).toBe(2);
      expect(nearestPointIndex(pts, 500, 300)).toBe(2);
    });

    test('handles empty array', () => {
      expect(nearestPointIndex([], 100, 300)).toBe(-1);
    });
  });

  describe('direction', () => {
    test('computes up, down, flat versus prevClose', () => {
      expect(direction([p(1000, 260000)], 250000 as Paise)).toBe('up');
      expect(direction([p(1000, 240000)], 250000 as Paise)).toBe('down');
      expect(direction([p(1000, 250000)], 250000 as Paise)).toBe('flat');
      expect(direction([p(1000, 260000)], null)).toBe('flat');
    });
  });
});
