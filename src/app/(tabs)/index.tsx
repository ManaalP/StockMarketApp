import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { PortfolioScreen } from '../../screens/PortfolioScreen';
import { SwipeTabWrapper } from '../../components/SwipeTabWrapper';

export default function PortfolioTab() {
  const router = useRouter();

  const handleSelectStock = useCallback(
    (symbol: string) => {
      router.push(`/stock/${symbol}`);
    },
    [router]
  );

  const handleSwipeToWatchlist = useCallback(() => {
    router.replace('/(tabs)/watchlist');
  }, [router]);

  return (
    <SwipeTabWrapper
      onSwipeLeft={handleSwipeToWatchlist}
      leftTargetTitle="Watchlist"
      testID="swipe.wrapper.portfolio"
    >
      <PortfolioScreen onSelectStock={handleSelectStock} />
    </SwipeTabWrapper>
  );
}
