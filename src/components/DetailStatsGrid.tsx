import React, { memo } from 'react';
import { useDayRefs, useRangeStats } from '../stores/priceStore';
import { StockStatsGrid as StockStatsGridBase } from './StockStatsGrid';

export interface DetailStatsGridProps {
  readonly symbol: string;
}

export const DetailStatsGrid = memo(function DetailStatsGrid({ symbol }: DetailStatsGridProps) {
  const dayRefs = useDayRefs(symbol);
  const range = useRangeStats(symbol);

  return (
    <StockStatsGridBase
      open={dayRefs.open}
      prevClose={dayRefs.prevClose}
      high={range.high}
      low={range.low}
      volume={range.volume}
    />
  );
});
