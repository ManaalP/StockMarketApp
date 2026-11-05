import React, { memo } from 'react';
import { useLtp, useRangeStats } from '../stores/priceStore';
import { DayRangeBar as DayRangeBarBase } from './DayRangeBar';

export interface DetailDayRangeProps {
  readonly symbol: string;
}

export const DetailDayRange = memo(function DetailDayRange({ symbol }: DetailDayRangeProps) {
  const ltp = useLtp(symbol);
  const range = useRangeStats(symbol);

  return (
    <DayRangeBarBase
      low={range.low}
      high={range.high}
      ltp={ltp}
    />
  );
});
