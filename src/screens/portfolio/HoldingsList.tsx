import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  FlatList,
  RefreshControl,
  Pressable,
  Text,
  StyleSheet,
  type ListRenderItemInfo,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { HoldingRow, HOLDING_ROW_HEIGHT } from '../../components/HoldingRow';
import { StateView } from '../../components/StateView';
import { PortfolioHeader } from './PortfolioHeader';
import type { SortField } from '../../domain/calcs';

export interface HoldingsListProps {
  readonly orderedSymbols: readonly string[];
  readonly holdingsCount: number;
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly searchQuery: string;
  readonly onSearchChange: (text: string) => void;
  readonly sortBy: SortField;
  readonly direction: 'asc' | 'desc';
  readonly filter: string;
  readonly onSortPress: (field: SortField) => void;
  readonly onRemoveFilter: () => void;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
  readonly onSelectStock?: (symbol: string) => void;
}

export function HoldingsList({
  orderedSymbols,
  holdingsCount,
  status,
  searchQuery,
  onSearchChange,
  sortBy,
  direction,
  filter,
  onSortPress,
  onRemoveFilter,
  refreshing,
  onRefresh,
  onSelectStock,
}: HoldingsListProps) {
  const { tokens } = useTheme();
  const flatListRef = useRef<FlatList<string>>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

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
      <HoldingRow symbol={item} onPress={onSelectStock} />
    ),
    [onSelectStock]
  );

  const ListHeader = useMemo(
    () => (
      <PortfolioHeader
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        sortBy={sortBy}
        direction={direction}
        filter={filter}
        onSortPress={onSortPress}
        onRemoveFilter={onRemoveFilter}
        count={orderedSymbols.length}
      />
    ),
    [
      searchQuery,
      onSearchChange,
      sortBy,
      direction,
      filter,
      onSortPress,
      onRemoveFilter,
      orderedSymbols.length,
    ]
  );

  const ListEmpty = useMemo(() => {
    if (holdingsCount === 0 && status === 'loading') {
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
  }, [holdingsCount, status, searchQuery]);

  return (
    <>
      <FlatList
        testID="portfolio.list"
        ref={flatListRef}
        data={orderedSymbols as string[]}
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
            onRefresh={onRefresh}
            tintColor={tokens.primary}
            colors={[tokens.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        initialNumToRender={25}
        maxToRenderPerBatch={25}
        windowSize={7}
      />

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
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 24,
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
