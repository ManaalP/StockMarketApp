import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { computeSafeAreaMetrics } from '../../src/theme/useSafeArea';
import {
  SwipeTabWrapper,
  shouldSetHorizontalSwipe,
  resolveSwipeDirection,
} from '../../src/components/SwipeTabWrapper';

describe('Safe Area & Android Buttons Inset Compensation', () => {
  test('accurately detects Android 3-button navigation and elevates tab bar height', () => {
    // Android device with 48px soft navigation buttons and 32px camera punch hole
    const androidInsets = { top: 32, bottom: 48, left: 0, right: 0 };
    const metrics = computeSafeAreaMetrics(androidInsets, 'android');

    expect(metrics.hasNotch).toBe(true);
    expect(metrics.hasBottomButtons).toBe(true);
    expect(metrics.bottomPadding).toBe(48);
    // Tab bar height must expand by bottom insets (56 + 48 = 104px)
    expect(metrics.tabHeight).toBe(104);
    expect(metrics.tabPaddingBottom).toBe(50);
  });

  test('accurately detects iOS notch and dynamic island with home indicator', () => {
    // iPhone with notch (top 47, bottom 34)
    const iosInsets = { top: 47, bottom: 34, left: 0, right: 0 };
    const metrics = computeSafeAreaMetrics(iosInsets, 'ios');

    expect(metrics.hasNotch).toBe(true);
    expect(metrics.hasBottomButtons).toBe(true);
    expect(metrics.bottomPadding).toBe(34);
    expect(metrics.tabHeight).toBe(90);
    expect(metrics.tabPaddingBottom).toBe(36);
  });

  test('provides sensible defaults when bottom insets are 0 (hardware buttons)', () => {
    const zeroInsets = { top: 24, bottom: 0, left: 0, right: 0 };
    const metrics = computeSafeAreaMetrics(zeroInsets, 'android');

    expect(metrics.hasNotch).toBe(false);
    expect(metrics.hasBottomButtons).toBe(false);
    expect(metrics.bottomPadding).toBe(8);
    expect(metrics.tabHeight).toBe(64);
    expect(metrics.tabPaddingBottom).toBe(8);
  });
});

describe('Swipe Motion Gesture Navigation (SwipeTabWrapper)', () => {
  test('renders children cleanly inside PanResponder container', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <SwipeTabWrapper testID="swipe.test">
          <Text>Tab Content</Text>
        </SwipeTabWrapper>
      );
    });

    expect(renderer.root.findByProps({ testID: 'swipe.test' })).toBeDefined();
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

    // Direction resolution
    expect(resolveSwipeDirection(-60, 45)).toBe('left');
    expect(resolveSwipeDirection(60, 45)).toBe('right');
    expect(resolveSwipeDirection(20, 45)).toBeNull();
  });
});
