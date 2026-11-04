import {
  toPaise,
  mulQty,
  addPaise,
  subPaise,
  safePercent,
  type Paise,
} from '@/domain/money';
import {
  formatINR,
  formatSigned,
  formatPercent,
  formatVolume,
} from '@/domain/format';

describe('Domain: Money Primitives (src/domain/money.ts)', () => {
  describe('toPaise', () => {
    it('converts 0 rupees to 0 paise', () => {
      expect(toPaise(0)).toBe(0);
    });

    it('converts whole rupees to integer paise', () => {
      expect(toPaise(1)).toBe(100);
      expect(toPaise(999)).toBe(99900);
      expect(toPaise(1000)).toBe(100000);
      expect(toPaise(100000)).toBe(10000000); // 1 Lakh
      expect(toPaise(1234567.89)).toBe(123456789);
    });

    it('handles negative rupees', () => {
      expect(toPaise(-1234.5)).toBe(-123450);
      expect(toPaise(-0.01)).toBe(-1);
    });

    it('handles floating point rounding edge cases (0.005, 1.005)', () => {
      // 0.005 in IEEE-754 is 0.0050000000000000001... * 100 = 0.5000000000000001 => rounds to 1
      expect(toPaise(0.005)).toBe(1);
      // 1.005 in IEEE-754 is 1.00499999999999989... * 100 = 100.49999999999999 => Math.round(x * 100) rounds to 100
      // This is the classic IEEE-754 floating point pitfall demonstrating why money must be integer paise.
      expect(toPaise(1.005)).toBe(100);
      expect(toPaise(1.0051)).toBe(101);
      expect(toPaise(1.004)).toBe(100);
    });
  });

  describe('mulQty', () => {
    it('multiplies integer paise by quantity', () => {
      const price: Paise = 245050; // ₹2,450.50
      expect(mulQty(price, 10)).toBe(2450500); // ₹24,505.00
      expect(mulQty(price, 0)).toBe(0);
      expect(mulQty(price, 1)).toBe(245050);
    });

    it('ensures result is strictly an integer even if quantity is float', () => {
      const price: Paise = 100;
      expect(mulQty(price, 1.5)).toBe(150);
    });
  });

  describe('addPaise and subPaise', () => {
    it('adds multiple paise values exactly', () => {
      expect(addPaise()).toBe(0);
      expect(addPaise(100, 250, 50)).toBe(400);
      expect(addPaise(123456789, -56789)).toBe(123400000);
    });

    it('subtracts paise correctly', () => {
      expect(subPaise(500, 300)).toBe(200);
      expect(subPaise(100, 300)).toBe(-200);
    });
  });

  describe('safePercent', () => {
    it('returns null if investedPaise is 0 or null', () => {
      expect(safePercent(100, 0)).toBeNull();
    });

    it('computes exact percentage rounded to 2 decimals', () => {
      // ₹12.34 gain on ₹1,000.00 invested = +1.23%
      expect(safePercent(1234, 100000)).toBe(1.23);
      // ₹0.45 loss on ₹100.00 invested = -0.45%
      expect(safePercent(-45, 10000)).toBe(-0.45);
      // Zero PnL on positive invested = 0.00
      expect(safePercent(0, 50000)).toBe(0);
    });

    it('rounds percentage using integer math correctly', () => {
      // 1 / 3 = 0.3333...% => 0.33%
      expect(safePercent(1, 300)).toBe(0.33);
      // 2 / 3 = 0.6666...% => 0.67%
      expect(safePercent(2, 300)).toBe(0.67);
    });
  });
});

describe('Domain: Indian Number Formatting (src/domain/format.ts)', () => {
  describe('formatINR', () => {
    it('returns "--" for null', () => {
      expect(formatINR(null)).toBe('--');
    });

    it('formats 0 paise', () => {
      expect(formatINR(0)).toBe('₹0.00');
    });

    it('formats small paise values (< 1 rupee)', () => {
      expect(formatINR(1)).toBe('₹0.01');
      expect(formatINR(5)).toBe('₹0.05');
      expect(formatINR(50)).toBe('₹0.50');
      expect(formatINR(99)).toBe('₹0.99');
    });

    it('formats values under 1000 rupees (no comma needed in integer part)', () => {
      expect(formatINR(100)).toBe('₹1.00');
      expect(formatINR(99900)).toBe('₹999.00');
      expect(formatINR(99999)).toBe('₹999.99');
    });

    it('formats 1,000 rupees', () => {
      expect(formatINR(100000)).toBe('₹1,000.00');
      expect(formatINR(123450)).toBe('₹1,234.50');
    });

    it('formats 1,00,000 rupees (1 Lakh) with 2,2,3 grouping', () => {
      expect(formatINR(10000000)).toBe('₹1,00,000.00');
      expect(formatINR(10000050)).toBe('₹1,00,000.50');
    });

    it('formats 12,34,567.89 rupees', () => {
      expect(formatINR(123456789)).toBe('₹12,34,567.89');
    });

    it('formats 1 Crore (1,00,00,000.00)', () => {
      expect(formatINR(1000000000)).toBe('₹1,00,00,000.00');
    });

    it('formats negative amounts with minus sign before currency symbol', () => {
      expect(formatINR(-123450)).toBe('-₹1,234.50');
      expect(formatINR(-50)).toBe('-₹0.50');
      expect(formatINR(-123456789)).toBe('-₹12,34,567.89');
    });
  });

  describe('formatSigned', () => {
    it('returns "--" for null', () => {
      expect(formatSigned(null)).toBe('--');
    });

    it('prefixes positive amounts with "+₹"', () => {
      expect(formatSigned(123450)).toBe('+₹1,234.50');
      expect(formatSigned(1)).toBe('+₹0.01');
    });

    it('prefixes negative amounts with "-₹"', () => {
      expect(formatSigned(-123450)).toBe('-₹1,234.50');
      expect(formatSigned(-1)).toBe('-₹0.01');
    });

    it('formats zero as neutral "₹0.00"', () => {
      expect(formatSigned(0)).toBe('₹0.00');
    });
  });

  describe('formatPercent', () => {
    it('returns "--" for null', () => {
      expect(formatPercent(null)).toBe('--');
    });

    it('prefixes positive percentage with "+"', () => {
      expect(formatPercent(1.23)).toBe('+1.23%');
      expect(formatPercent(0.01)).toBe('+0.01%');
    });

    it('prefixes negative percentage with "-"', () => {
      expect(formatPercent(-0.45)).toBe('-0.45%');
      expect(formatPercent(-10.5)).toBe('-10.50%');
    });

    it('formats zero as "0.00%" without sign', () => {
      expect(formatPercent(0)).toBe('0.00%');
      expect(formatPercent(-0)).toBe('0.00%');
    });
  });

  describe('formatVolume', () => {
    it('returns "--" for null', () => {
      expect(formatVolume(null)).toBe('--');
    });

    it('formats 0 volume', () => {
      expect(formatVolume(0)).toBe('0');
    });

    it('formats small volume without commas (< 1000)', () => {
      expect(formatVolume(999)).toBe('999');
    });

    it('formats volume with Indian commas (1,47,53,650)', () => {
      expect(formatVolume(1000)).toBe('1,000');
      expect(formatVolume(100000)).toBe('1,00,000');
      expect(formatVolume(14753650)).toBe('1,47,53,650');
    });

    it('handles negative volume defensively', () => {
      expect(formatVolume(-5000)).toBe('-5,000');
    });
  });
});
