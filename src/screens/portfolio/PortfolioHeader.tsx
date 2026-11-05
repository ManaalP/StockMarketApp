import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SummaryCard } from '../../components/SummaryCard';
import { PortfolioControls } from './PortfolioControls';
import { PortfolioSectionHeader } from './PortfolioSectionHeader';
import type { SortField } from '../../domain/calcs';

export interface PortfolioHeaderProps {
  readonly searchQuery: string;
  readonly onSearchChange: (text: string) => void;
  readonly sortBy: SortField;
  readonly direction: 'asc' | 'desc';
  readonly filter: string;
  readonly onSortPress: (field: SortField) => void;
  readonly onRemoveFilter: () => void;
  readonly count: number;
}

export function PortfolioHeader({
  searchQuery,
  onSearchChange,
  sortBy,
  direction,
  filter,
  onSortPress,
  onRemoveFilter,
  count,
}: PortfolioHeaderProps) {
  return (
    <View style={styles.headerContainer}>
      <SummaryCard />
      <PortfolioControls
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        sortBy={sortBy}
        direction={direction}
        filter={filter}
        onSortPress={onSortPress}
        onRemoveFilter={onRemoveFilter}
      />
      <PortfolioSectionHeader count={count} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
