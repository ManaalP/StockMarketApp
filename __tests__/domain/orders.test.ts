import {
  validateOrder,
  computeOrderPreview,
  validateTargetPrice,
  checkOrderTrigger,
  executePendingOrder,
  isOrderExpired,
  shouldExecuteImmediately,
} from '../../src/domain/orders';
import type { Holding, Order } from '../../src/domain/types';

describe('Domain: Order Validation & Previews (src/domain/orders.ts)', () => {
  describe('validateOrder', () => {
    test('validates positive whole number for BUY when priced', () => {
      const res = validateOrder('BUY', '10', 0, 250000, false);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeNull();
      expect(res.qty).toBe(10);
    });

    test('validates maximum allowed quantity (1,00,000)', () => {
      const res = validateOrder('BUY', '100000', 0, 250000, false);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeNull();
      expect(res.qty).toBe(100000);
    });

    test('rejects quantity exceeding 1,00,000 shares', () => {
      const res100001 = validateOrder('BUY', '100001', 0, 250000, false);
      expect(res100001.isValid).toBe(false);
      expect(res100001.error).toBe('Maximum quantity per order is 1,00,000');

      const res1e15 = validateOrder('BUY', '1000000000000000', 0, 250000, false);
      expect(res1e15.isValid).toBe(false);
      expect(res1e15.error).toBe('Maximum quantity per order is 1,00,000');

      const resUnsafe = validateOrder('BUY', '9007199254740993', 0, 250000, false);
      expect(resUnsafe.isValid).toBe(false);
      expect(resUnsafe.error).toBe('Maximum quantity per order is 1,00,000');
    });

    test('rejects leading zeros and whitespace-only inputs', () => {
      const res007 = validateOrder('BUY', '007', 0, 250000, false);
      expect(res007.isValid).toBe(false);
      expect(res007.error).toBe('Enter a whole number above 0');

      const resSpaces = validateOrder('BUY', '   ', 0, 250000, false);
      expect(resSpaces.isValid).toBe(false);
      expect(resSpaces.error).toBe('Enter a whole number above 0');
    });

    test('rejects orders when market is closed', () => {
      const res = validateOrder('BUY', '10', 0, 250000, false, false);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Market is closed');
    });

    test('rejects non-positive, fractional, and non-numeric inputs', () => {
      expect(validateOrder('BUY', '0', 0, 250000, false)).toEqual({
        isValid: false,
        error: 'Enter a whole number above 0',
        qty: 0,
      });

      expect(validateOrder('BUY', '-5', 0, 250000, false)).toEqual({
        isValid: false,
        error: 'Enter a whole number above 0',
        qty: 0,
      });

      expect(validateOrder('BUY', '2.5', 0, 250000, false)).toEqual({
        isValid: false,
        error: 'Enter a whole number above 0',
        qty: 0,
      });

      expect(validateOrder('BUY', 'abc', 0, 250000, false)).toEqual({
        isValid: false,
        error: 'Enter a whole number above 0',
        qty: 0,
      });
    });

    test('rejects SELL if user holds 0 shares', () => {
      const res = validateOrder('SELL', '5', 0, 250000, false);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('You do not hold shares');
    });

    test('rejects SELL if quantity exceeds held shares', () => {
      const res = validateOrder('SELL', '30', 25, 250000, false);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("You hold 25 shares. You can't sell 30.");
    });

    test('allows SELL when quantity is less than or equal to held shares', () => {
      const resPartial = validateOrder('SELL', '10', 25, 250000, false);
      expect(resPartial.isValid).toBe(true);
      expect(resPartial.error).toBeNull();
      expect(resPartial.qty).toBe(10);

      const resAll = validateOrder('SELL', '25', 25, 250000, false);
      expect(resAll.isValid).toBe(true);
      expect(resAll.error).toBeNull();
      expect(resAll.qty).toBe(25);
    });

    test('rejects order when price is null (unpriced)', () => {
      const res = validateOrder('BUY', '10', 0, null, false);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('price is unavailable');
    });

    test('rejects order when feed is paused', () => {
      const res = validateOrder('BUY', '10', 0, 250000, true);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Prices are paused');
    });
  });

  describe('computeOrderPreview', () => {
    test('computes estimated value and new average for BUY', () => {
      // Held: 10 @ ₹2,400.00 (240000). Buying: 10 @ ₹2,600.00 (260000).
      // Estimated total: 10 * 2600 = ₹26,000.00 (2600000)
      // New average: (10 * 2400 + 10 * 2600) / 20 = ₹2,500.00
      const preview = computeOrderPreview('BUY', 10, 10, 240000, 260000);
      expect(preview.estimatedTotalPaise).toBe(2600000);
      expect(preview.previewText).toContain('New average ₹2,500.00');
    });

    test('computes estimated value and new average when starting with 0 held shares', () => {
      // Buying 5 @ ₹1,000.00 (100000)
      const preview = computeOrderPreview('BUY', 5, 0, 0, 100000);
      expect(preview.estimatedTotalPaise).toBe(500000);
      expect(preview.previewText).toContain('New average ₹1,000.00');
    });

    test('computes preview for partial SELL', () => {
      // Held: 25. Selling: 10.
      const preview = computeOrderPreview('SELL', 10, 25, 240000, 260000);
      expect(preview.estimatedTotalPaise).toBe(2600000);
      expect(preview.previewText).toBe('25 shares → 15 shares left');
    });

    test('computes preview for SELL ALL (closing position)', () => {
      // Held: 25. Selling: 25.
      const preview = computeOrderPreview('SELL', 25, 25, 240000, 260000);
      expect(preview.estimatedTotalPaise).toBe(6500000);
      expect(preview.previewText).toBe('Position will be closed');
    });
  });

  describe('validateTargetPrice', () => {
    test('validates valid price in rupees and converts to whole paise', () => {
      const res = validateTargetPrice('2500.50');
      expect(res.isValid).toBe(true);
      expect(res.error).toBeNull();
      expect(res.targetPaise).toBe(250050);
    });

    test('rejects negative, 0, or invalid number strings', () => {
      expect(validateTargetPrice('0').isValid).toBe(false);
      expect(validateTargetPrice('-150').isValid).toBe(false);
      expect(validateTargetPrice('abc').isValid).toBe(false);
    });
  });

  describe('checkOrderTrigger', () => {
    test('triggers SELL LIMIT when live LTP meets or exceeds target price', () => {
      const order: Order = {
        id: 'ord-1',
        symbol: 'RELIANCE',
        side: 'SELL',
        type: 'LIMIT',
        qty: 5,
        fillPaise: 260000,
        targetPaise: 260000,
        status: 'PENDING',
        createdAt: 1000,
      };

      // Below target: does not trigger
      expect(checkOrderTrigger(order, 259000)).toBe(false);
      // Equal to target: triggers
      expect(checkOrderTrigger(order, 260000)).toBe(true);
      // Higher than target: triggers
      expect(checkOrderTrigger(order, 261000)).toBe(true);
    });

    test('triggers BUY LIMIT when live LTP meets or drops below target price', () => {
      const order: Order = {
        id: 'ord-2',
        symbol: 'TCS',
        side: 'BUY',
        type: 'LIMIT',
        qty: 10,
        fillPaise: 300000,
        targetPaise: 300000,
        status: 'PENDING',
        createdAt: 1000,
      };

      // Above target: does not trigger
      expect(checkOrderTrigger(order, 301000)).toBe(false);
      // Equal to target: triggers
      expect(checkOrderTrigger(order, 300000)).toBe(true);
      // Below target: triggers
      expect(checkOrderTrigger(order, 299000)).toBe(true);
    });

    test('returns false if order status is not PENDING or LTP is null', () => {
      const executedOrder: Order = {
        id: 'ord-3',
        symbol: 'INFY',
        side: 'SELL',
        type: 'LIMIT',
        qty: 5,
        fillPaise: 150000,
        targetPaise: 150000,
        status: 'EXECUTED',
        createdAt: 1000,
      };
      expect(checkOrderTrigger(executedOrder, 155000)).toBe(false);
      expect(checkOrderTrigger({ ...executedOrder, status: 'PENDING' }, null)).toBe(false);
    });
  });

  describe('executePendingOrder', () => {
    test('updates holdings and marks order EXECUTED with fill price and timestamp', () => {
      const holdings: Holding[] = [{ symbol: 'RELIANCE', qty: 15, avgPaise: 240000 }];
      const pendingOrder: Order = {
        id: 'ord-10',
        symbol: 'RELIANCE',
        side: 'SELL',
        type: 'LIMIT',
        qty: 5,
        fillPaise: 260000,
        targetPaise: 260000,
        status: 'PENDING',
        createdAt: 1000,
      };

      const result = executePendingOrder(holdings, pendingOrder, 261500, 2000);
      expect(result.holdings).toHaveLength(1);
      expect(result.holdings[0]?.qty).toBe(10);
      expect(result.order.status).toBe('EXECUTED');
      expect(result.order.fillPaise).toBe(261500);
      expect(result.order.executedAt).toBe(2000);
    });
  });

  describe('isOrderExpired & shouldExecuteImmediately', () => {
    test('isOrderExpired returns true when pending order passes ORDER_TIMEOUT_MS', () => {
      const order: Order = {
        id: 'ord-exp',
        symbol: 'TCS',
        side: 'BUY',
        type: 'LIMIT',
        qty: 10,
        fillPaise: 300000,
        status: 'PENDING',
        createdAt: 1000,
      };
      expect(isOrderExpired(order, 1000 + 10 * 60 * 1000 + 1)).toBe(true);
      expect(isOrderExpired(order, 1000 + 5 * 60 * 1000)).toBe(false);
      expect(isOrderExpired({ ...order, status: 'EXECUTED' }, 1000 + 20 * 60 * 1000)).toBe(false);
    });

    test('shouldExecuteImmediately evaluates immediate trigger thresholds correctly', () => {
      // SELL: target <= currentLtp triggers immediately
      expect(shouldExecuteImmediately('SELL', 250000, 260000)).toBe(true);
      expect(shouldExecuteImmediately('SELL', 270000, 260000)).toBe(false);

      // BUY: target >= currentLtp triggers immediately
      expect(shouldExecuteImmediately('BUY', 270000, 260000)).toBe(true);
      expect(shouldExecuteImmediately('BUY', 250000, 260000)).toBe(false);
    });
  });
});
