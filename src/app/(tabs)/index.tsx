import React, { useEffect } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { SummaryCard } from '../../components/SummaryCard';
import { PausedBanner } from '../../components/PausedBanner';
import { portfolioStore } from '../../stores/portfolioStore';

export default function PortfolioScreen() {
  const { tokens } = useTheme();

  useEffect(() => {
    void portfolioStore.bootstrap();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: tokens.background }]}>
      <PausedBanner />
      <ScrollView contentContainerStyle={styles.content}>
        <SummaryCard />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
});
