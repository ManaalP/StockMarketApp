import { testIds } from '../../src/testing/ids';

describe('Test ID Builders and Conventions (src/testing/ids.ts)', () => {
  test('generates valid structured testIDs conforming to screen.element[.symbol]', () => {
    expect(testIds.portfolio.summary.card).toBe('portfolio.summary.card');
    expect(testIds.portfolio.summary.currentValue).toBe('portfolio.summary.currentValue');
    expect(testIds.portfolio.row('RELIANCE')).toBe('portfolio.row.RELIANCE');
    expect(testIds.portfolio.rowLtp('RELIANCE')).toBe('portfolio.row.RELIANCE.ltp');
    expect(testIds.portfolio.rowPnl('RELIANCE')).toBe('portfolio.row.RELIANCE.pnl');

    expect(testIds.watchlist.addBtn).toBe('watchlist.add');
    expect(testIds.watchlist.row('TCS')).toBe('watchlist.row.TCS');

    expect(testIds.detail.stat.open).toBe('detail.stat.open');
    expect(testIds.detail.stat.high).toBe('detail.stat.high');
    expect(testIds.detail.buyBtn).toBe('detail.buy');
    expect(testIds.detail.sellBtn).toBe('detail.sell');

    expect(testIds.order.qtyInput).toBe('order.qty');
    expect(testIds.order.confirmBtn).toBe('order.confirm');

    expect(testIds.banner.paused).toBe('banner.paused');
    expect(testIds.state.error.retry).toBe('state.error.retry');
    expect(testIds.state.retryBtn).toBe('state.error.retry');
  });
});
