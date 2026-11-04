import type { Holding } from '../domain/types';
import { toPaise } from '../domain/money';

/**
 * Pure function parsing a CSV string of stock holdings into a typed Holding array.
 * Converts average price floats into integer Paise strictly at this input boundary.
 */
export function parseHoldingsCsv(csvText: string): Holding[] {
  if (!csvText || typeof csvText !== 'string') {
    throw new Error('Holdings CSV content must be a non-empty string');
  }

  const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length < 2) {
    throw new Error('Holdings CSV must contain at least a header row and one data row');
  }

  const header = lines[0]?.toLowerCase().replace(/\s+/g, '');
  if (header !== 'symbol,qty,avgprice') {
    throw new Error(`Invalid CSV header: expected 'symbol,qty,avgPrice', got '${lines[0]}'`);
  }

  const holdings: Holding[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const parts = line.split(',').map((p) => p.trim());
    if (parts.length < 3) {
      throw new Error(`Invalid row format at line ${i + 1}: '${line}'`);
    }

    const symbol = parts[0]?.toUpperCase();
    const qtyStr = parts[1];
    const avgPriceStr = parts[2];

    if (!symbol || symbol.length === 0) {
      throw new Error(`Missing symbol at line ${i + 1}`);
    }

    const qty = Number(qtyStr);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error(`Invalid quantity '${qtyStr}' at line ${i + 1}; must be a positive integer`);
    }

    const avgPriceFloat = Number(avgPriceStr);
    if (!Number.isFinite(avgPriceFloat) || avgPriceFloat <= 0) {
      throw new Error(`Invalid avgPrice '${avgPriceStr}' at line ${i + 1}; must be a positive number`);
    }

    holdings.push({
      symbol,
      qty,
      avgPaise: toPaise(avgPriceFloat),
    });
  }

  return holdings;
}
