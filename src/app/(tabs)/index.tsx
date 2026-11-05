import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { PortfolioScreen } from '../../screens/PortfolioScreen';

export default function PortfolioTab() {
  const router = useRouter();

  const handleSelectStock = useCallback(
    (symbol: string) => {
      router.push(`/stock/${symbol}`);
    },
    [router]
  );

  return <PortfolioScreen onSelectStock={handleSelectStock} />;
}
