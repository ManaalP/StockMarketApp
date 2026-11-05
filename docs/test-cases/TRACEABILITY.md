# Requirements Traceability Matrix (RTM)

This matrix maps every core and stretch specification requirement to its test case IDs, automated implementation files, and verification layer.

---

## 1. Specification Mapping

| Spec Requirement | Area ID | Test Case IDs | Test Layer | Automated Test Suite |
| :--- | :--- | :--- | :--- | :--- |
| **Money integer Paise domain (no floats)** | `MON` | `MON-001` .. `MON-005` | Unit + Property | `__tests__/domain/money_and_format.test.ts`, `__tests__/domain/propertyInvariants.test.ts` |
| **Custom Indian Numbering (`formatINR`)** | `FMT` | `FMT-001` .. `FMT-004` | Unit + Property | `__tests__/domain/money_and_format.test.ts`, `__tests__/domain/propertyInvariants.test.ts` |
| **P&L and summary arithmetic** | `CALC` | `CALC-001` .. `CALC-006` | Unit + Property | `__tests__/domain/domain_calcs.test.ts`, `__tests__/domain/propertyInvariants.test.ts` |
| **Missing price is null / renders `--`** | `CALC`, `PORT`, `DET` | `CALC-004`, `PORT-003`, `DET-002` | Unit + Component | `__tests__/components/HoldingRow.test.tsx`, `__tests__/components/WatchRow.test.tsx` |
| **Summary totals equal sum of rounded rows** | `SUM`, `CALC` | `SUM-001`, `CALC-005` | Unit + Integration | `__tests__/domain/propertyInvariants.test.ts`, `__tests__/stores/summaryStore.test.ts` |
| **Unpriced stock (`OLDCO`) excluded from totals** | `SUM` | `SUM-002` | Unit + Component | `__tests__/components/SummaryCard.test.tsx`, `__tests__/domain/propertyInvariants.test.ts` |
| **Local Buy/Sell order execution & validation** | `ORD`, `SHEET` | `ORD-001` .. `ORD-006`, `SHEET-001` .. `SHEET-004` | Unit + Component | `__tests__/domain/orders.test.ts`, `__tests__/components/OrderSheet.test.tsx` |
| **Single initial OHLC REST fetch (no polling)** | `API` | `API-001` .. `API-005` | Unit + Integration | `__tests__/api/ohlcClient.test.ts`, `__tests__/stores/portfolioStore.test.ts` |
| **Configurable API modes (mock, fail, etc.)** | `API` | `API-006` .. `API-010` | Unit | `__tests__/api/ohlcClient.test.ts` |
| **Simulated market feed (~20 Hz ticks)** | `FEED` | `FEED-001` .. `FEED-004` | Unit + Integration | `__tests__/feed/SimulatedFeed.test.ts` |
| **Deterministic simulator (`QA_SEED`)** | `FEED` | `FEED-005`, `FEED-006` | Unit | `__tests__/feed/SimulatedFeed.test.ts` |
| **Late ticks ignored (`seq <= lastSeq`)** | `FEED`, `STORE` | `FEED-003`, `STORE-002` | Unit + Property | `__tests__/domain/tickMerge.test.ts`, `__tests__/domain/propertyInvariants.test.ts` |
| **PriceStore batched flush (~100 ms)** | `STORE` | `STORE-001`, `STORE-004` | Integration | `__tests__/stores/priceStore.test.ts` |
| **Render isolation (1 tick = 1 row rerender)** | `PERF` | `PERF-001` .. `PERF-003` | Component + Profile | `__tests__/perf/isolatedRowRerender.test.tsx` |
| **Throttled summary selector (~4 Hz)** | `SUM`, `PERF` | `SUM-003`, `PERF-002` | Integration | `__tests__/stores/summaryStore.test.ts`, `__tests__/stores/useSummary.test.tsx` |
| **Portfolio sorting debounced (no row jumping)** | `PORT` | `PORT-004` | Component | `__tests__/screens/PortfolioScreen.test.tsx` |
| **Watchlist persistence with AsyncStorage** | `WL`, `PERS` | `WL-001` .. `WL-004`, `PERS-001` | Integration + Component | `__tests__/stores/watchlistStore.test.ts`, `__tests__/screens/WatchlistScreen.test.tsx` |
| **Stock detail header, stats grid, day range** | `DET` | `DET-001` .. `DET-004` | Component | `__tests__/components/StockStatsGrid.test.tsx`, `__tests__/components/DayRangeBar.test.tsx` |
| **Live SVG tick chart & touch scrubbing** | `DET` | `DET-005`, `DET-006` | Component | `__tests__/components/LiveLineChart.test.tsx` |
| **User position card on detail screen** | `DET` | `DET-007` | Component | `__tests__/components/PositionCard.test.tsx` |
| **Clean state views (loading, empty, error, retry)** | `STATE` | `STATE-001` .. `STATE-004` | Component | `__tests__/components/primitives.test.tsx`, `__tests__/polish/statesAndAccessibility.test.tsx` |
| **Feed pause detection (> 2s stall alert banner)** | `STATE`, `FEED` | `STATE-005`, `FEED-004` | Component + Integration | `__tests__/stores/priceStore.test.ts`, `__tests__/polish/statesAndAccessibility.test.tsx` |
| **Light & Dark mode semantic theme toggle** | `THEME` | `THEME-001` .. `THEME-003` | Unit + Component | `__tests__/theme/theme.test.ts`, `__tests__/polish/statesAndAccessibility.test.tsx` |
| **Accessibility (WCAG 2.1 AA cues & labels)** | `A11Y` | `A11Y-001` .. `A11Y-004` | Component | `__tests__/polish/statesAndAccessibility.test.tsx` |
| **Safe area context & root SafeAreaProvider** | `LIFE` | `LIFE-001` | Integration | `__tests__/polish/statesAndAccessibility.test.tsx` |
| **Stretch: UI-thread price flash animation** | `PERF` | `PERF-004` | Component | `__tests__/components/PriceFlash.test.tsx` |
| **Stretch: Resilient reconnect & backoff** | `FEED` | `FEED-007`, `FEED-008` | Unit + Integration | `__tests__/domain/backoff.test.ts`, `__tests__/feed/resilientFeed.test.ts` |
| **Stretch: Persisted order history ledger** | `ORD`, `PERS` | `ORD-007`, `PERS-002` | Integration + Component | `__tests__/stores/orderStore.test.ts`, `__tests__/screens/OrderHistoryScreen.test.tsx` |
| **Stretch: Developer controls & tick rate** | `FEED` | `FEED-009` | Component | `__tests__/screens/DevMenuScreen.test.tsx` |

---

## 2. Fast-Check Invariants Traceability

- **Invariant 1**: Summary totals equal sum of priced rounded rows (`__tests__/domain/propertyInvariants.test.ts:16`)
- **Invariant 2**: Holdings retain positive integers and finite numbers (`__tests__/domain/propertyInvariants.test.ts:79`)
- **Invariant 3**: Average price is preserved on SELL and weighted exact on BUY (`__tests__/domain/propertyInvariants.test.ts:119`)
- **Invariant 4**: Unpriced holdings never alter summary currentValue or PnL (`__tests__/domain/propertyInvariants.test.ts:168`)
- **Invariant 5**: Ticks with seq <= lastSeq are strict no-ops (`__tests__/domain/propertyInvariants.test.ts:200`)
- **Invariant 6**: High is always >= ltp and low <= ltp after merge (`__tests__/domain/propertyInvariants.test.ts:233`)
- **Invariant 7**: formatINR produces deterministic rupee and paisa formatting without Intl (`__tests__/domain/propertyInvariants.test.ts:266`)
