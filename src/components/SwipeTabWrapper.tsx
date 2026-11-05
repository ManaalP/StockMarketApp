import React, { useMemo } from 'react';
import {
  View,
  PanResponder,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export interface SwipeTabWrapperProps {
  readonly children: React.ReactNode;
  readonly onSwipeLeft?: () => void;
  readonly onSwipeRight?: () => void;
  readonly threshold?: number;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * Pure helper determining whether a touch delta constitutes a horizontal swipe gesture.
 * Ignores vertical scrolling motions.
 */
export function shouldSetHorizontalSwipe(
  dx: number,
  dy: number,
  minDistance = 20
): boolean {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  return absDx > absDy * 1.5 && absDx > minDistance;
}

/**
 * Pure helper resolving swipe direction from horizontal delta.
 */
export function resolveSwipeDirection(
  dx: number,
  threshold = 45
): 'left' | 'right' | null {
  if (dx < -threshold) return 'left';
  if (dx > threshold) return 'right';
  return null;
}

/**
 * Functional gesture container enabling smooth horizontal swipe toggles between tab sections.
 *
 * Characteristics:
 * - 100% functional architecture.
 * - Non-intrusive: strictly ignores vertical scrolling (`Math.abs(dx) > Math.abs(dy) * 1.5`),
 *   allowing vertical FlatLists to scroll without any gesture contention.
 * - Triggers onSwipeLeft (e.g. Portfolio -> Watchlist) and onSwipeRight (e.g. Watchlist -> Portfolio).
 */
export const SwipeTabWrapper = React.memo(function SwipeTabWrapper({
  children,
  onSwipeLeft,
  onSwipeRight,
  threshold = 45,
  testID,
  style,
}: SwipeTabWrapperProps) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          return shouldSetHorizontalSwipe(gestureState.dx, gestureState.dy, 20);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const direction = resolveSwipeDirection(gestureState.dx, threshold);
          if (direction === 'left' && onSwipeLeft) {
            onSwipeLeft();
          } else if (direction === 'right' && onSwipeRight) {
            onSwipeRight();
          }
        },
      }),
    [onSwipeLeft, onSwipeRight, threshold]
  );

  return (
    <View testID={testID} style={[styles.container, style]} {...panResponder.panHandlers}>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

