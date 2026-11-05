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
import type { HoldingCategoryFilter, SortField, SortDirection } from '../domain/calcs';

export interface FilterModalProps {
  readonly testID?: string;
}

export const FilterModal = memo(function FilterModal({
  testID = 'filter.modal',
}: FilterModalProps) {
  const { filter, sortBy, direction, isModalOpen } = useFilterStore();
  const { tokens } = useTheme();

  if (!isModalOpen) {
    return null;
  }

  const CATEGORIES: { key: HoldingCategoryFilter; label: string; desc: string }[] = [
    { key: 'all', label: 'All Holdings', desc: 'Display all stocks in your portfolio' },
    { key: 'gainers', label: 'Gainers Only', desc: 'Positions currently in positive P&L' },
    { key: 'losers', label: 'Losers Only', desc: 'Positions currently in negative P&L' },
    { key: 'unpriced', label: 'Unpriced Only', desc: 'Holdings without live price quotes' },
  ];

  const SORT_FIELDS: { key: SortField; label: string }[] = [
    { key: 'name', label: 'Stock Symbol / Name' },
    { key: 'value', label: 'Current Holding Value' },
    { key: 'pnl', label: 'Total P&L Amount' },
  ];

  return (
    <Modal
      visible={isModalOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={filterStore.closeModal}
    >
      <SafeAreaView
        testID={testID}
        style={[styles.container, { backgroundColor: tokens.background }]}
      >
        {/* Modal Header */}
        <View style={[styles.header, { borderBottomColor: tokens.border }]}>
          <Pressable
            testID="filter.reset"
            accessibilityRole="button"
            accessibilityLabel="Reset all filters"
            onPress={filterStore.reset}
            hitSlop={8}
            style={styles.headerBtn}
          >
            <Text style={[styles.resetText, { color: tokens.textMuted }]}>Reset</Text>
          </Pressable>

          <Text style={[styles.title, { color: tokens.textPrimary }]}>Filter & Sort</Text>

          <Pressable
            testID="filter.close"
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={filterStore.closeModal}
            hitSlop={8}
            style={styles.headerBtn}
          >
            <Text style={[styles.doneText, { color: tokens.primary }]}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Section: Category Filter */}
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
            Holdings Filter
          </Text>
          <View style={styles.optionsList}>
            {CATEGORIES.map((cat) => {
              const isSelected = filter === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  testID={`filter.option.${cat.key}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => filterStore.setCategoryFilter(cat.key)}
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: tokens.surface,
                      borderColor: isSelected ? tokens.primary : tokens.border,
                    },
                  ]}
                >
                  <View style={styles.optionTextContainer}>
                    <Text
                      style={[
                        styles.optionLabel,
                        { color: isSelected ? tokens.primary : tokens.textPrimary },
                      ]}
                    >
                      {cat.label}
                    </Text>
                    <Text style={[styles.optionDesc, { color: tokens.textMuted }]}>
                      {cat.desc}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioCircle,
                      {
                        borderColor: isSelected ? tokens.primary : tokens.border,
                        backgroundColor: isSelected ? tokens.primary : 'transparent',
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Section: Sort Field */}
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary, marginTop: 20 }]}>
            Sort By
          </Text>
          <View style={styles.optionsList}>
            {SORT_FIELDS.map((sf) => {
              const isSelected = sortBy === sf.key;
              return (
                <Pressable
                  key={sf.key}
                  testID={`filter.sort.${sf.key}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => filterStore.setSort(sf.key, direction)}
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: tokens.surface,
                      borderColor: isSelected ? tokens.primary : tokens.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: isSelected ? tokens.primary : tokens.textPrimary },
                    ]}
                  >
                    {sf.label}
                  </Text>
                  <View
                    style={[
                      styles.radioCircle,
                      {
                        borderColor: isSelected ? tokens.primary : tokens.border,
                        backgroundColor: isSelected ? tokens.primary : 'transparent',
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Section: Sort Direction */}
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary, marginTop: 20 }]}>
            Order Direction
          </Text>
          <View style={styles.dirRow}>
            {(['asc', 'desc'] as SortDirection[]).map((dir) => {
              const isSelected = direction === dir;
              const label = dir === 'asc' ? 'Ascending (↑)' : 'Descending (↓)';
              return (
                <Pressable
                  key={dir}
                  testID={`filter.dir.${dir}`}
                  accessibilityRole="button"
                  onPress={() => filterStore.setSort(sortBy, dir)}
                  style={[
                    styles.dirBtn,
                    {
                      backgroundColor: isSelected ? tokens.primary : tokens.surfaceContainer,
                      borderColor: isSelected ? tokens.primary : tokens.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dirBtnText,
                      { color: isSelected ? '#FFFFFF' : tokens.textPrimary },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Apply Button */}
          <Pressable
            testID="filter.apply"
            accessibilityRole="button"
            accessibilityLabel="Apply filters"
            onPress={filterStore.closeModal}
            style={[styles.applyButton, { backgroundColor: tokens.primary }]}
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  doneText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  optionTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  dirRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dirBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dirBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  applyButton: {
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
