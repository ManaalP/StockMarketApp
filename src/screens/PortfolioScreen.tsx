import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { PausedBanner } from '../components/PausedBanner';
import { StateView } from '../components/StateView';
import { usePortfolioList } from './portfolio/usePortfolioList';
import { HoldingsList } from './portfolio/HoldingsList';

export interface PortfolioScreenProps {
  readonly onSelectStock?: (symbol: string) => void;
  readonly testID?: string;
}

/**
 * Functional Live Portfolio Dashboard screen.
 * Orchestrates portfolio state, pull-to-refresh, pause notifications, and list rendering.
 */
export function PortfolioScreen({ onSelectStock, testID }: PortfolioScreenProps) {
  const { tokens } = useTheme();
  const {
    holdings,
    orderedSymbols,
    status,
    error,
    hydrationStatus,
    filter,
    sortBy,
    direction,
    searchQuery,
    setSearchQuery,
    refreshing,
    handleRefresh,
    handleSortPress,
    handleRemoveCategoryFilter,
    retry,
  } = usePortfolioList();

  // Full-screen loading when hydrating or first booting up with zero holdings
  if ((hydrationStatus === 'loading' || status === 'loading') && holdings.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.background }]}>
        <StateView state="loading" message="Loading portfolio..." />
      </View>
    );
  }

  // Full-screen error when initial fetch fails with zero holdings
  if (status === 'error' && holdings.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.background }]}>
        <StateView
          state="error"
          title="Connection Error"
          message={error?.message ?? 'Failed to load portfolio market data.'}
          onRetry={retry}
        />
      </View>
    );
  }

  return (
    <View
      testID={testID ?? 'portfolio.screen'}
      style={[styles.container, { backgroundColor: tokens.background }]}
    >
      <PausedBanner />
      <HoldingsList
        orderedSymbols={orderedSymbols}
        holdingsCount={holdings.length}
        status={status}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        direction={direction}
        filter={filter}
        onSortPress={handleSortPress}
        onRemoveFilter={handleRemoveCategoryFilter}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onSelectStock={onSelectStock}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
