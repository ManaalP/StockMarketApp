import { useState } from 'react';

const renderCounts = new WeakMap<object, number>();

/**
 * Custom hook tracking component render count in development.
 * Automatically compiles down to a no-op returning 0 in production builds.
 */
export function useRenderCount(): number {
  const [token] = useState<object>(() => ({}));

  if (__DEV__) {
    const next = (renderCounts.get(token) ?? 0) + 1;
    renderCounts.set(token, next);
    return next;
  }

  return 0;
}
