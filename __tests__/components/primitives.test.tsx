import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PriceText } from '../../src/components/PriceText';
import { PnLText } from '../../src/components/PnLText';
import { StateView } from '../../src/components/StateView';
import { PausedBanner } from '../../src/components/PausedBanner';
import { toPaise } from '../../src/domain/money';

describe('Shared Primitives (PriceText, PnLText, StateView, PausedBanner)', () => {
  test('PriceText renders formatted INR and handles null as --', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PriceText paise={toPaise(1234.5)} />);
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('₹1,234.50');

    // Null renders "--"
    act(() => {
      renderer = ReactTestRenderer.create(<PriceText paise={null} />);
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('--');

    // 0 renders "₹0.00"
    act(() => {
      renderer = ReactTestRenderer.create(<PriceText paise={toPaise(0)} />);
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('₹0.00');
  });

  test('PnLText renders signed amounts and never relies on color alone', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    // Positive
    act(() => {
      renderer = ReactTestRenderer.create(
        <PnLText pnlPaise={toPaise(500)} pnlPct={2.5} />
      );
    });
    let str = JSON.stringify(renderer.toJSON());
    expect(str).toContain('+₹500.00');
    expect(str).toContain('+2.50%');

    // Negative
    act(() => {
      renderer = ReactTestRenderer.create(
        <PnLText pnlPaise={toPaise(-250.75)} pnlPct={-1.25} />
      );
    });
    str = JSON.stringify(renderer.toJSON());
    expect(str).toContain('-₹250.75');
    expect(str).toContain('-1.25%');

    // Null
    act(() => {
      renderer = ReactTestRenderer.create(
        <PnLText pnlPaise={null} pnlPct={null} />
      );
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('--');
  });

  test('StateView renders loading, empty, and error states with retry callback', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    // Loading
    act(() => {
      renderer = ReactTestRenderer.create(<StateView state="loading" />);
    });
    expect(renderer.root.props.state).toBe('loading');

    // Empty
    act(() => {
      renderer = ReactTestRenderer.create(
        <StateView state="empty" title="No Stocks Found" message="Try searching for another ticker" />
      );
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('No Stocks Found');

    // Error
    const onRetry = jest.fn();
    act(() => {
      renderer = ReactTestRenderer.create(
        <StateView state="error" message="Network Timeout" onRetry={onRetry} />
      );
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('Network Timeout');

    // Trigger retry
    const button = renderer.root.findByProps({ accessibilityRole: 'button' });
    act(() => {
      button.props.onPress();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('PausedBanner renders banner when paused is true and null when false', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    // Paused true
    act(() => {
      renderer = ReactTestRenderer.create(<PausedBanner paused={true} />);
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('Prices paused');

    // Paused false
    act(() => {
      renderer = ReactTestRenderer.create(<PausedBanner paused={false} />);
    });
    expect(renderer.toJSON()).toBeNull();
  });
});
