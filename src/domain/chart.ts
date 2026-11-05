export interface ChartPathResult {
  readonly path: string;
  readonly min: number;
  readonly max: number;
  readonly pointsCount: number;
}

/**
 * Pure function to map an array of prices/numbers to an SVG polyline path.
 *
 * Rules:
 *   - Fewer than 2 points: returns empty path.
 *   - Identical min & max: straight horizontal center line.
 *   - Higher values map to lower y (top of screen), lower values to higher y (bottom of screen).
 *   - Incorporates vertical padding so line stroke does not get clipped.
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
    // val === max -> y = clampedPadding
    // val === min -> y = clampedPadding + usableHeight
    const normalized = (val - min) / (max - min);
    const y = height - clampedPadding - normalized * usableHeight;
    const cmd = i === 0 ? 'M' : 'L';
    parts.push(`${cmd} ${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return { path: parts.join(' '), min, max, pointsCount: count };
}
