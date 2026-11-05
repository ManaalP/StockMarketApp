import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { portfolioStore } from '../../stores/portfolioStore';
import { usePerfOverlay, togglePerfOverlay } from '../../utils/perfOverlay';

const TICK_RATE_OPTIONS = [1, 5, 10, 20, 50] as const;

export function PerfControls() {
  const { tokens } = useTheme();
  const showPerf = usePerfOverlay();
  const feed = portfolioStore.getFeed?.();
  const [currentRate, setCurrentRate] = useState<number>(() => {
    return feed?.getTickRate?.() ?? 20;
  });
  const [resetSuccess, setResetSuccess] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleSelectRate = useCallback(
    (rateHz: number) => {
      setCurrentRate(rateHz);
      feed?.setTickRate?.(rateHz);
    },
    [feed]
  );

  const handleResetPortfolio = useCallback(async () => {
    await portfolioStore.resetPortfolio();
    setResetSuccess(true);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setResetSuccess(false), 2000);
  }, []);

  return (
    <>
      {/* Tick Rate Controller */}
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
                    borderColor: isSelected ? tokens.primary : tokens.border,
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

      {/* Profiler Overlay */}
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
          onPress={handleResetPortfolio}
          style={[styles.actionButton, { backgroundColor: tokens.surfaceAlt }]}
        >
          <Text style={[styles.actionButtonText, { color: tokens.primary }]}>
            {resetSuccess ? '✓ Portfolio Reset to CSV' : 'Reset Portfolio to CSV Defaults'}
          </Text>
        </Pressable>
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
