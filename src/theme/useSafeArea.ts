import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

export interface SafeAreaMetrics {
  readonly insets: EdgeInsets;
  /**
   * True if device has a top notch, punch-hole camera, or dynamic island.
   */
  readonly hasNotch: boolean;
  /**
   * True if device has soft system navigation buttons (Android 3-button) or home indicator (iOS).
   */
  readonly hasBottomButtons: boolean;
  /**
   * Calculated bottom inset for tab bars, toolbars, and modal footers.
   */
  readonly bottomPadding: number;
  /**
   * Calculated height for bottom tab bar to guarantee icons never sit behind navigation buttons.
   */
  readonly tabHeight: number;
  /**
   * Bottom padding to apply to the bottom tab bar.
   */
  readonly tabPaddingBottom: number;
}

/**
 * Pure function to compute safe-area metrics for any platform and inset dimensions.
 * Decoupled from React hooks for 100% deterministic unit testing.
 */
export function computeSafeAreaMetrics(
  insets: EdgeInsets,
  platformOS: typeof Platform.OS = Platform.OS
): SafeAreaMetrics {
  // On iOS, notch typically has top > 20. On Android, punch-hole/notch has top > 28.
  const hasNotch = insets.top > (platformOS === 'android' ? 28 : 20);

  // Soft system navigation bar (Android 3-button or gesture bar) or iOS Home Indicator
  const hasBottomButtons = insets.bottom > 0;

  // On Android devices with physical or software buttons, provide breathing room
  const bottomPadding = Math.max(insets.bottom, platformOS === 'android' ? 8 : 4);

  // Elevated tab bar base height + bottom inset with comfortable clearance
  const tabHeight = 60 + (hasBottomButtons ? insets.bottom : 8);
  const tabPaddingBottom = hasBottomButtons ? insets.bottom + 6 : 12;

  return {
    insets,
    hasNotch,
    hasBottomButtons,
    bottomPadding,
    tabHeight,
    tabPaddingBottom,
  };
}

/**
 * Hook providing reactive safe area metrics, notch detection, and bottom navigation button compensation.
 */
export function useAppSafeArea(): SafeAreaMetrics {
  try {
    const insets = useSafeAreaInsets();
    return computeSafeAreaMetrics(insets, Platform.OS);
  } catch {
    return computeSafeAreaMetrics({ top: 0, bottom: 0, left: 0, right: 0 }, Platform.OS);
  }
}
