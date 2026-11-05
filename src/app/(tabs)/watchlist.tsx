import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { WatchlistScreen } from '../../screens/WatchlistScreen';

export default function WatchlistTabRoute() {
  const router = useRouter();

  const handleSelectStock = useCallback(
    (symbol: string) => {
      router.push({
        pathname: '/stock/[symbol]',
        params: { symbol },
      } as never);
    },
    [router]
  );

  return <WatchlistScreen onSelectStock={handleSelectStock} />;
}
