import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { View } from 'react-native';
import { HoldingRow } from '../../src/components/HoldingRow';
import { SummaryCard } from '../../src/components/SummaryCard';
import { ThemeProvider } from '../../src/theme/useTheme';
import { priceStore } from '../../src/stores/priceStore';
import { setPerfOverlayEnabled } from '../../src/utils/perfOverlay';
import { parseHoldingsCsv } from '../../src/data/holdingsParser';
import { STARTING_HOLDINGS_CSV } from '../../src/data/rawHoldings';
import type { Holding } from '../../src/domain/types';

describe('Performance Proof: Sustained 20s @ 20Hz (400 ticks) Benchmark', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const holdings: Holding[] = parseHoldingsCsv(STARTING_HOLDINGS_CSV);
  const holdingSymbols = holdings.map((h) => h.symbol);

  beforeEach(() => {
    jest.useFakeTimers();
    setPerfOverlayEnabled(true);

    // Initial seed for priced holdings
    const initialSeed: Record<string, { ltp: number; open: number; prevClose: number; high: number; low: number; volume: number }> = {};
    for (const sym of holdingSymbols) {
      if (sym !== 'OLDCO') {
        initialSeed[sym] = {
          ltp: 200000,
          open: 200000,
          prevClose: 200000,
          high: 210000,
          low: 195000,
          volume: 10000,
        };
      }
    }

    act(() => {
      priceStore.seed(initialSeed);
    });
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
      setPerfOverlayEnabled(false);
    });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function FullPortfolioView() {
    return (
      <ThemeProvider initialMode="light">
        <View>
          <SummaryCard />
          {holdingSymbols.map((sym) => (
            <HoldingRow key={sym} symbol={sym} />
          ))}
        </View>
      </ThemeProvider>
    );
  }

  test('400 seeded ticks over 20s (20Hz): row render counts match ltp changes and summary renders <= 4/sec', () => {
    act(() => {
      renderer = ReactTestRenderer.create(<FullPortfolioView />);
    });

    // Check all 21 rows exist and start with R: 1
    const ltpChangeCountBySymbol: Record<string, number> = {};
    for (const sym of holdingSymbols) {
      ltpChangeCountBySymbol[sym] = 0;
      const badge = renderer.root.findByProps({ testID: `perf.badge.${sym}` });
      expect(badge.props.children).toBe('R: 1');
    }

    const summaryBadge = renderer.root.findByProps({ testID: 'perf.badge.summary' });
    expect(summaryBadge.props.children).toBe('R: 1');

    // Simulate 20 seconds at 20 ticks/sec = 400 ticks.
    // Price ticks arrive every 50ms (20Hz).
    // The priceStore flushes every 100ms.
    // Summary throttles to ~4 Hz (250ms).
    const pricedSymbols = holdingSymbols.filter((s) => s !== 'OLDCO');
    let seq = 1;

    for (let t = 0; t < 400; t++) {
      // Pick a symbol (round-robin or varied)
      const sym = pricedSymbols[t % pricedSymbols.length]!;
      const isLtpTick = t % 2 === 0; // Every 2nd tick changes LTP, others update volume/high/low

      act(() => {
        if (isLtpTick) {
          ltpChangeCountBySymbol[sym] = (ltpChangeCountBySymbol[sym] ?? 0) + 1;
          priceStore.queueTick({
            symbol: sym,
            seq: seq++,
            ltp: 200000 + (t + 1) * 10,
          });
        } else {
          // Volume/high tick does NOT change LTP
          priceStore.queueTick({
            symbol: sym,
            seq: seq++,
            volume: 1000 + t,
          });
        }

        // Advance 50ms
        jest.advanceTimersByTime(50);
      });
    }

    // Flush any remaining timers (e.g. trailing summary throttle)
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // 1. Assert each row's render count:
    // With granular useLtp/useDayRefs selectors, a row renders 1 (initial) + the number of times its LTP changed.
    // Rows whose volume changed but LTP didn't do NOT re-render!
    for (const sym of holdingSymbols) {
      const badge = renderer.root.findByProps({ testID: `perf.badge.${sym}` });
      const rawCount = String(badge.props.children).replace('R: ', '');
      const renders = parseInt(rawCount, 10);
      const expectedRenders = 1 + (ltpChangeCountBySymbol[sym] ?? 0);

      expect(renders).toBe(expectedRenders);
    }

    // Unpriced OLDCO never received a tick -> strictly 1 render
    const oldcoBadge = renderer.root.findByProps({ testID: 'perf.badge.OLDCO' });
    expect(oldcoBadge.props.children).toBe('R: 1');

    // 2. Assert SummaryCard render count:
    // Over 20 seconds at ~4 Hz throttle max: 20s * 4 renders/sec = ~80 renders maximum (plus 1 initial = 81 max).
    const summaryRawCount = String(summaryBadge.props.children).replace('R: ', '');
    const summaryRenders = parseInt(summaryRawCount, 10);

    // Summary must be <= 4 per second * 20 seconds + 1
    expect(summaryRenders).toBeLessThanOrEqual(20 * 4 + 1);
    // Summary must have updated regularly (e.g., at least 20 times across the 20s test)
    expect(summaryRenders).toBeGreaterThanOrEqual(20);
  });
});
