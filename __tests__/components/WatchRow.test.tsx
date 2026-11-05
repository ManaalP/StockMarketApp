import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { WatchRow, WATCH_ROW_HEIGHT } from '../../src/components/WatchRow';
import { ThemeProvider } from '../../src/theme/useTheme';
import { priceStore } from '../../src/stores/priceStore';

describe('WatchRow component', () => {
  beforeEach(() => {
    act(() => {
      priceStore.seed({
        RELIANCE: {
          ltp: 260000, // ₹2,600.00
          open: 250000,
          prevClose: 250000, // +10000 paise (+₹100.00)
          high: 265000,
          low: 248000,
          volume: 50000,
        },
      });
    });
  });

  test('exports fixed WATCH_ROW_HEIGHT = 72', () => {
    expect(WATCH_ROW_HEIGHT).toBe(72);
  });

  test('renders live quote and day change for priced stock', () => {
    const onPress = jest.fn();
    const onRemove = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <WatchRow symbol="RELIANCE" onPress={onPress} onRemove={onRemove} />
        </ThemeProvider>
      );
    });

    const jsonStr = JSON.stringify(renderer.toJSON());

    // Symbol, EQ badge, NSE Equity subtitle
    expect(jsonStr).toContain('RELIANCE');
    expect(jsonStr).toContain('EQ');
    expect(jsonStr).toContain('NSE Equity');

    // Live LTP (₹2,600.00)
    expect(jsonStr).toContain('₹2,600.00');

    // Day change: +₹100.00 (+4.00%)
    expect(jsonStr).toContain('+₹100.00');

    // Tap row
    const row = renderer.root.findByProps({ testID: 'watch.row.RELIANCE' });
    act(() => {
      row.props.onPress();
    });
    expect(onPress).toHaveBeenCalledWith('RELIANCE');

    // Tap remove
    const removeBtn = renderer.root.findByProps({ testID: 'watch.remove.RELIANCE' });
    act(() => {
      removeBtn.props.onPress();
    });
    expect(onRemove).toHaveBeenCalledWith('RELIANCE');
  });

  test('renders "--" cleanly when price is missing', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <WatchRow symbol="TCS" />
        </ThemeProvider>
      );
    });

    const jsonStr = JSON.stringify(renderer.toJSON());
    expect(jsonStr).toContain('TCS');
    expect(jsonStr).toContain('--');
  });
});
