import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { computeSafeAreaMetrics } from '../../src/theme/useSafeArea';
import {
  SwipeTabWrapper,
  shouldSetHorizontalSwipe,
  shouldCaptureSwipe,
  resolveSwipeDirection,
  computeDampedOffset,
} from '../../src/components/SwipeTabWrapper';
import { ThemeProvider } from '../../src/theme/useTheme';

describe('Safe Area & Android Buttons Inset Compensation', () => {
  test('accurately detects Android 3-button navigation and elevates tab bar height', () => {
    // Android device with 48px soft navigation buttons and 32px camera punch hole
    const androidInsets = { top: 32, bottom: 48, left: 0, right: 0 };
    const metrics = computeSafeAreaMetrics(androidInsets, 'android');

    expect(metrics.hasNotch).toBe(true);
    expect(metrics.hasBottomButtons).toBe(true);
    expect(metrics.bottomPadding).toBe(48);
    // Tab bar height elevates for soft buttons
    expect(metrics.tabHeight).toBe(108);
    expect(metrics.tabPaddingBottom).toBe(54);
  });

  test('accurately detects iOS notch and dynamic island with home indicator', () => {
    // iPhone with notch (top 47, bottom 34)
    const iosInsets = { top: 47, bottom: 34, left: 0, right: 0 };
    const metrics = computeSafeAreaMetrics(iosInsets, 'ios');

    expect(metrics.hasNotch).toBe(true);
    expect(metrics.hasBottomButtons).toBe(true);
    expect(metrics.bottomPadding).toBe(34);
    expect(metrics.tabHeight).toBe(94);
    expect(metrics.tabPaddingBottom).toBe(40);
  });

  test('provides sensible defaults when bottom insets are 0 (hardware buttons)', () => {
    const zeroInsets = { top: 24, bottom: 0, left: 0, right: 0 };
    const metrics = computeSafeAreaMetrics(zeroInsets, 'android');

    expect(metrics.hasNotch).toBe(false);
    expect(metrics.hasBottomButtons).toBe(false);
    expect(metrics.bottomPadding).toBe(8);
    expect(metrics.tabHeight).toBe(68);
    expect(metrics.tabPaddingBottom).toBe(14);
    expect(metrics.toastTopPadding).toBe(84);
  });
});

describe('Swipe Motion Gesture Navigation (SwipeTabWrapper)', () => {
  test('renders children cleanly inside PanResponder container', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <SwipeTabWrapper testID="swipe.test">
            <Text>Tab Content</Text>
          </SwipeTabWrapper>
        </ThemeProvider>
      );
    });

    expect(renderer.root.findByProps({ testID: 'swipe.test' })).toBeDefined();
    expect(renderer.root.findByType(Text).props.children).toBe('Tab Content');
  });

  test('shouldSetHorizontalSwipe correctly identifies horizontal swipe and ignores vertical scrolling', () => {
    // Vertical scroll motion: dx = 5, dy = 60 -> dy > dx * 1.5 -> Must NOT trigger
    expect(shouldSetHorizontalSwipe(5, 60, 20)).toBe(false);

    // Diagonal motion: dx = 30, dy = 30 -> not predominantly horizontal -> Must NOT trigger
    expect(shouldSetHorizontalSwipe(30, 30, 20)).toBe(false);

    // Below distance threshold: dx = 10, dy = 2 -> under 20px threshold -> Must NOT trigger
    expect(shouldSetHorizontalSwipe(10, 2, 20)).toBe(false);

    // Clean horizontal swipe: dx = 60, dy = 10 -> predominantly horizontal -> MUST trigger
    expect(shouldSetHorizontalSwipe(60, 10, 20)).toBe(true);
    expect(shouldSetHorizontalSwipe(-60, 10, 20)).toBe(true);
  });

  test('shouldCaptureSwipe respects available actions to avoid blocking row-level gestures', () => {
    // On Portfolio: hasLeftAction = true, hasRightAction = false
    // Left swipe (dx = -50, dy = 5) must be captured
    expect(shouldCaptureSwipe(-50, 5, true, false, 20)).toBe(true);
    // Right swipe on Portfolio (dx = 50, dy = 5) has no right target, must NOT be captured
    expect(shouldCaptureSwipe(50, 5, true, false, 20)).toBe(false);

    // On Watchlist: hasLeftAction = false, hasRightAction = true
    // Left swipe (dx = -50, dy = 5) must NOT be captured so row-level swipe-to-delete works
    expect(shouldCaptureSwipe(-50, 5, false, true, 20)).toBe(false);
    // Right swipe (dx = 50, dy = 5) must be captured to return to Portfolio
    expect(shouldCaptureSwipe(50, 5, false, true, 20)).toBe(true);

    // Vertical motion is never captured regardless of actions
    expect(shouldCaptureSwipe(5, 50, true, true, 20)).toBe(false);
  });

  test('resolveSwipeDirection resolves distance and velocity-assisted flick gestures', () => {
    // Standard distance-based threshold (threshold = 45)
    expect(resolveSwipeDirection(-60, 45)).toBe('left');
    expect(resolveSwipeDirection(60, 45)).toBe('right');
    expect(resolveSwipeDirection(20, 45)).toBeNull();

    // Fast flick gesture below standard threshold but with high velocity (vx > 0.5 / vx < -0.5)
    expect(resolveSwipeDirection(-25, 45, -0.6)).toBe('left');
    expect(resolveSwipeDirection(25, 45, 0.6)).toBe('right');

    // Slow small movement does not trigger
    expect(resolveSwipeDirection(22, 45, 0.2)).toBeNull();
    expect(resolveSwipeDirection(-22, 45, -0.2)).toBeNull();
  });

  test('computeDampedOffset applies rubber-band resistance on unsupported directions', () => {
    // Supported left swipe clamped to maxTranslate
    expect(computeDampedOffset(-100, true, false, 160)).toBe(-100);
    expect(computeDampedOffset(-200, true, false, 160)).toBe(-160);

    // Unsupported left swipe damped by 0.15 and clamped to -20
    expect(computeDampedOffset(-50, false, true, 160)).toBe(-7.5);
    expect(computeDampedOffset(-200, false, true, 160)).toBe(-20);

    // Supported right swipe clamped to maxTranslate
    expect(computeDampedOffset(100, false, true, 160)).toBe(100);
    expect(computeDampedOffset(200, false, true, 160)).toBe(160);

    // Unsupported right swipe damped by 0.15 and clamped to 20
    expect(computeDampedOffset(50, true, false, 160)).toBe(7.5);
    expect(computeDampedOffset(200, true, false, 160)).toBe(20);

    // Zero delta
    expect(computeDampedOffset(0, true, true, 160)).toBe(0);
  });

  test('renders target indicator badges when swipe actions are configured', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    const onSwipeLeft = jest.fn();
    const onSwipeRight = jest.fn();

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <SwipeTabWrapper
            onSwipeLeft={onSwipeLeft}
            onSwipeRight={onSwipeRight}
            leftTargetTitle="Watchlist"
            rightTargetTitle="Portfolio"
            testID="swipe.both"
          >
            <Text>Content</Text>
          </SwipeTabWrapper>
        </ThemeProvider>
      );
    });

    const leftBadge = renderer.root.findByProps({ testID: 'swipe.indicator.left' });
    const rightBadge = renderer.root.findByProps({ testID: 'swipe.indicator.right' });

    expect(leftBadge).toBeDefined();
    expect(rightBadge).toBeDefined();

    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain('Watchlist →');
    expect(json).toContain('← Portfolio');
  });
});
