import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { View } from 'react-native';
import { HoldingRow } from '../../src/components/HoldingRow';
import { SummaryCard } from '../../src/components/SummaryCard';
import { ThemeProvider } from '../../src/theme/useTheme';
import { priceStore } from '../../src/stores/priceStore';
import { setPerfOverlayEnabled } from '../../src/utils/perfOverlay';

describe('Performance Proof: Isolated Row Re-rendering', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  beforeEach(() => {
    jest.useFakeTimers();
    setPerfOverlayEnabled(true);

    act(() => {
      priceStore.seed({
        RELIANCE: {
          ltp: 260000,
          open: 250000,
          prevClose: 250000,
          high: 265000,
          low: 248000,
          volume: 50000,
        },
        TCS: {
          ltp: 320000,
          open: 350000,
          prevClose: 350000,
          high: 355000,
          low: 318000,
          volume: 20000,
        },
      });
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

  function TestDashboard() {
    return (
      <ThemeProvider initialMode="light">
        <View>
          <SummaryCard />
          <HoldingRow symbol="RELIANCE" />
          <HoldingRow symbol="TCS" />
        </View>
      </ThemeProvider>
    );
  }

  test('one price tick re-renders ONLY the affected row, leaving unaffected rows untouched', () => {
    act(() => {
      renderer = ReactTestRenderer.create(<TestDashboard />);
    });

    // Check initial render counts
    const relianceBadge = renderer.root.findByProps({ testID: 'perf.badge.RELIANCE' });
    const tcsBadge = renderer.root.findByProps({ testID: 'perf.badge.TCS' });
    const summaryBadge = renderer.root.findByProps({ testID: 'perf.badge.summary' });

    expect(relianceBadge.props.children).toBe('R: 1');
    expect(tcsBadge.props.children).toBe('R: 1');
    expect(summaryBadge.props.children).toBe('R: 1');

    // Emit a price tick specifically for RELIANCE
    act(() => {
      priceStore.queueTick({
        symbol: 'RELIANCE',
        seq: 1,
        ltp: 261500, // +₹15.00
      });
      // Flush batch interval (100 ms)
      jest.advanceTimersByTime(100);
    });

    // VERIFICATION:
    // 1. RELIANCE row re-rendered (1 -> 2)
    expect(relianceBadge.props.children).toBe('R: 2');

    // 2. TCS row DID NOT RE-RENDER (stays at 1)
    expect(tcsBadge.props.children).toBe('R: 1');

    // 3. SummaryCard receives throttled update (advancing past 250 ms)
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(summaryBadge.props.children).toBe('R: 2');
    // TCS row STILL remains at 1
    expect(tcsBadge.props.children).toBe('R: 1');
  });
});
