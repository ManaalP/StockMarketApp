/**
 * Pure calculation for exponential backoff with jitter.
 *
 * Formula:
 *   exponential = min(maxDelayMs, baseDelayMs * 2^attempt)
 *   withJitter  = exponential * (1 + rng() * 0.2)
 *
 * Requirements:
 * - Pure function, strictly outside React components and feed loops.
 * - Caps at maxDelayMs before jitter.
 * - Never returns negative or NaN values.
 */
export function computeBackoffDelay(
  attempt: number,
  baseDelayMs = 1000,
  maxDelayMs = 30000,
  rng: () => number = Math.random
): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const exponential = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, safeAttempt));
  const jitterFraction = Math.max(0, Math.min(1, rng())) * 0.2; // 0 to 20%
  const delayWithJitter = exponential * (1 + jitterFraction);
  return Math.round(delayWithJitter);
}
