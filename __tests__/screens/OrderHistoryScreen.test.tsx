import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { OrderHistoryScreen } from '../../src/screens/OrderHistoryScreen';
import { ThemeProvider } from '../../src/theme/useTheme';
import { orderStore } from '../../src/stores/orderStore';
import { portfolioStore } from '../../src/stores/portfolioStore';
import { priceStore } from '../../src/stores/priceStore';
import { toPaise } from '../../src/domain/money';

describe('OrderHistoryScreen', () => {
  beforeEach(async () => {
    await act(async () => {
      await orderStore.clearOrders();
    });
  });

  afterEach(async () => {
    await act(async () => {
      await orderStore.clearOrders();
    });
  });

  it('renders empty state when order history is empty', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <OrderHistoryScreen />
        </ThemeProvider>
      );
    });

    expect(tree).toBeDefined();
    const emptyView = tree!.root.findByProps({ testID: 'order.history.empty' });
    expect(emptyView).toBeDefined();

    const texts = tree!.root.findAllByType(Text).map((t) => t.props.children);
    expect(texts.some((txt) => typeof txt === 'string' && txt.includes('No Orders Yet'))).toBe(true);
    expect(texts.some((txt) => typeof txt === 'string' && txt.includes('Order History'))).toBe(true);
  });

  it('renders executed orders when present in store', async () => {
    await act(async () => {
      await orderStore.recordOrder(
        {
          symbol: 'RELIANCE',
          side: 'BUY',
          qty: 25,
          fillPaise: toPaise(2500),
        },
        'ord-test-1',
        new Date(2026, 10, 5, 14, 30).getTime()
      );
    });

    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <OrderHistoryScreen />
        </ThemeProvider>
      );
    });

    const row = tree!.root.findByProps({ testID: 'order.row.ord-test-1' });
    expect(row).toBeDefined();

    const texts = row.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toContain('RELIANCE');
    expect(texts).toContain('BUY');
    expect(texts.some((txt) => typeof txt === 'string' && txt.includes('25 shares @ ₹2,500.00'))).toBe(true);
  });

  it('renders buying price, live tick value, and profit/loss pill based on ticks', async () => {
    // Seed priceStore with a live tick higher than the buy price of ₹2,500.00
    act(() => {
      priceStore.seed({
        RELIANCE: {
          ltp: toPaise(2600), // ₹2,600.00 (up by ₹100/share -> profit)
          open: toPaise(2500),
          prevClose: toPaise(2500),
          high: toPaise(2650),
          low: toPaise(2480),
          volume: 50000,
        },
      });
    });

    await act(async () => {
      await orderStore.recordOrder(
        {
          symbol: 'RELIANCE',
          side: 'BUY',
          qty: 10,
          fillPaise: toPaise(2500),
        },
        'ord-pnl-test'
      );
    });

    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <OrderHistoryScreen />
        </ThemeProvider>
      );
    });

    const pnlNode = tree!.root.findByProps({ testID: 'order.pnl.ord-pnl-test' });
    expect(pnlNode).toBeDefined();
    // 10 shares * (2600 - 2500) = +₹1,000.00 (+4.00%)
    expect(pnlNode.props.children).toBe('+₹1,000.00 (+4.00%)');
  });

  it('calls onBack callback when back button is pressed', () => {
    const onBack = jest.fn();
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <OrderHistoryScreen onBack={onBack} />
        </ThemeProvider>
      );
    });

    const backBtn = tree!.root.findByProps({ testID: 'order.history.back' });
    act(() => {
      backBtn.props.onPress();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('clears orders when clear button is pressed', async () => {
    await act(async () => {
      await orderStore.recordOrder(
        {
          symbol: 'TCS',
          side: 'SELL',
          qty: 10,
          fillPaise: toPaise(3500),
        },
        'ord-test-2'
      );
    });

    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <OrderHistoryScreen />
        </ThemeProvider>
      );
    });

    const clearBtn = tree!.root.findByProps({ testID: 'order.history.clear' });
    await act(async () => {
      clearBtn.props.onPress();
    });

    expect(tree!.root.findByProps({ testID: 'order.history.empty' })).toBeDefined();
  });

  it('renders IN PROGRESS badge for pending orders and refreshes pending orders on refresh button press', async () => {
    const evalSpy = jest.spyOn(portfolioStore, 'evaluatePendingOrders').mockResolvedValue(0);

    await act(async () => {
      await orderStore.recordOrder(
        {
          symbol: 'INFY',
          side: 'SELL',
          qty: 15,
          fillPaise: toPaise(1800),
          targetPaise: toPaise(1800),
          type: 'LIMIT',
          status: 'PENDING',
        },
        'ord-test-pending'
      );
    });

    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <OrderHistoryScreen />
        </ThemeProvider>
      );
    });

    const pendingRow = tree!.root.findByProps({ testID: 'order.row.ord-test-pending' });
    expect(pendingRow).toBeDefined();

    const texts = pendingRow.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toContain('IN PROGRESS');
    expect(texts.some((txt) => typeof txt === 'string' && txt.includes('Target ₹1,800.00'))).toBe(true);

    // Press header refresh button
    const refreshBtn = tree!.root.findByProps({ testID: 'order.history.refresh' });
    await act(async () => {
      refreshBtn.props.onPress();
    });

    expect(evalSpy).toHaveBeenCalled();
    evalSpy.mockRestore();
  });
});
