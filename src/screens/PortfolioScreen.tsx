import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  RefreshControl,
  StyleSheet,
  type ListRenderItemInfo,
} from 'react-native';
import { useTheme } from '../theme/useTheme';
import {
  usePortfolioHoldings,
  useAppStatus,
  portfolioStore,
} from '../stores/portfolioStore';
import { priceStore } from '../stores/priceStore';
import {
  getSortedHoldingSymbols,
  type SortField,
  type SortDirection,
} from '../domain/calcs';
import { HoldingRow, HOLDING_ROW_HEIGHT } from '../components/HoldingRow';
import { SummaryCard } from '../components/SummaryCard';
import { PausedBanner } from '../components/PausedBanner';
import { StateView } from '../components/StateView';
import { usePerfOverlay, togglePerfOverlay } from '../utils/perfOverlay';

export interface PortfolioScreenProps {
  readonly onSelectStock?: (symbol: string) => void;
  readonly testID?: string;
}

/**
 * Functional Live Portfolio Dashboard screen.
 *
 * Architecture & Performance:
 * - 100% functional architecture.
 * - FlatList consumes `string[]` (symbol names), NOT objects, ensuring that price updates
 *   do not cause un-ticked rows or the list to re-render.
 * - Rows are memoized with `React.memo` and read their own prices via `usePrice(symbol)`.
 * - Fixed row height (`HOLDING_ROW_HEIGHT = 72`) with `getItemLayout` for O(1) scroll indexing.
 * - Search query ("Filter by symbol") filters symbols immediately.
 * - Sort order (Name | Value | P&L) recomputes immediately on user tap and on a slow 2-second
 *   interval for price-dependent sorts (Value/P&L), NEVER on every tick, so rows do not jump.
 * - Pull-to-refresh calls `portfolioStore.refresh()`.
 */
