import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { useRenderCount } from '../utils/useRenderCount';
import { usePerfOverlay } from '../utils/perfOverlay';

export interface PerfBadgeProps {
  readonly symbol: string;
  readonly renderCount?: number;
}

export const PerfBadge = memo(function PerfBadge({ symbol, renderCount: propCount }: PerfBadgeProps) {
  const { tokens } = useTheme();
  const hookCount = useRenderCount();
  const renderCount = propCount ?? hookCount;
  const showPerf = usePerfOverlay();

  if (!__DEV__ || !showPerf) {
    return null;
  }

  return (
    <View style={[styles.perfBadge, { backgroundColor: tokens.warningBg }]}>
      <Text testID={`perf.badge.${symbol}`} style={[styles.perfText, { color: tokens.warning }]}>
        {`R: ${renderCount}`}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  perfBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  perfText: {
    fontSize: 9,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
