import { mergeTick, type QuoteWithSeq, type QuotesState } from '../../src/domain/tickMerge';
import { toPaise } from '../../src/domain/money';
import type { Tick } from '../../src/feed/types';

describe('mergeTick pure function', () => {
  const baseQuote: QuoteWithSeq = {
    seq: 10,
    ltp: toPaise(100), // 10000 paise
    open: toPaise(98),  // 9800 paise
    high: toPaise(102), // 10200 paise
    low: toPaise(97),   // 9700 paise
    prevClose: toPaise(99), // 9900 paise
    volume: 50000,
  };

  const initialState: QuotesState = {
    RELIANCE: { ...baseQuote },
    TCS: {
      seq: 5,
      ltp: toPaise(3500),
      open: toPaise(3480),
      high: toPaise(3520),
      low: toPaise(3470),
      prevClose: toPaise(3490),
      volume: 12000,
    },
  };

  test('drops late ticks where seq < current seq and returns the exact same state reference', () => {
    const lateTick: Tick = {
      symbol: 'RELIANCE',
      seq: 9, // older than 10
      ltp: toPaise(105),
    };

    const nextState = mergeTick(initialState, lateTick);
    expect(nextState).toBe(initialState);
    expect(nextState.RELIANCE?.ltp).toBe(toPaise(100));
  });

  test('drops duplicate ticks where seq === current seq and returns exact same reference', () => {
    const dupTick: Tick = {
      symbol: 'RELIANCE',
      seq: 10, // equal to current seq
      ltp: toPaise(105),
    };

    const nextState = mergeTick(initialState, dupTick);
    expect(nextState).toBe(initialState);
  });

  test('updates ltp, seq, and returns a new state object for higher seq', () => {
    const validTick: Tick = {
      symbol: 'RELIANCE',
      seq: 11,
      ltp: toPaise(101),
    };

    const nextState = mergeTick(initialState, validTick);
    expect(nextState).not.toBe(initialState);
    expect(nextState.RELIANCE).toBeDefined();
    expect(nextState.RELIANCE?.seq).toBe(11);
    expect(nextState.RELIANCE?.ltp).toBe(toPaise(101));
    // High and low remained within range
    expect(nextState.RELIANCE?.high).toBe(toPaise(102));
    expect(nextState.RELIANCE?.low).toBe(toPaise(97));
    // TCS untouched with exact same object reference
    expect(nextState.TCS).toBe(initialState.TCS);
  });

  test('widens high and never shrinks it when ltp exceeds current high', () => {
    const highBreakoutTick: Tick = {
      symbol: 'RELIANCE',
      seq: 12,
      ltp: toPaise(103), // higher than current high of 102
    };

    const nextState = mergeTick(initialState, highBreakoutTick);
    expect(nextState.RELIANCE?.high).toBe(toPaise(103));
    expect(nextState.RELIANCE?.ltp).toBe(toPaise(103));
  });

  test('widens high when tick.high is higher than current high', () => {
    const tickWithHigherHigh: Tick = {
      symbol: 'RELIANCE',
      seq: 12,
      ltp: toPaise(101),
      high: toPaise(104),
    };

    const nextState = mergeTick(initialState, tickWithHigherHigh);
    expect(nextState.RELIANCE?.high).toBe(toPaise(104));
    expect(nextState.RELIANCE?.ltp).toBe(toPaise(101));
  });

  test('never shrinks high even if tick.high is reported lower', () => {
    const invalidShrunkHighTick: Tick = {
      symbol: 'RELIANCE',
      seq: 12,
      ltp: toPaise(100),
      high: toPaise(101), // lower than current high 102
    };

    const nextState = mergeTick(initialState, invalidShrunkHighTick);
    expect(nextState.RELIANCE?.high).toBe(toPaise(102));
  });

  test('widens low and never shrinks it when ltp drops below current low', () => {
    const lowBreakoutTick: Tick = {
      symbol: 'RELIANCE',
      seq: 12,
      ltp: toPaise(96), // lower than current low of 97
    };

    const nextState = mergeTick(initialState, lowBreakoutTick);
    expect(nextState.RELIANCE?.low).toBe(toPaise(96));
    expect(nextState.RELIANCE?.ltp).toBe(toPaise(96));
  });

  test('widens low when tick.low is lower than current low', () => {
    const tickWithLowerLow: Tick = {
      symbol: 'RELIANCE',
      seq: 12,
      ltp: toPaise(99),
      low: toPaise(95),
    };

    const nextState = mergeTick(initialState, tickWithLowerLow);
    expect(nextState.RELIANCE?.low).toBe(toPaise(95));
  });

  test('never shrinks low even if tick.low is reported higher', () => {
    const invalidShrunkLowTick: Tick = {
      symbol: 'RELIANCE',
      seq: 12,
      ltp: toPaise(100),
      low: toPaise(98), // higher than current low 97
    };

    const nextState = mergeTick(initialState, invalidShrunkLowTick);
    expect(nextState.RELIANCE?.low).toBe(toPaise(97));
  });

  test('updates volume and never allows volume to decrease', () => {
    const higherVolTick: Tick = {
      symbol: 'RELIANCE',
      seq: 12,
      volume: 60000,
    };
    const nextState1 = mergeTick(initialState, higherVolTick);
    expect(nextState1.RELIANCE?.volume).toBe(60000);

    const lowerVolTick: Tick = {
      symbol: 'RELIANCE',
      seq: 13,
      volume: 40000,
    };
    const nextState2 = mergeTick(nextState1, lowerVolTick);
    expect(nextState2.RELIANCE?.volume).toBe(60000); // kept at 60000
  });

  test('creates new quote entry for a symbol not yet in state', () => {
    const newSymbolTick: Tick = {
      symbol: 'INFY',
      seq: 1,
      ltp: toPaise(1800),
      volume: 5000,
    };

    const nextState = mergeTick(initialState, newSymbolTick);
    expect(nextState.INFY).toBeDefined();
    expect(nextState.INFY?.ltp).toBe(toPaise(1800));
    expect(nextState.INFY?.open).toBe(toPaise(1800));
    expect(nextState.INFY?.high).toBe(toPaise(1800));
    expect(nextState.INFY?.low).toBe(toPaise(1800));
    expect(nextState.INFY?.prevClose).toBe(toPaise(1800));
    expect(nextState.INFY?.volume).toBe(5000);
    expect(nextState.INFY?.seq).toBe(1);
  });

  test('returns same state reference if tick payload contains no changes', () => {
    const emptyTick: Tick = {
      symbol: 'RELIANCE',
      seq: 15,
    };

    const nextState = mergeTick(initialState, emptyTick);
    expect(nextState).toBe(initialState);
  });
});
