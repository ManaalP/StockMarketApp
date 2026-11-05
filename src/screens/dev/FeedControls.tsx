import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { portfolioStore } from '../../stores/portfolioStore';
import type { FeedStatus } from '../../feed/types';

export function FeedControls() {
  const { tokens } = useTheme();
  const feed = portfolioStore.getFeed?.();
  const [feedStatus, setFeedStatus] = useState<FeedStatus>(() => {
    return feed?.getStatus?.() ?? 'connected';
  });
  const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null);
  const disconnect5sTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (disconnect5sTimerRef.current) {
        clearTimeout(disconnect5sTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!feed?.onStatusChange) return;
    const unsub = feed.onStatusChange((status) => {
      setFeedStatus(status);
    });
    return unsub;
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

  const handleDisconnect5s = useCallback(() => {
    if (disconnect5sTimerRef.current) {
      clearTimeout(disconnect5sTimerRef.current);
    }
    feed?.disconnect?.();
    setFeedStatus('disconnected');
    setDisconnectCountdown(5);

    let secondsLeft = 5;
    const interval = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft > 0) {
        setDisconnectCountdown(secondsLeft);
      } else {
        clearInterval(interval);
        setDisconnectCountdown(null);
        feed?.connect?.();
        setFeedStatus('connected');
      }
    }, 1000);

    disconnect5sTimerRef.current = setTimeout(() => {
      clearInterval(interval);
      setDisconnectCountdown(null);
      feed?.connect?.();
      setFeedStatus('connected');
    }, 5000);
  }, [feed]);

  const handleSimulateDisconnect = useCallback(() => {
    feed?.simulateDisconnect?.();
  }, [feed]);

  return (
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
          accessibilityLabel={
            feedStatus === 'connected'
              ? 'Disconnect and pause feed'
              : 'Reconnect and resume feed'
          }
          onPress={handleToggleFeedConnection}
          style={[
            styles.actionButton,
            { backgroundColor: feedStatus === 'connected' ? tokens.loss : tokens.gain },
          ]}
        >
          <Text style={styles.actionButtonText}>
            {feedStatus === 'connected'
              ? 'Pause & Hold Feed Disconnected'
              : 'Resume & Connect Feed'}
          </Text>
        </Pressable>

        <Pressable
          testID="dev.disconnect.5s"
          accessibilityRole="button"
          accessibilityLabel="Disconnect feed for 5 seconds"
          onPress={handleDisconnect5s}
          style={[
            styles.actionButton,
            { backgroundColor: disconnectCountdown !== null ? tokens.warning : tokens.surfaceAlt },
          ]}
        >
          <Text
            style={[
              styles.actionButtonText,
              { color: disconnectCountdown !== null ? '#FFFFFF' : tokens.textPrimary },
            ]}
          >
            {disconnectCountdown !== null
              ? `Feed Disconnected (${disconnectCountdown}s remaining...)`
              : 'Disconnect Feed for 5s (Temporary Drop)'}
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
        Use &quot;Disconnect for 5s&quot; to temporarily drop ticks and verify paused state, or &quot;Pause &amp; Hold&quot; to keep disconnected.
      </Text>
    </View>
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
