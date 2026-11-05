import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { portfolioStore } from '../stores/portfolioStore';
import { networkStore, useNetworkOnline } from '../stores/networkStore';
import { marketStore, useMarketClosedSimulation } from '../stores/marketStore';
import { usePerfOverlay, togglePerfOverlay } from '../utils/perfOverlay';
import type { FeedStatus } from '../feed/types';

export interface DevMenuScreenProps {
  readonly onBack?: () => void;
  readonly testID?: string;
}

const TICK_RATE_OPTIONS = [1, 5, 10, 20, 50] as const;

export const DevMenuScreen = memo(function DevMenuScreen({
  onBack,
  testID,
}: DevMenuScreenProps) {
  const { tokens } = useTheme();
  const showPerf = usePerfOverlay();
  const isOnline = useNetworkOnline();
  const isMarketClosedSimulated = useMarketClosedSimulation();
  const [resetSuccess, setResetSuccess] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const feed = portfolioStore.getFeed?.();
  const [currentRate, setCurrentRate] = useState<number>(() => {
    return feed?.getTickRate?.() ?? 20;
  });
  const [feedStatus, setFeedStatus] = useState<FeedStatus>(() => {
    return feed?.getStatus?.() ?? 'connected';
  });

  useEffect(() => {
    if (!feed?.onStatusChange) return;
    const unsub = feed.onStatusChange((status) => {
      setFeedStatus(status);
    });
    return unsub;
  }, [feed]);

  const handleSelectRate = useCallback(
    (rateHz: number) => {
      setCurrentRate(rateHz);
      feed?.setTickRate?.(rateHz);
    },
    [feed]
  );

  const handleSimulateDisconnect = useCallback(() => {
    feed?.simulateDisconnect?.();
  }, [feed]);

  const handleToggleFeedConnection = useCallback(() => {
    if (feedStatus === 'connected') {
      feed?.disconnect?.();
      setFeedStatus('disconnected');
    } else {
      feed?.connect?.();
      setFeedStatus('connected');
    }
  }, [feed, feedStatus]);

  return (
    <SafeAreaView
      testID={testID ?? 'dev.menu.screen'}
      style={[styles.container, { backgroundColor: tokens.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: tokens.border }]}>
        {onBack ? (
          <Pressable
            testID="dev.menu.back"
            accessibilityRole="button"
            accessibilityLabel="Close developer menu"
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.backButton}
          >
            <Text style={[styles.backText, { color: tokens.primary }]}>‹ Back</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}

        <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>
          Developer Controls
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Section 1: Feed Status & Network Disconnection */}
        <View
          style={[
            styles.card,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
            Live Feed Status
          </Text>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: tokens.textMuted }]}>
              Current Transport:
            </Text>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    feedStatus === 'connected'
                      ? tokens.gainBg
                      : feedStatus === 'reconnecting'
                      ? tokens.warningBg
                      : tokens.lossBg,
                },
              ]}
            >
              <Text
                testID="dev.feed.status"
                style={[
                  styles.badgeText,
                  {
                    color:
                      feedStatus === 'connected'
                        ? tokens.gain
                        : feedStatus === 'reconnecting'
                        ? tokens.warning
                        : tokens.loss,
                  },
                ]}
              >
                {feedStatus.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={{ gap: 8, marginTop: 4 }}>
            <Pressable
              testID="dev.toggle.feed"
              accessibilityRole="button"
              accessibilityLabel={feedStatus === 'connected' ? 'Disconnect and pause feed' : 'Reconnect and resume feed'}
              onPress={handleToggleFeedConnection}
              style={[
                styles.actionButton,
                { backgroundColor: feedStatus === 'connected' ? tokens.loss : tokens.gain },
              ]}
            >
              <Text style={styles.actionButtonText}>
                {feedStatus === 'connected' ? 'Pause & Hold Feed Disconnected' : 'Resume & Connect Feed'}
              </Text>
            </Pressable>

            <Pressable
              testID="dev.force.disconnect"
              accessibilityRole="button"
              accessibilityLabel="Simulate feed transport drop"
              onPress={handleSimulateDisconnect}
              style={[styles.actionButton, { backgroundColor: tokens.surfaceContainer }]}
            >
              <Text style={[styles.actionButtonText, { color: tokens.textPrimary }]}>
                Simulate Transport Drop (Auto-Reconnect)
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.footnote, { color: tokens.textMuted }]}>
            Use "Pause & Hold" to keep feed quiet and observe the &gt;2s paused warning. Use "Transport Drop" to test exponential backoff.
          </Text>
        </View>

        {/* Section 2: Internet Connectivity Simulation */}
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
                {
                  backgroundColor: isOnline ? tokens.gainBg : tokens.lossBg,
                },
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
            onPress={() => networkStore.toggle()}
            style={[
              styles.actionButton,
              { backgroundColor: isOnline ? tokens.loss : tokens.gain },
            ]}
          >
            <Text style={styles.actionButtonText}>
              {isOnline ? 'Simulate Disconnection (Go Offline)' : 'Restore Internet Connection (Go Online)'}
            </Text>
          </Pressable>
          <Text style={[styles.footnote, { color: tokens.textMuted }]}>
            Simulates device internet (data / Wi-Fi) outage. While offline, price ticks pause, pull-to-refresh displays an offline error, and toasts alert state transitions.
          </Text>
        </View>

        {/* Section: Market Hours & Market Closed Override Simulation */}
        <View
          style={[
            styles.card,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
            Market Closed Simulation
          </Text>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: tokens.textMuted }]}>
              Market State:
            </Text>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isMarketClosedSimulated ? tokens.lossBg : tokens.gainBg,
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
                ? 'Turn off market closed simulation'
                : 'Turn on market closed simulation'
            }
            onPress={() => marketStore.toggleSimulatedClosed()}
            style={[
              styles.actionButton,
              { backgroundColor: isMarketClosedSimulated ? tokens.gain : tokens.loss },
            ]}
          >
            <Text style={styles.actionButtonText}>
              {isMarketClosedSimulated
                ? 'Turn Off Market Closed (Resume Live Market)'
                : 'Simulate Market Closed (Pause Ticks & Block Trading)'}
            </Text>
          </Pressable>
          <Text style={[styles.footnote, { color: tokens.textMuted }]}>
            When turned on: price ticks pause immediately and you cannot buy or sell stocks in the order sheet. Default is turned off.
          </Text>
        </View>

        {/* Section 3: Tick Rate Controller */}
        <View
          style={[
            styles.card,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
            Simulator Tick Rate
          </Text>
          <Text style={[styles.rateSubtitle, { color: tokens.textSecondary }]}>
            Active Rate: {currentRate} Hz (~{Math.round(1000 / currentRate)}ms interval)
          </Text>

          <View style={styles.ratePillRow}>
            {TICK_RATE_OPTIONS.map((rate) => {
              const isSelected = currentRate === rate;
              return (
                <Pressable
                  key={rate}
                  testID={`dev.tickrate.${rate}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Set tick rate to ${rate} Hz`}
                  onPress={() => handleSelectRate(rate)}
                  style={[
                    styles.ratePill,
                    {
                      backgroundColor: isSelected
                        ? tokens.primary
                        : tokens.surfaceContainer,
                      borderColor: isSelected
                        ? tokens.primary
                        : tokens.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.ratePillText,
                      {
                        color: isSelected ? '#FFFFFF' : tokens.textPrimary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {`${rate} Hz`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section 3: Performance & Profiling */}
        <View
          style={[
            styles.card,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
            Profiler Overlay
          </Text>
          <Text style={[styles.footnote, { color: tokens.textMuted }]}>
            Renders isolated re-render counters (R: N) directly on holding and watch rows to verify per-row tick isolation live.
          </Text>

          <Pressable
            testID="dev.toggle.perf"
            accessibilityRole="button"
            accessibilityLabel="Toggle render counters overlay"
            onPress={togglePerfOverlay}
            style={[
              styles.actionButton,
              {
                backgroundColor: showPerf
                  ? tokens.warning
                  : tokens.surfaceContainer,
              },
            ]}
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: showPerf ? '#FFFFFF' : tokens.textPrimary },
              ]}
            >
              {showPerf ? 'Disable Render Counters' : 'Enable Render Counters'}
            </Text>
          </Pressable>
        </View>

        {/* Portfolio Persistence & Storage Reset */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: tokens.surface,
              borderColor: tokens.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
            Portfolio Storage & Reset
          </Text>
          <Text style={{ color: tokens.textSecondary, fontSize: 13, marginBottom: 12 }}>
            Clears local modifications in storage key &quot;portfolio:v1&quot; and restores CSV defaults.
          </Text>
          <Pressable
            testID="dev.reset.portfolio.btn"
            accessibilityRole="button"
            accessibilityLabel="Reset portfolio to CSV defaults"
            onPress={async () => {
              await portfolioStore.resetPortfolio();
              setResetSuccess(true);
              if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
              resetTimerRef.current = setTimeout(() => setResetSuccess(false), 2000);
            }}
            style={[styles.actionButton, { backgroundColor: tokens.surfaceAlt }]}
          >
            <Text style={[styles.actionButtonText, { color: tokens.primary }]}>
              {resetSuccess ? '✓ Portfolio Reset to CSV' : 'Reset Portfolio to CSV Defaults'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
});

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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
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
  rateSubtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  ratePillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ratePill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratePillText: {
    fontSize: 13,
  },
});
