import React, { memo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface StateViewProps {
  readonly state: 'loading' | 'empty' | 'error';
  readonly title?: string;
  readonly message?: string;
  readonly onRetry?: () => void;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/**
 * Functional component rendering standard app loading, empty, and error feedback states.
 */
export const StateView = memo(function StateView({
  state,
  title,
  message,
  onRetry,
  style,
  testID,
}: StateViewProps) {
  const { tokens } = useTheme();

  if (state === 'loading') {
    return (
      <View testID={testID ?? 'state.loading'} style={[styles.center, style]}>
        <ActivityIndicator size="large" color={tokens.primary} />
        {message ? (
          <Text style={[styles.message, { color: tokens.textSecondary, marginTop: 12 }]}>
            {message}
          </Text>
        ) : null}
      </View>
    );
  }

  if (state === 'empty') {
    return (
      <View testID={testID ?? 'state.empty'} style={[styles.center, style]}>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>
          {title ?? 'No Items Found'}
        </Text>
        {message ? (
          <Text style={[styles.message, { color: tokens.textSecondary, marginTop: 8 }]}>
            {message}
          </Text>
        ) : null}
      </View>
    );
  }

  // Error state
  return (
    <View testID={testID ?? 'state.error'} style={[styles.center, style]}>
      <Text style={[styles.title, { color: tokens.loss }]}>
        {title ?? 'Something Went Wrong'}
      </Text>
      <Text style={[styles.message, { color: tokens.textSecondary, marginTop: 8 }]}>
        {message ?? 'Unable to load market data. Please check your connection and retry.'}
      </Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          testID="state.error.retry"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            {
              backgroundColor: tokens.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[styles.retryText, { color: '#ffffff' }]}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  center: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
