/**
 * Typed testID builders and constants for automated QA and E2E Maestro flows.
 *
 * Follows the convention: screen.element[.symbol]
 * Defined in testing_plan_and_qa_agent.md section 3.
 */
export const testIds = {
  portfolio: {
    screen: 'portfolio.screen',
    summary: {
      card: 'portfolio.summary.card',
      currentValue: 'portfolio.summary.currentValue',
      invested: 'portfolio.summary.invested',
      totalPnl: 'portfolio.summary.totalPnl',
      todayPnl: 'portfolio.summary.todayPnl',
      unpricedNote: 'portfolio.summary.unpricedNote',
    },
    search: 'portfolio.search',
    sort: {
      name: 'portfolio.sort.name',
      value: 'portfolio.sort.value',
      pnl: 'portfolio.sort.pnl',
    },
    row: (symbol: string) => `portfolio.row.${symbol}`,
    rowLtp: (symbol: string) => `portfolio.row.${symbol}.ltp`,
    rowPnl: (symbol: string) => `portfolio.row.${symbol}.pnl`,
    rowFlash: (symbol: string) => `portfolio.row.${symbol}.flash`,
    perfBadge: (symbol: string) => `perf.badge.${symbol}`,
  },
  watchlist: {
    screen: 'watchlist.screen',
    search: 'watchlist.search',
    addBtn: 'watchlist.add',
    row: (symbol: string) => `watchlist.row.${symbol}`,
    rowLtp: (symbol: string) => `watchlist.row.${symbol}.ltp`,
    modal: {
      sheet: 'watchlist.modal.sheet',
      input: 'watchlist.modal.input',
      item: (symbol: string) => `watchlist.modal.item.${symbol}`,
      close: 'watchlist.modal.close',
    },
  },
  detail: {
    screen: (symbol: string) => `detail.screen.${symbol}`,
    backBtn: 'detail.back',
    watchlistToggle: 'detail.watchlistToggle',
    ltp: 'detail.ltp',
    dayChange: 'detail.dayChange',
    chart: 'detail.chart',
    dayRange: 'detail.dayRange',
    stats: {
      grid: 'detail.stats.grid',
      open: 'detail.stat.open',
      prevClose: 'detail.stat.prevClose',
      high: 'detail.stat.high',
      low: 'detail.stat.low',
      volume: 'detail.stat.volume',
    },
    stat: {
      open: 'detail.stat.open',
      prevClose: 'detail.stat.prevClose',
      high: 'detail.stat.high',
      low: 'detail.stat.low',
      volume: 'detail.stat.volume',
    },
    position: 'detail.position',
    buyBtn: 'detail.buy',
    sellBtn: 'detail.sell',
  },
  order: {
    sheet: 'order.sheet',
    sidePillBuy: 'order.side.buy',
    sidePillSell: 'order.side.sell',
    qtyInput: 'order.qty',
    estTotal: 'order.estTotal',
    validationError: 'order.validationError',
    confirmBtn: 'order.confirm',
    cancelBtn: 'order.cancel',
    successToast: 'order.successToast',
  },
  banner: {
    paused: 'banner.paused',
  },
  state: {
    loading: 'state.loading',
    empty: 'state.empty',
    error: {
      view: 'state.error',
      retry: 'state.error.retry',
    },
    retryBtn: 'state.error.retry',
  },
  header: {
    themeToggle: 'theme.toggle.button',
    ordersBtn: 'orders.header.button',
    devMenuBtn: 'dev.header.button',
  },
} as const;
