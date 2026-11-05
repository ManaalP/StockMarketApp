import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePortfolioHoldings, useAppStatus, portfolioStore } from '../../stores/portfolioStore';
import { priceStore } from '../../stores/priceStore';
import { useFilterStore, filterStore } from '../../stores/filterStore';
import { getSortedHoldingSymbols, type SortField } from '../../domain/calcs';

export function usePortfolioList() {
  const holdings = usePortfolioHoldings();
  const { status, error, hydrationStatus, refresh, retry } = useAppStatus();
  const { filter, sortBy, direction } = useFilterStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [sortTick, setSortTick] = useState(0);

  // Slow interval (2s) for Value and P&L sorts so rows do not jump on every tick
  useEffect(() => {
    if (sortBy === 'name') {
      return;
    }
    const intervalTimer = setInterval(() => {
      setSortTick((prev) => prev + 1);
    }, 2000);
    return () => clearInterval(intervalTimer);
  }, [sortBy]);

  // Derive sorted symbols purely during render
  const orderedSymbols = useMemo(() => {
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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
      setSortTick((prev) => prev + 1);
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const handleSortPress = useCallback((field: SortField) => {
    filterStore.toggleSort(field);
    setSortTick((prev) => prev + 1);
  }, []);

  const handleRemoveCategoryFilter = useCallback(() => {
    filterStore.setCategoryFilter('all');
  }, []);

  return {
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
  };
}
