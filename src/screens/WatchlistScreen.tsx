import React, { useState, useCallback, useMemo } from 'react';
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
import { useWatchlist } from '../stores/watchlistStore';
import { useAppStatus } from '../stores/portfolioStore';
import { WatchRow, WATCH_ROW_HEIGHT } from '../components/WatchRow';
import { WatchlistAddModal } from '../components/WatchlistAddModal';
import { PausedBanner } from '../components/PausedBanner';
import { StateView } from '../components/StateView';
import { COMPANY_NAMES } from '../data/constants';
import { SearchIcon } from '../components/icons';

export interface WatchlistScreenProps {
  readonly onSelectStock?: (symbol: string) => void;
  readonly testID?: string;
}

/**
 * Functional Watchlist Screen.
 *
 * Requirements:
 * - 100% functional architecture.
 * - Displays user-managed watchlist with persisted AsyncStorage state.
 * - Virtualized list consuming string[] for optimal render isolation.
 * - Row shows live LTP, day change ₹ and %; missing price renders "--".
 * - Supports swipe-to-remove and Add Symbol sheet.
 * - Empty, loading, error, and paused states handled cleanly.
 */
export function WatchlistScreen({ onSelectStock, testID }: WatchlistScreenProps) {
  const { tokens } = useTheme();
  const { symbols, removeSymbol, isLoaded } = useWatchlist();
  const { status, error, refresh, retry } = useAppStatus();

  const [searchQuery, setSearchQuery] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const flatListRef = React.useRef<FlatList<string>>(null);
  const openSwipeableRef = React.useRef<{ close: () => void } | null>(null);

  const handleSwipeOpen = useCallback((_symbol: string, ref: unknown) => {
    const swipeable = ref as { close: () => void } | null;
    if (openSwipeableRef.current && openSwipeableRef.current !== swipeable) {
      openSwipeableRef.current.close();
    }
    openSwipeableRef.current = swipeable;
  }, []);

  const handleSwipeClose = useCallback((_symbol: string) => {
    // If the active open ref closed itself, clear it
  }, []);

  const filteredSymbols = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return symbols;
    return symbols.filter((sym) => {
      const symMatch = sym.toUpperCase().includes(q);
      const companyName = COMPANY_NAMES[sym]?.toUpperCase() ?? '';
      return symMatch || companyName.includes(q);
    });
  }, [searchQuery, symbols]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<string>) => (
      <WatchRow
        symbol={item}
        onPress={onSelectStock}
        onRemove={removeSymbol}
        onSwipeOpen={handleSwipeOpen}
        onSwipeClose={handleSwipeClose}
      />
    ),
    [onSelectStock, removeSymbol, handleSwipeOpen, handleSwipeClose]
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: WATCH_ROW_HEIGHT,
      offset: WATCH_ROW_HEIGHT * index,
      index,
    }),
    []
  );

  // Loading State
  if (status === 'loading' || !isLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: tokens.background }]}>
        <StateView
          state="loading"
          title="Loading Watchlist"
          message="Fetching latest market scrips..."
        />
      </View>
    );
  }

  // Error State
  if (status === 'error') {
    return (
      <View style={[styles.container, { backgroundColor: tokens.background }]}>
        <StateView
          state="error"
          title="Market Data Offline"
          message={error?.message ?? 'Could not connect to exchange servers.'}
          onRetry={retry}
        />
      </View>
    );
  }

  return (
    <View
      testID={testID ?? 'watchlist.screen'}
      style={[styles.container, { backgroundColor: tokens.background }]}
    >
      <PausedBanner />

      {/* Screen Sub-header / Actions */}
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        <View>
          <Text style={[styles.headerSubtitle, { color: tokens.textMuted }]}>
            {`${symbols.length} ${symbols.length === 1 ? 'symbol' : 'symbols'} tracked`}
          </Text>
        </View>

        <Pressable
          testID="watchlist.add.button"
          accessibilityRole="button"
          accessibilityLabel="Add symbols to watchlist"
          onPress={() => setAddModalVisible(true)}
          style={[styles.addButton, { backgroundColor: tokens.primary }]}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </Pressable>
      </View>

      {/* Filter / Search within watchlist */}
      {symbols.length > 0 ? (
        <View style={styles.searchBarContainer}>
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
              testID="watchlist.search.input"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search in watchlist..."
              placeholderTextColor={tokens.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={[
                styles.searchInput,
                {
                  color: tokens.textPrimary,
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      {/* Main List or Empty State */}
      {symbols.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>
            Your watchlist is empty
          </Text>
          <Text style={[styles.emptySubtitle, { color: tokens.textMuted }]}>
            Track real-time market prices across 25 high-liquidity NSE scrips by adding them here.
          </Text>
          <Pressable
            testID="watchlist.empty.add.button"
            accessibilityRole="button"
            accessibilityLabel="Add stocks to watchlist"
            onPress={() => setAddModalVisible(true)}
            style={[styles.emptyAddBtn, { backgroundColor: tokens.primary }]}
          >
            <Text style={styles.emptyAddBtnText}>+ Add Stocks</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          testID="watchlist.list"
          ref={flatListRef}
          data={filteredSymbols}
          keyExtractor={(sym) => sym}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          initialNumToRender={25}
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
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Floating Back to Top Button */}
      {showBackToTop ? (
        <Pressable
          testID="watchlist.backToTop"
          accessibilityRole="button"
          accessibilityLabel="Back to top"
          onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
          style={[styles.backToTopBtn, { backgroundColor: tokens.primary }]}
        >
          <Text style={styles.backToTopText}>↑</Text>
        </Pressable>
      ) : null}

      {/* Add Symbol Modal Sheet */}
      <WatchlistAddModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  addButton: {
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 42,
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
    height: '100%',
    paddingVertical: 0,
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyAddBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyAddBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
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
    shadowOpacity: 0.3,
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
