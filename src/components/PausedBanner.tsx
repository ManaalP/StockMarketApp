import React, { memo } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { usePaused } from '../stores/priceStore';
import { useTheme } from '../theme/useTheme';

export interface PausedBannerProps {
  readonly paused?: boolean;
  readonly message?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/**
 * Functional component displaying an informative banner when live price ticks stall (> 2s).
 * Visual style matches Stitch "Live Status Feed Notice" spec.
 */
export const PausedBanner = memo(function PausedBanner({
  paused: controlledPaused,
  message = 'Prices paused. Waiting for live tick feed...',
  style,
  testID = 'banner.paused',
}: PausedBannerProps) {
  const storePaused = usePaused();
  const isPaused = controlledPaused ?? storePaused;
  const { tokens } = useTheme();

  if (!isPaused) {
    return null;
  }

  return (
    <View
      testID={testID}
      style={[
        styles.banner,
        {
          backgroundColor: tokens.pausedBg,
          borderColor: tokens.warning,
        },
        style,
      ]}
    >
      <View style={[styles.indicator, { backgroundColor: tokens.warning }]} />
      <Text style={[styles.text, { color: tokens.warning }]}>
        {message}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
