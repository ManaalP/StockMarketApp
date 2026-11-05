import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { OrderSheet } from '../../src/components/OrderSheet';
import { ThemeProvider } from '../../src/theme/useTheme';
import { priceStore } from '../../src/stores/priceStore';
import { portfolioStore } from '../../src/stores/portfolioStore';

describe('OrderSheet component', () => {
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

  test('renders modal sheet with live price, quantity, and BUY preview', () => {
    const onClose = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <OrderSheet visible symbol="RELIANCE" initialSide="BUY" onClose={onClose} />
        </ThemeProvider>
      );
    });

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('BUY RELIANCE');
    expect(texts).toContain('₹2,600.00');
    expect(texts).toContain('Estimated Order Value');
    expect(texts).toContain('Orders are local only and simulated on device.');
  });

  test('switches to SELL mode and shows error if trying to oversell', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <OrderSheet visible symbol="RELIANCE" initialSide="SELL" onClose={jest.fn()} />
        </ThemeProvider>
      );
    });

    // RELIANCE held: 25 shares.
    const qtyInput = renderer.root.findByProps({ testID: 'order.sheet.qty.input' });

    // Try selling 30 shares
    act(() => {
      qtyInput.props.onChangeText('30');
    });

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toBeDefined();

    const errorText = renderer.root.findByProps({ testID: 'order.sheet.error' });
    expect(errorText.props.children).toBe("You hold 25 shares. You can't sell 30.");

    const confirmBtn = renderer.root.findByProps({ testID: 'order.sheet.confirm.button' });
    expect(confirmBtn.props.disabled).toBe(true);
  });

  test('executes BUY order and calls portfolioStore.executeOrder', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // Ensure not random test failure
    const executeSpy = jest.spyOn(portfolioStore, 'executeOrder');
    const onClose = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <OrderSheet visible symbol="RELIANCE" initialSide="BUY" onClose={onClose} />
        </ThemeProvider>
      );
    });

    const qtyInput = renderer.root.findByProps({ testID: 'order.sheet.qty.input' });
    act(() => {
      qtyInput.props.onChangeText('10');
    });

    const confirmBtn = renderer.root.findByProps({ testID: 'order.sheet.confirm.button' });
    act(() => {
      confirmBtn.props.onPress();
    });

    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'RELIANCE',
        side: 'BUY',
        qty: 10,
        fillPaise: 260000,
        type: 'MARKET',
      })
    );

    // Displays success confirmation screen
    expect(renderer.root.findByProps({ testID: 'order.sheet.screen.success' })).toBeDefined();

    executeSpy.mockRestore();
  });

  test('places SELL limit order with target price and displays in-progress confirmation', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // Ensure not random failure
    const executeSpy = jest.spyOn(portfolioStore, 'executeOrder');
    const onClose = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <OrderSheet visible symbol="RELIANCE" initialSide="SELL" onClose={onClose} />
        </ThemeProvider>
      );
    });

    // Switch to Target Price (Limit) order
    const limitTab = renderer.root.findByProps({ testID: 'order.sheet.mode.limit' });
    act(() => {
      limitTab.props.onPress();
    });

    // Enter target price higher than current LTP
    const targetPriceInput = renderer.root.findByProps({ testID: 'order.sheet.targetPrice.input' });
    act(() => {
      targetPriceInput.props.onChangeText('2700');
    });

    const qtyInput = renderer.root.findByProps({ testID: 'order.sheet.qty.input' });
    act(() => {
      qtyInput.props.onChangeText('5');
    });

    const confirmBtn = renderer.root.findByProps({ testID: 'order.sheet.confirm.button' });
    act(() => {
      confirmBtn.props.onPress();
    });

    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'RELIANCE',
        side: 'SELL',
        qty: 5,
        type: 'LIMIT',
        targetPaise: 270000,
        status: 'PENDING',
      })
    );

    // Displays in-progress confirmation screen
    expect(renderer.root.findByProps({ testID: 'order.sheet.screen.progress' })).toBeDefined();

    // Dismissing via Done button calls onClose
    const doneBtn = renderer.root.findByProps({ testID: 'order.sheet.done' });
    act(() => {
      doneBtn.props.onPress();
    });
    expect(onClose).toHaveBeenCalled();

    (Math.random as unknown as jest.Mock).mockRestore();
    executeSpy.mockRestore();
  });

  test('triggers instantly when target price on SELL is same or lower than current price', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const executeSpy = jest.spyOn(portfolioStore, 'executeOrder');
    const onClose = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <OrderSheet visible symbol="RELIANCE" initialSide="SELL" onClose={onClose} />
        </ThemeProvider>
      );
    });

    // Switch to Target Price (Limit) order
    const limitTab = renderer.root.findByProps({ testID: 'order.sheet.mode.limit' });
    act(() => {
      limitTab.props.onPress();
    });

    // Target price lower than current LTP (2400 < 2500)
    const targetPriceInput = renderer.root.findByProps({ testID: 'order.sheet.targetPrice.input' });
    act(() => {
      targetPriceInput.props.onChangeText('2400');
    });

    const qtyInput = renderer.root.findByProps({ testID: 'order.sheet.qty.input' });
    act(() => {
      qtyInput.props.onChangeText('5');
    });

    const confirmBtn = renderer.root.findByProps({ testID: 'order.sheet.confirm.button' });
    act(() => {
      confirmBtn.props.onPress();
    });

    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'RELIANCE',
        side: 'SELL',
        qty: 5,
        type: 'LIMIT',
        status: 'EXECUTED',
        fillPaise: 260000, // Sold at better live market price (₹2,600.00), not entered limit of ₹2,400.00!
      })
    );

    // Displays instant success screen and price improvement banner
    expect(renderer.root.findByProps({ testID: 'order.sheet.screen.success' })).toBeDefined();
    expect(renderer.root.findByProps({ testID: 'order.sheet.priceImprovementNotice' })).toBeDefined();

    (Math.random as unknown as jest.Mock).mockRestore();
    executeSpy.mockRestore();
  });

  test('blocks order submission and displays market closed message when market is closed', () => {
    const onClose = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          <OrderSheet
            visible
            symbol="RELIANCE"
            initialSide="BUY"
            isMarketOpenOverride={false}
            onClose={onClose}
          />
        </ThemeProvider>
      );
    });

    const texts = getAllText(renderer.root).join(' ');
    expect(texts).toContain('Market is closed');

    const confirmBtn = renderer.root.findByProps({ testID: 'order.sheet.confirm.button' });
    expect(confirmBtn.props.disabled).toBe(true);
  });
});
