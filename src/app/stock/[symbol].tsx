import React, { useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StockDetailScreen } from '../../screens/StockDetailScreen';

export default function StockDetailRoute() {
  const router = useRouter();
  const { symbol } = useLocalSearchParams<{ symbol: string }>();

  const stockSymbol = typeof symbol === 'string' ? symbol : 'RELIANCE';

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <StockDetailScreen
      symbol={stockSymbol}
      onBack={handleBack}
    />
  );
}
