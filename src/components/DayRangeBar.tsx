import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { formatINR } from '../domain/format';
import { dayRangePosition } from '../domain/calcs';
import type { Paise } from '../domain/money';

export interface DayRangeBarProps {
  readonly low: Paise | null;
  readonly high: Paise | null;
  readonly ltp: Paise | null;
}

/**
 * Visual Day Range Bar indicating where the live LTP sits between the Day Low and Day High.
 *
 * Requirements:
 * - If low, high, or ltp is null, renders "--" and a disabled bar.
 * - Position indicator clamped strictly between 0% and 100%.
 */
export const DayRangeBar = memo(function DayRangeBar({
  low,
  high,
  ltp,
}: DayRangeBarProps) {
  const { tokens } = useTheme();
  const ratio = dayRangePosition(low, high, ltp);

  const isAvailable = ratio !== null && low !== null && high !== null;

  return (
    <View
      testID="day.range.bar"
      style={[
        styles.container,
        {
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.textMuted }]}>
          Day Range
        </Text>
        <Text
          testID="day.range.ratio"
          style={[styles.ratioText, { color: tokens.textSecondary }]}
        >
          {isAvailable ? `${Math.round(ratio * 100)}%` : '--'}
        </Text>
      </View>

      {/* Progress Track */}
      <View
        style={[
          styles.track,
          {
            backgroundColor: tokens.surfaceContainer,
          },
        ]}
      >
        {isAvailable ? (
          <View
            testID="day.range.indicator"
            style={[
              styles.indicator,
              {
                left: `${ratio * 100}%`,
                backgroundColor: tokens.primary,
                borderColor: tokens.surface,
              },
            ]}
          />
        ) : null}
      </View>

      {/* Low & High Labels */}
      <View style={styles.labelsRow}>
        <View>
          <Text style={[styles.subLabel, { color: tokens.textMuted }]}>L</Text>
          <Text
            testID="day.range.low"
            style={[styles.boundText, { color: tokens.textPrimary }]}
          >
            {formatINR(low)}
          </Text>
        </View>

        <View style={styles.alignRight}>
          <Text style={[styles.subLabel, { color: tokens.textMuted }]}>H</Text>
          <Text
            testID="day.range.high"
            style={[styles.boundText, { color: tokens.textPrimary }]}
          >
            {formatINR(high)}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 14,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratioText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 6,
    borderRadius: 3,
    position: 'relative',
    marginVertical: 6,
  },
  indicator: {
    position: 'absolute',
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    marginLeft: -7,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  boundText: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
});
