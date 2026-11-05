import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { PositionCard } from '../../src/components/PositionCard';
import { ThemeProvider } from '../../src/theme/useTheme';
import { priceStore } from '../../src/stores/priceStore';

describe('PositionCard', () => {
  beforeEach(() => {
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
      });
    });
  });

  function getAllText(root: ReactTestRenderer.ReactTestInstance): string[] {
    return root.findAllByType(Text).map((t) => {
      const ch = t.props.children;
      return Array.isArray(ch) ? ch.join('') : String(ch ?? '');
    });
  }

  test('returns null if symbol is not held in portfolio', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          {/* ADANIENT is not in starting holdings */}
          <PositionCard symbol="ADANIENT" />
        </ThemeProvider>
      );
    });

    expect(renderer.toJSON()).toBeNull();
  });

  test('renders full position metrics when stock is held and priced', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          {/* RELIANCE starting holdings: 25 shares @ ₹1,319.59 */}
          <PositionCard symbol="RELIANCE" />
        </ThemeProvider>
      );
    });

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('Your Position');
    expect(texts).toContain('25 SHARES');
    expect(texts).toContain('Avg. Price');
    expect(texts).toContain('Total Invested');
    expect(texts).toContain('Current Value');
    expect(texts).toContain('Total P&L');
    expect(texts).toContain('Today\'s P&L');

    // Live value at ₹2,600.00: 25 * 2600 = ₹65,000.00
    expect(texts).toContain('₹65,000.00');
  });

  test('renders "--" for value and P&L when stock is held but unpriced (OLDCO)', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          {/* OLDCO: 30 shares @ ₹412.50 = ₹12,375.00 invested, unpriced */}
          <PositionCard symbol="OLDCO" />
        </ThemeProvider>
      );
    });

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('Your Position');
    expect(texts).toContain('30 SHARES');
    expect(texts).toContain('₹412.50');
    expect(texts).toContain('₹12,375.00');
    expect(texts).toContain('--');
  });
});
