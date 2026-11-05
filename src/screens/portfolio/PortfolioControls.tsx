import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { SearchIcon } from '../../components/icons';
import type { SortField } from '../../domain/calcs';

export interface PortfolioControlsProps {
  readonly searchQuery: string;
  readonly onSearchChange: (text: string) => void;
  readonly sortBy: SortField;
  readonly direction: 'asc' | 'desc';
  readonly filter: string;
  readonly onSortPress: (field: SortField) => void;
  readonly onRemoveFilter: () => void;
}

const PRIMARY_SORT_OPTIONS: readonly { key: SortField; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'value', label: 'Value' },
  { key: 'pnl', label: 'P&L' },
];

export function PortfolioControls({
  searchQuery,
  onSearchChange,
  sortBy,
  direction,
  filter,
  onSortPress,
  onRemoveFilter,
}: PortfolioControlsProps) {
  const { tokens } = useTheme();
  const isCustomFilterActive = filter !== 'all';

  return (
    <View style={styles.controlsSection}>
      {/* Search Input */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: tokens.surface,
            borderColor: tokens.border,
          },
        ]}
      >
        <View style={styles.searchIconWrap}>
          <SearchIcon color={tokens.textMuted} size={16} />
        </View>
        <TextInput
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Filter by symbol or company"
          placeholderTextColor={tokens.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={[styles.searchInput, { color: tokens.textPrimary }]}
        />
        {searchQuery.length > 0 ? (
          <Pressable
            onPress={() => onSearchChange('')}
            hitSlop={8}
            style={styles.clearBtn}
            accessibilityLabel="Clear search input"
          >
            <Text style={[styles.clearText, { color: tokens.textMuted }]}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Sort Segment Container */}
      <View style={styles.filterSortRow}>
        <View
          style={[
            styles.sortSegmentContainer,
            { backgroundColor: tokens.surfaceAlt, borderColor: tokens.border },
          ]}
        >
          {PRIMARY_SORT_OPTIONS.map((opt) => {
            const isActive = sortBy === opt.key;
            const arrow = isActive ? (direction === 'asc' ? ' ↑' : ' ↓') : '';
            return (
              <Pressable
                key={opt.key}
                testID={`sort.btn.${opt.key}`}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${opt.label} ${isActive ? (direction === 'asc' ? 'ascending' : 'descending') : ''}`}
                onPress={() => onSortPress(opt.key)}
                style={[
                  styles.sortSegmentButton,
                  isActive && [
                    styles.sortSegmentActive,
                    {
                      backgroundColor: tokens.surface,
                      shadowColor: '#000000',
                      borderColor: tokens.border,
                    },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.sortSegmentText,
                    {
                      color: isActive ? tokens.primary : tokens.textSecondary,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {opt.label}
                  {arrow}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Active Filter Chips */}
      {isCustomFilterActive ? (
        <View style={styles.activeChipsRow}>
          <View
            style={[
              styles.chip,
              { backgroundColor: tokens.surfaceContainer, borderColor: tokens.border },
            ]}
          >
            <Text style={[styles.chipText, { color: tokens.textPrimary }]}>
              {`Filter: ${filter.toUpperCase()}`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove filter"
              onPress={onRemoveFilter}
              hitSlop={6}
              style={styles.chipCloseBtn}
            >
              <Text style={[styles.chipCloseText, { color: tokens.textMuted }]}>✕</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  controlsSection: {
    marginTop: 14,
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchIconWrap: {
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
    height: '100%',
  },
  clearBtn: {
    padding: 6,
    minHeight: 36,
    minWidth: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortSegmentContainer: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    height: 38,
  },
  sortSegmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  sortSegmentActive: {
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sortSegmentText: {
    fontSize: 12,
  },
  activeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  chipCloseBtn: {
    padding: 2,
  },
  chipCloseText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
