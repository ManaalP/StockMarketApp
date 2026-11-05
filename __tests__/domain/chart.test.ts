import { chartPath } from '../../src/domain/chart';

describe('Domain: chartPath (src/domain/chart.ts)', () => {
  test('returns empty path when points array has fewer than 2 points', () => {
    expect(chartPath([], 300, 150)).toEqual({
      path: '',
      min: 0,
      max: 0,
      pointsCount: 0,
    });

    expect(chartPath([250000], 300, 150)).toEqual({
      path: '',
      min: 250000,
      max: 250000,
      pointsCount: 1,
    });
  });

  test('returns a horizontal straight line when all points have identical values', () => {
    const result = chartPath([250000, 250000, 250000], 300, 150);
    expect(result.min).toBe(250000);
    expect(result.max).toBe(250000);
    expect(result.pointsCount).toBe(3);
    // Vertical center is 75 (150 / 2)
    expect(result.path).toBe('M 0.0,75.0 L 150.0,75.0 L 300.0,75.0');
  });

  test('computes normalized coordinates and generates valid SVG path for rising points', () => {
    // Points: 100, 200, 300 in 300x100 canvas with 10 padding
    // y-range: [10, 90] (available height: 80)
    // index 0 -> x=0, y=90 (min at bottom)
    // index 1 -> x=150, y=50 (mid)
    // index 2 -> x=300, y=10 (max at top)
    const result = chartPath([100, 200, 300], 300, 100, 10);
    expect(result.min).toBe(100);
    expect(result.max).toBe(300);
    expect(result.pointsCount).toBe(3);
    expect(result.path).toBe('M 0.0,90.0 L 150.0,50.0 L 300.0,10.0');
  });

  test('generates valid SVG path for falling points', () => {
    // Points: 300, 100 in 200x100 canvas with 0 padding
    // index 0 -> x=0, y=0 (top)
    // index 1 -> x=200, y=100 (bottom)
    const result = chartPath([300, 100], 200, 100, 0);
    expect(result.path).toBe('M 0.0,0.0 L 200.0,100.0');
  });
});
