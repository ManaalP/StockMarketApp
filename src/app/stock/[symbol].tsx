import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function StockDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Stock Detail: {symbol}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
