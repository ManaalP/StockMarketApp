import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  PanResponder,
  Animated,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface SwipeTabWrapperProps {
  readonly children: React.ReactNode;
  readonly onSwipeLeft?: () => void;
  readonly onSwipeRight?: () => void;
  readonly leftTargetTitle?: string;
  readonly rightTargetTitle?: string;
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
 * Pure helper determining whether a horizontal swipe gesture should be captured,
 * taking into account available swipe actions (e.g. ignoring left swipes on Watchlist
 * to leave row swipe-to-delete completely unobstructed).
 */
export function shouldCaptureSwipe(
  dx: number,
  dy: number,
  hasLeftAction: boolean,
  hasRightAction: boolean,
  minDistance = 20
): boolean {
  if (!shouldSetHorizontalSwipe(dx, dy, minDistance)) {
    return false;
  }
  if (dx < 0 && !hasLeftAction) return false;
  if (dx > 0 && !hasRightAction) return false;
  return true;
}

/**
 * Pure helper resolving swipe direction from horizontal delta and velocity.
 * Supports velocity-assisted flick gestures.
 */
export function resolveSwipeDirection(
  dx: number,
  threshold = 45,
  vx = 0
): 'left' | 'right' | null {
  if (dx < -threshold || (dx < -20 && vx < -0.5)) return 'left';
  if (dx > threshold || (dx > 20 && vx > 0.5)) return 'right';
  return null;
}

/**
 * Pure helper computing translation offset with rubber-band resistance
 * when dragging against an unsupported boundary.
 */
export function computeDampedOffset(
  dx: number,
  canSwipeLeft: boolean,
  canSwipeRight: boolean,
  maxTranslate = 160
): number {
  if (dx < 0) {
    if (canSwipeLeft) {
      return Math.max(dx, -maxTranslate);
    }
    return Math.max(dx * 0.15, -20);
  }
  if (dx > 0) {
    if (canSwipeRight) {
      return Math.min(dx, maxTranslate);
    }
    return Math.min(dx * 0.15, 20);
  }
  return 0;
}

/**
 * Functional gesture container enabling smooth horizontal swipe toggles between tab sections.
 *
 * Characteristics:
 * - 100% functional architecture.
 * - Non-intrusive: strictly ignores vertical scrolling (`Math.abs(dx) > Math.abs(dy) * 1.5`),
 *   allowing vertical FlatLists to scroll without any gesture contention.
 * - Smooth UI-thread animated translation during gesture (`translateX`).
 * - Floating directional target badges clearly communicating tab destination to the user.
 * - Triggers onSwipeLeft (e.g. Portfolio -> Watchlist) and onSwipeRight (e.g. Watchlist -> Portfolio).
 * - Leaves row-level gesture interactions (like swipe-to-delete) unobstructed when no tab action exists.
 */
export const SwipeTabWrapper = React.memo(function SwipeTabWrapper({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftTargetTitle,
  rightTargetTitle,
  threshold = 45,
  testID,
  style,
}: SwipeTabWrapperProps) {
  const { tokens } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    isNavigatingRef.current = false;
    translateX.setValue(0);
  }, [translateX, onSwipeLeft, onSwipeRight]);

  const hasLeft = Boolean(onSwipeLeft);
  const hasRight = Boolean(onSwipeRight);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          if (isNavigatingRef.current) return false;
          return shouldCaptureSwipe(gestureState.dx, gestureState.dy, hasLeft, hasRight, 20);
        },
        onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
          if (isNavigatingRef.current) return false;
          return shouldCaptureSwipe(gestureState.dx, gestureState.dy, hasLeft, hasRight, 20);
        },
        onPanResponderGrant: () => {
          translateX.stopAnimation();
        },
        onPanResponderMove: (_evt, gestureState) => {
          if (isNavigatingRef.current) return;
          const offset = computeDampedOffset(gestureState.dx, hasLeft, hasRight, 160);
          translateX.setValue(offset);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_evt, gestureState) => {
          if (isNavigatingRef.current) return;
          const direction = resolveSwipeDirection(gestureState.dx, threshold, gestureState.vx);

          if (direction === 'left' && onSwipeLeft) {
            isNavigatingRef.current = true;
            Animated.timing(translateX, {
              toValue: -180,
              duration: 150,
              useNativeDriver: true,
            }).start(() => {
              translateX.setValue(0);
              onSwipeLeft();
            });
          } else if (direction === 'right' && onSwipeRight) {
            isNavigatingRef.current = true;
            Animated.timing(translateX, {
              toValue: 180,
              duration: 150,
              useNativeDriver: true,
            }).start(() => {
              translateX.setValue(0);
              onSwipeRight();
            });
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              bounciness: 4,
              speed: 16,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          if (isNavigatingRef.current) return;
          Animated.spring(translateX, {
            toValue: 0,
            bounciness: 4,
            useNativeDriver: true,
          }).start();
        },
      }),
    [hasLeft, hasRight, onSwipeLeft, onSwipeRight, threshold, translateX]
  );

  const rightBadgeOpacity = translateX.interpolate({
    inputRange: [-threshold, -15, 0],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });

  const rightBadgeTranslateX = translateX.interpolate({
    inputRange: [-threshold, 0],
    outputRange: [0, 24],
    extrapolate: 'clamp',
  });

  const leftBadgeOpacity = translateX.interpolate({
    inputRange: [0, 15, threshold],
    outputRange: [0, 0.4, 1],
    extrapolate: 'clamp',
  });

  const leftBadgeTranslateX = translateX.interpolate({
    inputRange: [0, threshold],
    outputRange: [-24, 0],
    extrapolate: 'clamp',
  });

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        { backgroundColor: tokens.background },
        style,
      ]}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={[
          styles.animatedContent,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        {children}
      </Animated.View>

      {/* Floating Action Badges: Clearly show target tab during gesture */}
      {hasLeft ? (
        <Animated.View
          pointerEvents="none"
          testID="swipe.indicator.left"
          style={[
            styles.indicatorBadge,
            styles.rightBadge,
            {
              backgroundColor: tokens.primary,
              opacity: rightBadgeOpacity,
              transform: [{ translateX: rightBadgeTranslateX }],
            },
          ]}
        >
          <Text style={styles.indicatorText}>
            {leftTargetTitle ? `${leftTargetTitle} →` : 'Watchlist →'}
          </Text>
        </Animated.View>
      ) : null}

      {hasRight ? (
        <Animated.View
          pointerEvents="none"
          testID="swipe.indicator.right"
          style={[
            styles.indicatorBadge,
            styles.leftBadge,
            {
              backgroundColor: tokens.primary,
              opacity: leftBadgeOpacity,
              transform: [{ translateX: leftBadgeTranslateX }],
            },
          ]}
        >
          <Text style={styles.indicatorText}>
            {rightTargetTitle ? `← ${rightTargetTitle}` : '← Portfolio'}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  animatedContent: {
    flex: 1,
  },
  indicatorBadge: {
    position: 'absolute',
    top: '45%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    zIndex: 999,
  },
  rightBadge: {
    right: 16,
  },
  leftBadge: {
    left: 16,
  },
  indicatorText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
