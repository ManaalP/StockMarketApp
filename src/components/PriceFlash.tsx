import React, { memo, useEffect, useRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import type { Paise } from '../domain/money';
import { priceFlashDirection } from '../domain/calcs';

export interface PriceFlashProps {
  readonly ltp: Paise | null;
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
  readonly borderRadius?: number;
}

// Flash colors with smooth opacity for Light and Dark modes
const GAIN_FLASH = 'rgba(34, 197, 94, 0.35)'; // Emerald green
const LOSS_FLASH = 'rgba(239, 68, 68, 0.35)'; // Crimson red
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/**
 * UI-Thread animated price flash wrapper.
 *
 * Requirements:
 * - Uses Reanimated shared values to animate price flashes directly on the UI thread.
 * - Flashes green on price increase, red on price decrease.
 * - Decoupled from JS thread: decay animation runs without triggering React re-renders.
 * - Ignores initial load and unpriced states via pure `priceFlashDirection`.
 */
export const PriceFlash = memo(function PriceFlash({
  ltp,
  children,
  style,
  testID,
  borderRadius = 4,
}: PriceFlashProps) {
  const prevLtpRef = useRef<Paise | null>(null);

  // Shared value:
  //  0  = transparent
  //  1  = gain green
  // -1  = loss red
  const flashValue = useSharedValue(0);

  useEffect(() => {
    const prevLtp = prevLtpRef.current;
    prevLtpRef.current = ltp;

    const direction = priceFlashDirection(prevLtp, ltp);
    if (direction === 'up') {
      flashValue.value = 1;
      flashValue.value = withTiming(0, { duration: 600 });
    } else if (direction === 'down') {
      flashValue.value = -1;
      flashValue.value = withTiming(0, { duration: 600 });
    }
  }, [ltp, flashValue]);

  const animatedStyle = useAnimatedStyle(() => {
    let backgroundColor = TRANSPARENT;
    if (flashValue.value > 0) {
      backgroundColor = interpolateColor(
        flashValue.value,
        [0, 1],
        [TRANSPARENT, GAIN_FLASH]
      );
    } else if (flashValue.value < 0) {
      backgroundColor = interpolateColor(
        -flashValue.value,
        [0, 1],
        [TRANSPARENT, LOSS_FLASH]
      );
    }
    return { backgroundColor };
  });

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.container,
        { borderRadius },
        style,
        animatedStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignSelf: 'flex-end',
  },
});
