import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { formatINR, formatVolume } from '../domain/format';
import type { Paise } from '../domain/money';

export interface StatCellProps {
  readonly label: string;
  readonly value: string;
  readonly testID?: string;
}

export const StatCell = memo(function StatCell({
  label,
  value,
  testID,
}: StatCellProps) {
  const { tokens } = useTheme();

  return (
    <View
      testID={testID}
      style={styles.cell}
    >
      <Text style={[styles.label, { color: tokens.textMuted }]}>{label}</Text>
      <Text
        testID={testID ? `${testID}.value` : undefined}
        style={[styles.value, { color: tokens.textPrimary }]}
      >
        {value}
      </Text>
    </View>
  );
});

export const OpenStat = memo(function OpenStat({ value }: { readonly value: Paise | null }) {
  return <StatCell label="Open" value={formatINR(value)} testID="stat.open" />;
});

export const HighStat = memo(function HighStat({ value }: { readonly value: Paise | null }) {
  return <StatCell label="High" value={formatINR(value)} testID="stat.high" />;
});

export const LowStat = memo(function LowStat({ value }: { readonly value: Paise | null }) {
  return <StatCell label="Low" value={formatINR(value)} testID="stat.low" />;
});

export const PrevCloseStat = memo(function PrevCloseStat({
  value,
}: {
  readonly value: Paise | null;
}) {
  return <StatCell label="Prev. Close" value={formatINR(value)} testID="stat.prevClose" />;
});

export const VolumeStat = memo(function VolumeStat({
  value,
}: {
  readonly value: number | null;
}) {
  return <StatCell label="Volume" value={formatVolume(value)} testID="stat.volume" />;
});

export interface StockStatsGridProps {
  readonly open: Paise | null;
  readonly high: Paise | null;
  readonly low: Paise | null;
  readonly prevClose: Paise | null;
  readonly volume: number | null;
}

/**
 * Live Stock Stats Grid.
 * Each metric is rendered inside an isolated memoized component so only updated values re-render.
 */
export const StockStatsGrid = memo(function StockStatsGrid({
  open,
  high,
  low,
  prevClose,
  volume,
}: StockStatsGridProps) {
  const { tokens } = useTheme();

  return (
    <View style={[styles.grid, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <View style={styles.row}>
        <OpenStat value={open} />
        <HighStat value={high} />
      </View>
      <View style={styles.row}>
        <LowStat value={low} />
        <PrevCloseStat value={prevClose} />
      </View>
      <View style={styles.row}>
        <VolumeStat value={volume} />
        <View style={styles.emptySpacer} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    gap: 12,
    marginVertical: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  cell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  emptySpacer: {
    flex: 1,
  },
});
