import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { networkStore, useNetworkOnline } from '../../stores/networkStore';
import { marketStore, useMarketClosedSimulation } from '../../stores/marketStore';

export function MarketControls() {
  const { tokens } = useTheme();
  const isOnline = useNetworkOnline();
  const isMarketClosedSimulated = useMarketClosedSimulation();

  const handleNetworkToggle = useCallback(() => {
    networkStore.toggle();
  }, []);

  const handleMarketToggle = useCallback(() => {
    marketStore.toggleSimulatedClosed();
  }, []);

  return (
    <>
      {/* Network Connectivity */}
      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
          Internet Connectivity Simulation
        </Text>
        <View style={styles.statusRow}>
          <Text style={[styles.label, { color: tokens.textMuted }]}>
            Network Connection:
          </Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: isOnline ? tokens.gainBg : tokens.lossBg },
            ]}
          >
            <Text
              testID="dev.network.status"
              style={[
                styles.badgeText,
                { color: isOnline ? tokens.gain : tokens.loss },
              ]}
            >
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>
        </View>

        <Pressable
          testID="dev.network.toggle"
          accessibilityRole="button"
          accessibilityLabel={isOnline ? 'Disconnect internet' : 'Restore internet'}
          onPress={handleNetworkToggle}
          style={[
            styles.actionButton,
            { backgroundColor: isOnline ? tokens.loss : tokens.gain },
          ]}
        >
          <Text style={styles.actionButtonText}>
            {isOnline
              ? 'Simulate Disconnection (Go Offline)'
              : 'Restore Internet Connection (Go Online)'}
          </Text>
        </Pressable>
        <Text style={[styles.footnote, { color: tokens.textMuted }]}>
          Simulates device internet outage. While offline, price ticks pause, pull-to-refresh displays an offline error, and toasts alert state transitions.
        </Text>
      </View>

      {/* Simulated Market Session */}
      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
          Simulate After Market Hours
        </Text>
        <View style={styles.statusRow}>
          <Text style={[styles.label, { color: tokens.textMuted }]}>
            Market Session:
          </Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isMarketClosedSimulated
                  ? tokens.lossBg
                  : tokens.gainBg,
              },
            ]}
          >
            <Text
              testID="dev.market.status"
              style={[
                styles.badgeText,
                { color: isMarketClosedSimulated ? tokens.loss : tokens.gain },
              ]}
            >
              {isMarketClosedSimulated ? 'MARKET CLOSED (SIMULATED)' : 'LIVE MARKET HOURS'}
            </Text>
          </View>
        </View>

        <Pressable
          testID="dev.market.toggle"
          accessibilityRole="button"
          accessibilityLabel={
            isMarketClosedSimulated
              ? 'Turn off after-market simulation'
              : 'Simulate after market hours'
          }
          onPress={handleMarketToggle}
          style={[
            styles.actionButton,
            { backgroundColor: isMarketClosedSimulated ? tokens.gain : tokens.loss },
          ]}
        >
          <Text style={styles.actionButtonText}>
            {isMarketClosedSimulated
              ? 'Resume Live Trading Session (Enable Ticks & Orders)'
              : 'Simulate After Market Hours (Pause Ticks & Block Trading)'}
          </Text>
        </Pressable>
        <Text style={[styles.footnote, { color: tokens.textMuted }]}>
          Simulates market open/closed state. By default orders and ticks run at any time for manual evaluation. Toggling closed pauses ticks and disallows placing orders in the sheet.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionButton: {
    minHeight: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  footnote: {
    fontSize: 12,
    lineHeight: 16,
  },
});
