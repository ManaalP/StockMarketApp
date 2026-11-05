import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { ALLOWED_SYMBOLS } from '../data/constants';
import { useWatchlist, useIsInWatchlist } from '../stores/watchlistStore';

export interface WatchlistAddModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
}

interface SymbolPickerRowProps {
  readonly symbol: string;
  readonly onAdd: (symbol: string) => void;
}

const SymbolPickerRow = React.memo(function SymbolPickerRow({
  symbol,
  onAdd,
}: SymbolPickerRowProps) {
  const { tokens } = useTheme();
  const isAdded = useIsInWatchlist(symbol);

  const handleAdd = useCallback(() => {
    onAdd(symbol);
  }, [onAdd, symbol]);

  return (
    <View
      testID={`add.row.${symbol}`}
      style={[
        styles.row,
        {
          borderBottomColor: tokens.border,
          backgroundColor: tokens.surface,
        },
      ]}
    >
      <View style={styles.symbolInfo}>
        <Text style={[styles.symbolText, { color: tokens.textPrimary }]}>
          {symbol}
        </Text>
        <Text style={[styles.subText, { color: tokens.textMuted }]}>
          NSE Equity
        </Text>
      </View>

      {isAdded ? (
        <View
          testID={`add.badge.added.${symbol}`}
          style={[styles.addedBadge, { backgroundColor: tokens.surfaceContainer }]}
        >
          <Text style={[styles.addedText, { color: tokens.textSecondary }]}>
            Added
          </Text>
        </View>
      ) : (
        <Pressable
          testID={`add.btn.${symbol}`}
          accessibilityRole="button"
          accessibilityLabel={`Add ${symbol} to watchlist`}
          onPress={handleAdd}
          style={[styles.addButton, { backgroundColor: tokens.primary }]}
        >
          <Text style={styles.addText}>+ Add</Text>
        </Pressable>
      )}
    </View>
  );
});

export function WatchlistAddModal({ visible, onClose }: WatchlistAddModalProps) {
  const { tokens } = useTheme();
  const { addSymbol } = useWatchlist();
  const [query, setQuery] = useState('');

  const filteredSymbols = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return ALLOWED_SYMBOLS;
    return ALLOWED_SYMBOLS.filter((sym) => sym.toUpperCase().includes(q));
  }, [query]);

  const handleAdd = useCallback(
    (symbol: string) => {
      addSymbol(symbol);
    },
    [addSymbol]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: tokens.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: tokens.border }]}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>
            Add to Watchlist
          </Text>
          <Pressable
            testID="add.modal.done"
            accessibilityRole="button"
            accessibilityLabel="Close add modal"
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.doneButton}
          >
            <Text style={[styles.doneText, { color: tokens.primary }]}>Done</Text>
          </Pressable>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            testID="add.modal.search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search 25 NSE symbols..."
            placeholderTextColor={tokens.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={[
              styles.searchInput,
              {
                backgroundColor: tokens.surfaceContainer,
                color: tokens.textPrimary,
                borderColor: tokens.border,
              },
            ]}
          />
        </View>

        {/* Symbols List */}
        <FlatList
          data={filteredSymbols}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <SymbolPickerRow symbol={item} onAdd={handleAdd} />
          )}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          initialNumToRender={25}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  doneButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 12,
  },
  searchInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  symbolInfo: {
    justifyContent: 'center',
  },
  symbolText: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  subText: {
    fontSize: 11,
    marginTop: 2,
  },
  addedBadge: {
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addButton: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
