import { validateOrder, computeOrderPreview } from '../../src/domain/orders';

describe('Domain: Order Validation & Previews (src/domain/orders.ts)', () => {
  describe('validateOrder', () => {
    test('validates positive whole number for BUY when priced', () => {
      const res = validateOrder('BUY', '10', 0, 250000, false);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeNull();
      expect(res.qty).toBe(10);
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
});
