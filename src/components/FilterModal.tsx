import React, { memo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFilterStore, filterStore } from '../stores/filterStore';
import { useTheme } from '../theme/useTheme';
import type { HoldingCategoryFilter, SortField } from '../domain/calcs';

export interface FilterModalProps {
  readonly testID?: string;
}

interface SortOptionConfig {
  readonly key: SortField;
  readonly badge: string;
  readonly label: string;
  readonly defaultDir: 'asc' | 'desc';
}

const SORT_OPTIONS: readonly SortOptionConfig[] = [
  { key: 'name', badge: 'A-Z', label: 'Alphabetically', defaultDir: 'asc' },
  { key: 'change', badge: '%', label: 'Change', defaultDir: 'desc' },
  { key: 'ltp', badge: 'LTP', label: 'Last Traded Price', defaultDir: 'desc' },
  { key: 'pnl', badge: 'P&L', label: 'Profit & Loss Absolute', defaultDir: 'desc' },
  { key: 'pnlPct', badge: '%', label: 'Profit & Loss Percent', defaultDir: 'desc' },
  { key: 'invested', badge: '₹', label: 'Invested', defaultDir: 'desc' },
];

const FILTER_PILLS: readonly { key: HoldingCategoryFilter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'gainers', label: 'GAINERS' },
  { key: 'losers', label: 'LOSERS' },
  { key: 'unpriced', label: 'UNPRICED' },
];

export const FilterModal = memo(function FilterModal({
  testID = 'filter.modal',
}: FilterModalProps) {
  const { filter, sortBy, direction, isModalOpen } = useFilterStore();
  const { tokens } = useTheme();

  if (!isModalOpen) {
    return null;
  }

  const handleSelectSort = (option: SortOptionConfig) => {
    if (sortBy === option.key) {
      // Toggle direction if already active
      filterStore.setSort(option.key, direction === 'asc' ? 'desc' : 'asc');
    } else {
      filterStore.setSort(option.key, option.defaultDir);
    }
  };

  return (
    <Modal
      visible={isModalOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={filterStore.closeModal}
    >
      <SafeAreaView
        testID={testID}
        edges={['top', 'bottom']}
        style={[styles.container, { backgroundColor: tokens.background }]}
      >
        {/* Top Header matching Zerodha Kite: Filter on left, CLEAR on right */}
        <View style={[styles.header, { borderBottomColor: tokens.border }]}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>Filter</Text>

          <Pressable
            testID="filter.reset"
            accessibilityRole="button"
            accessibilityLabel="Clear all filters and sort settings"
            onPress={filterStore.reset}
            hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            style={styles.clearBtn}
          >
            <Text style={[styles.clearText, { color: tokens.primary }]}>CLEAR</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Section 1: Horizontal Filter Pills Row */}
          <View style={styles.pillsRow}>
            {FILTER_PILLS.map((pill) => {
              const isSelected = filter === pill.key;
              return (
                <Pressable
                  key={pill.key}
                  testID={`filter.option.${pill.key}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => filterStore.setCategoryFilter(pill.key)}
                  style={[
                    styles.pill,
                    {
                      borderColor: isSelected ? tokens.primary : tokens.border,
                      backgroundColor: isSelected ? tokens.surfaceContainer : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: isSelected ? tokens.primary : tokens.textPrimary },
                    ]}
                  >
                    {pill.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Section Divider */}
          <View style={[styles.divider, { backgroundColor: tokens.border }]} />

          {/* Section 2: Sort */}
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
            Sort
          </Text>

          <View style={styles.sortList}>
            {SORT_OPTIONS.map((opt) => {
              const isSelected = sortBy === opt.key;
              const dirSymbol = isSelected ? (direction === 'asc' ? ' ↑' : ' ↓') : '';

              return (
                <Pressable
                  key={opt.key}
                  testID={`filter.sort.${opt.key}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => handleSelectSort(opt)}
                  style={[
                    styles.sortRow,
                    {
                      borderBottomColor: tokens.border,
                      backgroundColor: isSelected ? tokens.surfaceContainer : 'transparent',
                    },
                  ]}
                >
                  {/* Left Badge */}
                  <View
                    style={[
                      styles.badgeContainer,
                      {
                        backgroundColor: isSelected ? tokens.primary : tokens.surfaceContainer,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: isSelected ? '#FFFFFF' : tokens.textSecondary },
                      ]}
                    >
                      {opt.badge}
                    </Text>
                  </View>

                  {/* Label */}
                  <Text
                    style={[
                      styles.sortLabel,
                      {
                        color: isSelected ? tokens.primary : tokens.textPrimary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {`${opt.label}${dirSymbol}`}
                  </Text>

                  {/* Active Radio Indicator */}
                  {isSelected ? (
                    <View style={styles.activeIndicator}>
                      <Text style={[styles.checkText, { color: tokens.primary }]}>✓</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {/* Done CTA Button */}
          <Pressable
            testID="filter.close"
            accessibilityRole="button"
            accessibilityLabel="Apply filters and close modal"
            onPress={filterStore.closeModal}
            style={[styles.doneButton, { backgroundColor: tokens.primary }]}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  clearBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  sortList: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  badgeContainer: {
    width: 44,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sortLabel: {
    flex: 1,
    fontSize: 15,
  },
  activeIndicator: {
    marginLeft: 8,
  },
  checkText: {
    fontSize: 16,
    fontWeight: '700',
  },
  doneButton: {
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
