import { parseHoldingsCsv } from '../../src/data/holdingsParser';
import { STARTING_HOLDINGS_CSV } from '../../src/data/rawHoldings';
import { mulQty, addPaise, type Paise } from '../../src/domain/money';

describe('Holdings CSV Parser (src/data/holdingsParser.ts)', () => {
  const sampleCsv = `symbol,qty,avgPrice
RELIANCE,25,1319.59
TCS,40,2589.71
OLDCO,30,412.5`;

  test('parses CSV rows into typed Holding array with integer Paise', () => {
    const holdings = parseHoldingsCsv(sampleCsv);

    expect(holdings).toHaveLength(3);
    expect(holdings[0]).toEqual({
      symbol: 'RELIANCE',
      qty: 25,
      avgPaise: 131959,
    });
    expect(holdings[1]).toEqual({
      symbol: 'TCS',
      qty: 40,
      avgPaise: 258971,
    });
    expect(holdings[2]).toEqual({
      symbol: 'OLDCO',
      qty: 30,
      avgPaise: 41250,
    });
  });

  test('verifies exact values from starting holdings.csv against test oracle', () => {
    const holdings = parseHoldingsCsv(STARTING_HOLDINGS_CSV);

    // Exact count: 21 holdings
    expect(holdings).toHaveLength(21);

    // Spot check key holdings
    const reliance = holdings.find((h) => h.symbol === 'RELIANCE');
    expect(reliance).toBeDefined();
    expect(reliance?.qty).toBe(25);
    expect(reliance?.avgPaise).toBe(131959);
    expect(mulQty(reliance!.avgPaise, reliance!.qty)).toBe(3298975); // ₹32,989.75

    const oldco = holdings.find((h) => h.symbol === 'OLDCO');
    expect(oldco).toBeDefined();
    expect(oldco?.qty).toBe(30);
    expect(oldco?.avgPaise).toBe(41250);
    expect(mulQty(oldco!.avgPaise, oldco!.qty)).toBe(1237500); // ₹12,375.00 (oracle)

    // Compute total invested across all 21 holdings
    let totalInvested: Paise = 0 as Paise;
    let pricedInvested: Paise = 0 as Paise;

    for (const h of holdings) {
      const invested = mulQty(h.avgPaise, h.qty);
      totalInvested = addPaise(totalInvested, invested);
      if (h.symbol !== 'OLDCO') {
        pricedInvested = addPaise(pricedInvested, invested);
      }
    }

    // Oracle match from docs/api_and_data_reference.md:
    // Total invested, all 21: ₹20,00,476.03 => 200047603 paise
    expect(totalInvested).toBe(200047603);

    // Total invested, 20 priced: ₹19,88,101.03 => 198810103 paise
    expect(pricedInvested).toBe(198810103);
  });

  test('throws on missing header or empty content', () => {
    expect(() => parseHoldingsCsv('')).toThrow();
    expect(() => parseHoldingsCsv('foo,bar\nA,1')).toThrow();
  });

  test('ignores trailing empty lines and extra whitespace', () => {
    const csvWithSpaces = `symbol,qty,avgPrice
  INFY  ,  10  ,  1114.70  

`;
    const holdings = parseHoldingsCsv(csvWithSpaces);
    expect(holdings).toHaveLength(1);
    expect(holdings[0]?.symbol).toBe('INFY');
    expect(holdings[0]?.qty).toBe(10);
    expect(holdings[0]?.avgPaise).toBe(111470);
  });
});
