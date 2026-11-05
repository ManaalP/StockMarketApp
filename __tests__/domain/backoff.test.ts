import { computeBackoffDelay } from '../../src/domain/backoff';

describe('Domain: Exponential Backoff (src/domain/backoff.ts)', () => {
  it('returns base delay when attempt is 0 and no jitter', () => {
    const delay = computeBackoffDelay(0, 1000, 30000, () => 0);
    expect(delay).toBe(1000);
  });

  it('doubles delay on successive attempts (exponential growth)', () => {
    const d0 = computeBackoffDelay(0, 1000, 30000, () => 0);
    const d1 = computeBackoffDelay(1, 1000, 30000, () => 0);
    const d2 = computeBackoffDelay(2, 1000, 30000, () => 0);
    const d3 = computeBackoffDelay(3, 1000, 30000, () => 0);

    expect(d0).toBe(1000);
    expect(d1).toBe(2000);
    expect(d2).toBe(4000);
    expect(d3).toBe(8000);
  });

  it('caps delay at maxDelayMs regardless of attempt count', () => {
    const capped = computeBackoffDelay(10, 1000, 15000, () => 0);
    expect(capped).toBe(15000);

    const largeAttempt = computeBackoffDelay(100, 1000, 30000, () => 0);
    expect(largeAttempt).toBe(30000);
  });

  it('handles negative or invalid attempt safely by treating as 0', () => {
    expect(computeBackoffDelay(-1, 1000, 30000, () => 0)).toBe(1000);
    expect(computeBackoffDelay(-100, 1000, 30000, () => 0)).toBe(1000);
  });

  it('adds jitter within [0, 20%] of computed delay', () => {
    // When rng returns 1, jitter is maximum (+20%)
    const maxJitter = computeBackoffDelay(1, 1000, 30000, () => 1);
    expect(maxJitter).toBe(2400); // 2000 * 1.2 = 2400

    // When rng returns 0.5, jitter is +10%
    const midJitter = computeBackoffDelay(1, 1000, 30000, () => 0.5);
    expect(midJitter).toBe(2200); // 2000 * 1.1 = 2200
  });
});
