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
import { useFilterStore, filterStore } from '../stores/filterStore';
import {
  getSortedHoldingSymbols,
  type SortField,
} from '../domain/calcs';
import { HoldingRow, HOLDING_ROW_HEIGHT } from '../components/HoldingRow';
import { SummaryCard } from '../components/SummaryCard';
import { PausedBanner } from '../components/PausedBanner';
import { StateView } from '../components/StateView';
import { usePerfOverlay, togglePerfOverlay } from '../utils/perfOverlay';
import { SearchIcon, FilterIcon } from '../components/icons';

export interface PortfolioScreenProps {
  readonly onSelectStock?: (symbol: string) => void;
  readonly testID?: string;
}

const PRIMARY_SORT_OPTIONS: readonly { key: SortField; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'value', label: 'Value' },
  { key: 'pnl', label: 'P&L' },
];

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

  // Filter & Sort State from filterStore
  const { filter, sortBy, direction } = useFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [sortTick, setSortTick] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const flatListRef = React.useRef<FlatList<string>>(null);

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
      filter,
    });
  }, [holdings, searchQuery, sortBy, direction, filter, sortTick]);

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
      filterStore.toggleSort(field);
      setSortTick((prev) => prev + 1);
    },
    []
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

  // Active filter chip removable handler
  const handleRemoveCategoryFilter = useCallback(() => {
    filterStore.setCategoryFilter('all');
  }, []);

  // Header component with SummaryCard, SearchBar, and Compact Sort & Filter Controls
  const ListHeader = useMemo(() => {
    const isCustomFilterActive = filter !== 'all';

    return (
      <View style={styles.headerContainer}>
        {/* Real-time Portfolio Summary Card */}
        <SummaryCard />

        {/* Controls: Search, Sort Selector & Filter */}
        <View style={styles.controlsSection}>
          {/* Minimal Search Input */}
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
              onChangeText={setSearchQuery}
              placeholder="Filter by symbol or company"
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
                accessibilityLabel="Clear search input"
              >
                <Text style={[styles.clearText, { color: tokens.textMuted }]}>
                  ✕
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Compact Sort Segmented Selector + Filter Button */}
          <View style={styles.filterSortRow}>
            {/* Sort Segment Container */}
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
                    onPress={() => handleSortPress(opt.key)}
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

            {/* Filter Bottom Sheet / Modal Trigger Button */}
            <Pressable
              testID="portfolio.filter.open"
              accessibilityRole="button"
              accessibilityLabel="Open filter and sort menu"
              onPress={filterStore.openModal}
              style={[
                styles.filterButton,
                {
                  backgroundColor: isCustomFilterActive ? tokens.surfaceContainer : tokens.surface,
                  borderColor: isCustomFilterActive ? tokens.primary : tokens.border,
                },
              ]}
            >
              <FilterIcon
                color={isCustomFilterActive ? tokens.primary : tokens.textSecondary}
                size={14}
              />
              <Text
                style={[
                  styles.filterButtonText,
                  { color: isCustomFilterActive ? tokens.primary : tokens.textSecondary },
                ]}
              >
                {isCustomFilterActive ? `Filter: ${filter}` : 'Filter'}
              </Text>
            </Pressable>

            {/* Dev Perf Toggle */}
            {__DEV__ ? (
              <Pressable
                testID="perf.toggle.btn"
                onPress={togglePerfOverlay}
                style={[
                  styles.perfTogglePill,
                  {
                    backgroundColor: showPerf
                      ? tokens.warningBg
                      : tokens.surface,
                    borderColor: tokens.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.perfTogglePillText,
                    { color: showPerf ? tokens.warning : tokens.textMuted },
                  ]}
                >
                  {showPerf ? '⚡ ON' : '⚡'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Active Filter Chips (removable) */}
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
                  onPress={handleRemoveCategoryFilter}
                  hitSlop={6}
                  style={styles.chipCloseBtn}
                >
                  <Text style={[styles.chipCloseText, { color: tokens.textMuted }]}>
                    ✕
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {/* Section Header: Clean Holdings Count and Total Records */}
        <View style={[styles.sectionHeader, { borderBottomColor: tokens.border }]}>
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
            Holdings
          </Text>
          <View style={styles.sectionRightInfo}>
            <Text style={[styles.sectionCountText, { color: tokens.textMuted }]}>
              {`${orderedSymbols.length} ${orderedSymbols.length === 1 ? 'stock' : 'stocks'}`}
            </Text>
          </View>
        </View>
      </View>
    );
  }, [
    tokens,
    filter,
    sortBy,
    direction,
    searchQuery,
    orderedSymbols.length,
    handleSortPress,
    handleRemoveCategoryFilter,
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
        testID="portfolio.list"
        ref={flatListRef}
        data={orderedSymbols}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setShowBackToTop(y > 240);
        }}
        scrollEventThrottle={16}
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

      {/* Floating Back to Top Button */}
      {showBackToTop ? (
        <Pressable
          testID="portfolio.backToTop"
          accessibilityRole="button"
          accessibilityLabel="Back to top"
          onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
          style={[styles.backToTopBtn, { backgroundColor: tokens.primary }]}
        >
          <Text style={styles.backToTopText}>↑</Text>
        </Pressable>
      ) : null}
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
    paddingTop: 12,
  },
  controlsSection: {
    marginTop: 14,
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchIconWrap: {
    marginRight: 6,
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
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    height: 36,
  },
  sortSegmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  sortSegmentActive: {
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  sortSegmentText: {
    fontSize: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  perfTogglePill: {
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  perfTogglePillText: {
    fontSize: 11,
    fontWeight: '700',
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
  sectionHeader: {
    marginTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionRightInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyView: {
    marginTop: 40,
  },
  backToTopBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 99,
  },
  backToTopText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
});
