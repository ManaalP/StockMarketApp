import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { HoldingRow, HOLDING_ROW_HEIGHT } from '../../src/components/HoldingRow';
import { ThemeProvider } from '../../src/theme/useTheme';
import { priceStore } from '../../src/stores/priceStore';

describe('HoldingRow component', () => {
  beforeEach(() => {
    act(() => {
      priceStore.seed({
        RELIANCE: {
          ltp: 260000, // ₹2,600.00
          open: 250000,
          prevClose: 250000,
          high: 265000,
          low: 248000,
          volume: 50000,
        },
        // OLDCO unpriced
      });
    });
  });

  test('exports fixed HOLDING_ROW_HEIGHT for getItemLayout optimization', () => {
    expect(typeof HOLDING_ROW_HEIGHT).toBe('number');
    expect(HOLDING_ROW_HEIGHT).toBe(72);
  });

  test('renders holding information and live quote metrics for a priced stock', () => {
    const onPress = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <HoldingRow symbol="RELIANCE" onPress={onPress} />
        </ThemeProvider>
      );
    });

    const jsonStr = JSON.stringify(renderer.toJSON());

    // Symbol and badge
    expect(jsonStr).toContain('RELIANCE');
    expect(jsonStr).toContain('EQ');

    // Shares count and formatted avg price (from starting holdings: 25 shares @ ₹1,319.59)
    expect(jsonStr).toContain('shares');
    expect(jsonStr).toContain('Avg');

    // Live LTP (seeded at ₹2,600.00)
    expect(jsonStr).toContain('₹2,600.00');

    // P&L contains gain sign and formatted amount
    expect(jsonStr).toContain('+₹');

    // Test tap interaction
    const row = renderer.root.findByProps({ testID: 'holding.row.RELIANCE' });
    act(() => {
      row.props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith('RELIANCE');
  });

  test('renders "--" for price and P&L for unpriced holding (OLDCO)', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <HoldingRow symbol="OLDCO" />
        </ThemeProvider>
      );
    });

    const jsonStr = JSON.stringify(renderer.toJSON());

    expect(jsonStr).toContain('OLDCO');
    expect(jsonStr).toContain('30 shares');
    expect(jsonStr).toContain('Avg ₹412.50');

    // Price and P&L must be "--"
    expect(jsonStr).toContain('--');
    const ltpNode = renderer.root.findByProps({ testID: 'holding.ltp.OLDCO' });
    const pnlNode = renderer.root.findByProps({ testID: 'holding.pnl.OLDCO' });

    expect(ltpNode.findByType(Text).props.children).toBe('--');
    expect(pnlNode.findByType(Text).props.children).toBe('--');
  });
});
