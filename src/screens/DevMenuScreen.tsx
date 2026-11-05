import React, { memo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { FeedControls } from './dev/FeedControls';
import { MarketControls } from './dev/MarketControls';
import { PerfControls } from './dev/PerfControls';

export interface DevMenuScreenProps {
  readonly onBack?: () => void;
  readonly testID?: string;
}

export const DevMenuScreen = memo(function DevMenuScreen({
  onBack,
  testID,
}: DevMenuScreenProps) {
  const { tokens } = useTheme();

  return (
    <SafeAreaView
      testID={testID ?? 'dev.menu.screen'}
      style={[styles.container, { backgroundColor: tokens.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        {onBack ? (
          <Pressable
            testID="dev.menu.back"
            accessibilityRole="button"
            accessibilityLabel="Close developer menu"
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.backButton}
          >
            <Text style={[styles.backText, { color: tokens.primary }]}>‹ Back</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}

        <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>
          Developer Controls
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <FeedControls />
        <MarketControls />
        <PerfControls />
      </ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
});
