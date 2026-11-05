import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export interface PortfolioSectionHeaderProps {
  readonly count: number;
}

export function PortfolioSectionHeader({ count }: PortfolioSectionHeaderProps) {
  const { tokens } = useTheme();

  return (
    <View style={[styles.sectionHeader, { borderBottomColor: tokens.border }]}>
      <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>Holdings</Text>
      <View style={styles.sectionRightInfo}>
        <Text style={[styles.sectionCountText, { color: tokens.textMuted }]}>
          {`${count} ${count === 1 ? 'stock' : 'stocks'}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    marginTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionRightInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
