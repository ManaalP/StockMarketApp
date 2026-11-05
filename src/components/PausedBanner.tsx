import React, { memo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { usePaused } from '../stores/priceStore';
import { useNetworkOnline } from '../stores/networkStore';
import { useTheme } from '../theme/useTheme';

export interface PausedBannerProps {
  readonly paused?: boolean;
  readonly message?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/**
 * Functional component displaying feed status notices as a floating overlay banner:
 * - Rendered as an absolute overlay to prevent shifting or jarring jumps of the underlying UI.
 * - When offline: Red "No internet connection" banner.
 * - When price feed stalls (> 2s): Amber "Prices paused" warning banner.
 * - When price ticks become on / resume: Green "Prices live" confirmation banner (auto-dismisses).
 */
export const PausedBanner = memo(function PausedBanner({
  paused: controlledPaused,
  message = 'Prices paused. Waiting for live tick feed...',
  style,
  testID = 'banner.paused',
}: PausedBannerProps) {
  const storePaused = usePaused();
  const isOnline = useNetworkOnline();
  const isPaused = controlledPaused ?? storePaused;
  const { tokens } = useTheme();

  const [showLiveBanner, setShowLiveBanner] = useState(false);
  const prevPausedRef = useRef(isPaused);

  useEffect(() => {
    // Detect transition from paused (true) -> active (false)
    if (prevPausedRef.current && !isPaused && isOnline) {
      setShowLiveBanner(true);
      const timer = setTimeout(() => {
        setShowLiveBanner(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
    prevPausedRef.current = isPaused;
  }, [isPaused, isOnline]);

  if (!isOnline) {
    return (
      <View
        testID="banner.offline"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        pointerEvents="box-none"
        style={[styles.overlayContainer, style]}
      >
        <View
          style={[
            styles.banner,
            {
              backgroundColor: tokens.lossBg,
              borderColor: tokens.loss,
            },
          ]}
        >
          <View style={[styles.indicator, { backgroundColor: tokens.loss }]} />
          <Text style={[styles.text, { color: tokens.loss }]}>
            No internet connection. Price updates paused.
          </Text>
        </View>
      </View>
    );
  }

  if (isPaused) {
    return (
      <View
        testID={testID}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        pointerEvents="box-none"
        style={[styles.overlayContainer, style]}
      >
        <View
          style={[
            styles.banner,
            {
              backgroundColor: tokens.pausedBg,
              borderColor: tokens.warning,
            },
          ]}
        >
          <View style={[styles.indicator, { backgroundColor: tokens.warning }]} />
          <Text style={[styles.text, { color: tokens.warning }]}>
            {message}
          </Text>
        </View>
      </View>
    );
  }

  if (showLiveBanner) {
    return (
      <View
        testID="banner.live"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        pointerEvents="box-none"
        style={[styles.overlayContainer, style]}
      >
        <View
          style={[
            styles.banner,
            {
              backgroundColor: tokens.gainBg,
              borderColor: tokens.gain,
            },
          ]}
        >
          <View style={[styles.indicator, { backgroundColor: tokens.gain }]} />
          <Text style={[styles.text, { color: tokens.gain }]}>
            Prices live. Feed active and updating.
          </Text>
        </View>
      </View>
    );
  }

  return null;
});

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    zIndex: 900,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
