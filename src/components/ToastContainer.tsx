import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useToasts, toastStore, type ToastType } from '../stores/toastStore';
import { useTheme } from '../theme/useTheme';
import { useAppSafeArea } from '../theme/useSafeArea';

export interface ToastContainerProps {
  readonly testID?: string;
}

export const ToastContainer = memo(function ToastContainer({
  testID = 'toast.container',
}: ToastContainerProps) {
  const toasts = useToasts();
  const { tokens } = useTheme();
  const { toastTopPadding } = useAppSafeArea();

  if (toasts.length === 0) {
    return null;
  }

  const getBadgeColors = (type: ToastType) => {
    switch (type) {
      case 'success':
        return { bg: tokens.gainBg, border: tokens.gain, text: tokens.gain, icon: '✓' };
      case 'error':
        return { bg: tokens.lossBg, border: tokens.loss, text: tokens.loss, icon: '✕' };
      case 'warning':
        return { bg: tokens.pausedBg, border: tokens.warning, text: tokens.warning, icon: '⚠' };
      case 'info':
      default:
        return { bg: tokens.surfaceContainer, border: tokens.primary, text: tokens.primary, icon: 'ℹ' };
    }
  };

  return (
    <View
      testID={testID}
      pointerEvents="box-none"
      style={[styles.container, { top: toastTopPadding }]}
    >
      {toasts.map((toast) => {
        const colors = getBadgeColors(toast.type);
        return (
          <Pressable
            key={toast.id}
            testID={`toast.item.${toast.id}`}
            accessibilityRole="alert"
            accessibilityLabel={`${toast.type} notification: ${toast.message}`}
            onPress={() => toastStore.dismiss(toast.id)}
            style={[
              styles.toastBox,
              {
                backgroundColor: colors.bg,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.toastIcon, { color: colors.text }]}>{colors.icon}</Text>
            <Text style={[styles.toastMessage, { color: tokens.textPrimary }]}>
              {toast.message}
            </Text>
            <Text style={[styles.dismissHint, { color: tokens.textMuted }]}>✕</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
    alignItems: 'center',
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    width: '100%',
    maxWidth: 420,
    gap: 10,
  },
  toastIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  toastMessage: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  dismissHint: {
    fontSize: 12,
    fontWeight: '700',
    paddingLeft: 4,
  },
});
