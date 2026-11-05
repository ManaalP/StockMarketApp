import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { useLtp, useDayRefs } from '../stores/priceStore';
import { quoteDayMetrics } from '../domain/calcs';
import { PriceText } from './PriceText';
import { PnLText } from './PnLText';
import { PriceFlash } from './PriceFlash';

export interface DetailPriceHeaderProps {
  readonly symbol: string;
}

export const DetailPriceHeader = memo(function DetailPriceHeader({
  symbol,
}: DetailPriceHeaderProps) {
  const { tokens } = useTheme();
  const ltp = useLtp(symbol);
  const dayRefs = useDayRefs(symbol);
  const metrics = quoteDayMetrics({ ltp, prevClose: dayRefs.prevClose });

  return (
    <View style={styles.priceBlock}>
      <View style={styles.priceAndPillRow}>
        <PriceFlash ltp={metrics.ltp} testID="stock.detail.flash" style={styles.flashCenter}>
          <PriceText
            paise={metrics.ltp}
            testID="stock.detail.ltp"
            style={styles.priceText}
          />
        </PriceFlash>

        <View
          style={[
            styles.dayChangePill,
            {
              backgroundColor:
                (metrics.dayChangePaise ?? 0) > 0
                  ? tokens.gainBg
                  : (metrics.dayChangePaise ?? 0) < 0
                  ? tokens.lossBg
                  : tokens.surfaceAlt,
            },
          ]}
        >
          <PnLText
            pnlPaise={metrics.dayChangePaise}
            pnlPct={metrics.dayChangePct}
            testID="stock.detail.dayChange"
            style={styles.pnlText}
          />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  priceBlock: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  priceAndPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  flashCenter: {
    alignItems: 'center',
  },
  priceText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  dayChangePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pnlText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
