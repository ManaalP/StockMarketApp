import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { WatchlistScreen } from '../../screens/WatchlistScreen';
import { SwipeTabWrapper } from '../../components/SwipeTabWrapper';

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

  const handleSwipeToPortfolio = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  return (
    <SwipeTabWrapper
      onSwipeRight={handleSwipeToPortfolio}
      rightTargetTitle="Portfolio"
      testID="swipe.wrapper.watchlist"
    >
      <WatchlistScreen onSelectStock={handleSelectStock} />
    </SwipeTabWrapper>
  );
}