export function PortfolioScreen({ onSelectStock, testID }: PortfolioScreenProps) {
  const { tokens } = useTheme();

  const holdings = usePortfolioHoldings();
  const { status, error, hydrationStatus, refresh, retry } = useAppStatus();
  const showPerf = usePerfOverlay();

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [direction, setDirection] = useState<SortDirection>('asc');
  const [refreshing, setRefreshing] = useState(false);
  const [sortTick, setSortTick] = useState(0);

  // Slow interval (2s) for Value and P&L sorts so rows do not jump on every 20 Hz tick
  useEffect(() => {
    if (sortBy === 'name') {
      return; // Symbol names never change on market ticks
    }

    const intervalTimer = setInterval(() => {
      setSortTick((prev) => prev + 1);
    }, 2000);

    return () => clearInterval(intervalTimer);
  }, [sortBy]);

  // Derive sorted symbols purely during render (zero cascading setState in effect!)
  const orderedSymbols = useMemo(() => {
    // Reference sortTick to trigger periodic re-sort on 2s interval for Value and P&L
    void sortTick;
    return getSortedHoldingSymbols(holdings, priceStore.getQuotes(), {
      searchQuery,
      sortBy,
      direction,
    });
  }, [holdings, searchQuery, sortBy, direction, sortTick]);

  // Initial bootstrap on mount if not already ready
  useEffect(() => {
    if (status === 'idle') {
      void portfolioStore.bootstrap();
    }
  }, [status]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
      setSortTick((prev) => prev + 1);
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  // Row press handler
  const handleRowPress = useCallback(
    (symbol: string) => {
      onSelectStock?.(symbol);
    },
    [onSelectStock]
  );

  // Sort pill press handler
  const handleSortPress = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        // Toggle direction
        setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        // Default descending for financial metrics (Value, P&L); ascending for Name
        setDirection(field === 'name' ? 'asc' : 'desc');
      }
    },
    [sortBy]
  );

  // Stable FlatList callbacks
  const keyExtractor = useCallback((symbol: string) => symbol, []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: HOLDING_ROW_HEIGHT,
      offset: HOLDING_ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<string>) => (
      <HoldingRow symbol={item} onPress={handleRowPress} />
    ),
    [handleRowPress]
  );

  // Header component with SummaryCard, SearchBar, and Sort Controls
  const ListHeader = useMemo(() => {
    const renderSortButton = (field: SortField, label: string) => {
      const isActive = sortBy === field;
      const arrow = isActive ? (direction === 'asc' ? ' ↑' : ' ↓') : '';
      return (
        <Pressable
          testID={`sort.btn.${field}`}
          onPress={() => handleSortPress(field)}
          style={[
            styles.sortPill,
            {
              backgroundColor: isActive
                ? tokens.primary
                : tokens.surfaceContainer,
            },
          ]}
        >
          <Text
            style={[
              styles.sortPillText,
              { color: isActive ? tokens.surface : tokens.textSecondary },
            ]}
          >
            {label}
            {arrow}
          </Text>
        </Pressable>
      );
    };

    return (
      <View style={styles.headerContainer}>
        {/* Real-time Portfolio Summary */}
        <SummaryCard />

        {/* Controls: Filter & Sort */}
        <View style={styles.controlsSection}>
          {/* Search Input */}
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: tokens.surfaceAlt,
                borderColor: tokens.border,
              },
            ]}
          >
            <Text style={[styles.searchIcon, { color: tokens.textMuted }]}>
              🔍
            </Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Filter by symbol"
              placeholderTextColor={tokens.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={[styles.searchInput, { color: tokens.textPrimary }]}
            />
            {searchQuery.length > 0 ? (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={8}
                style={styles.clearBtn}
              >
                <Text style={[styles.clearText, { color: tokens.textMuted }]}>
                  ✕
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Sort Buttons Bar */}
          <View style={styles.sortBar}>
            <Text style={[styles.sortLabel, { color: tokens.textMuted }]}>
              Sort:
            </Text>
            <View style={styles.sortButtonsRow}>
              {renderSortButton('name', 'Name')}
              {renderSortButton('value', 'Value')}
              {renderSortButton('pnl', 'P&L')}
              {__DEV__ ? (
                <Pressable
                  testID="perf.toggle.btn"
                  onPress={togglePerfOverlay}
                  style={[
                    styles.perfTogglePill,
                    {
                      backgroundColor: showPerf
                        ? tokens.warningBg
                        : tokens.surfaceContainer,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.perfTogglePillText,
                      { color: showPerf ? tokens.warning : tokens.textMuted },
                    ]}
                  >
                    {showPerf ? '⚡ ON' : '⚡ Perf'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {/* Section Header: Holdings Count */}
        <View style={[styles.sectionHeader, { borderBottomColor: tokens.border }]}>
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
            Holdings
          </Text>
          <Text
            style={[
              styles.sectionBadge,
              {
                backgroundColor: tokens.surfaceContainer,
                color: tokens.textSecondary,
              },
            ]}
          >
            {orderedSymbols.length}
          </Text>
        </View>
      </View>
    );
  }, [
    tokens,
    sortBy,
    direction,
    searchQuery,
    orderedSymbols.length,
    handleSortPress,
    showPerf,
  ]);

  // Empty List component
  const ListEmpty = useMemo(() => {
    if (holdings.length === 0 && status === 'loading') {
      return null;
    }
    if (searchQuery.trim().length > 0) {
      return (
        <StateView
          state="empty"
          title="No Matching Holdings"
          message={`No holdings found matching "${searchQuery}".`}
          style={styles.emptyView}
        />
      );
    }
    return (
      <StateView
        state="empty"
        title="No Holdings"
        message="Your portfolio has no stock positions."
        style={styles.emptyView}
      />
    );
  }, [holdings.length, status, searchQuery]);

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
      {/* Informative banner when tick feed pauses */}
      <PausedBanner />

      {/* High-performance virtualized list */}
      <FlatList
        data={orderedSymbols}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={tokens.primary}
            colors={[tokens.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        initialNumToRender={25}
        maxToRenderPerBatch={25}
        windowSize={7}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  controlsSection: {
    marginTop: 14,
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
    height: '100%',
  },
  clearBtn: {
    padding: 8,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  sortButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  sortPill: {
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  perfTogglePill: {
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  perfTogglePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    marginTop: 14,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  emptyView: {
    marginTop: 40,
  },
});
