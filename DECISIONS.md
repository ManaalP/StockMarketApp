# Architecture Decisions Record (ADR)

This file tracks non-obvious technical decisions, architecture trade-offs, and rationale for the Live Portfolio application.

---

### ADR 001: Strict TypeScript and `noUncheckedIndexedAccess`
- **Context**: The app consumes live feeds (~20 ticks/s) updating an arbitrary set of 25 symbols. Accessing symbol maps (`quotes[symbol]`) or arrays without bounds-checking risks runtime exceptions under Hermes.
- **Decision**: Enforce `"strict": true` and `"noUncheckedIndexedAccess": true` in `tsconfig.json`. Enforce `@typescript-eslint/no-explicit-any: "error"` and `@typescript-eslint/ban-ts-comment: "error"` in ESLint.
- **Trade-off**: Requires explicit narrowing and undefined handling when accessing collections, but eliminates `TypeError: Cannot read properties of undefined` in production.

---

### ADR 002: Expo SDK 57 + Expo Router
- **Context**: Need cross-platform navigation with deep linking, modal sheets, and compatibility with modern Expo Go clients.
- **Decision**: Align with Expo SDK 57 and `expo-router` v57 (file-based tabs and stack navigation).
- **Trade-off**: Requires adhering to file-based routing conventions, which clean up boilerplate and separate navigation concerns from business logic.

---

### ADR 003: `react-native-wagmi-charts` for Stock Detail Live Chart
- **Context**: PR 13 requires a live stock chart plotting received ticks with touch scrubbing.
- **Decision**: Integrate `react-native-wagmi-charts` powered by `react-native-reanimated` and `react-native-gesture-handler`.
- **Trade-off**: Reanimated runs gestures and crosshair animations directly on the UI thread, freeing the JavaScript thread to process high-frequency price feed ticks (~20/s) without frame drops.

---

### ADR 004: Pure Integer Paise Domain & Boundary Float Conversion
- **Context**: In financial software, binary floating-point representation (`IEEE 754`) causes rounding drift (e.g. `0.1 + 0.2 === 0.30000000000000004`). In a live ticker handling ~20 ticks/sec, compounding float arithmetic inevitably causes reconciliation discrepancies between the summary card and individual portfolio rows.
- **Decision**:
  - Model all monetary values as integer `Paise` inside the domain layer (`src/domain/money.ts`).
  - Convert API floats to paise exactly once at the ingestion boundary using `Math.round(rupees * 100)`.
  - Perform P&L percentages using scaled integer math: `Math.round((pnlPaise * 10000) / investedPaise) / 100`.
- **Edge Case Trade-off (IEEE-754 Rounding)**:
  - In IEEE-754 double precision, `1.005` is stored internally as `1.00499999999999989...`. Thus, `1.005 * 100` evaluates to `100.49999999999999`, which `Math.round()` rounds down to `100` paise.
  - Conversely, `0.005` is stored as `0.00500000000000000010...`, which multiplies to `0.5000000000000001` and rounds up to `1` paise.
  - Converting once at the boundary bounds this unavoidable binary representation anomaly to input parsing, preventing it from corrupting ongoing domain arithmetic.

---

### ADR 005: Custom Indian Number Formatting (`formatINR`) Without `Intl`
- **Context**: Indian currency requires non-standard digit grouping: the rightmost 3 digits are grouped, followed by successive pairs of 2 digits (e.g., `₹12,34,567.89` for lakhs/crores).
- **Decision**: Write our own zero-dependency regex formatter in `src/domain/format.ts` using `slice(-3)` and `/\B(?=(\d{2})+(?!\d))/g`. Never rely on `Intl.NumberFormat`.
- **Trade-off**: The Hermes JavaScript engine on Android has historically bundled incomplete ICU data depending on build flags, causing `Intl` to fall back to western thousands separators (`₹1,234,567.89`) or crash on older engine distributions. A pure algorithmic string formatter guarantees 100% deterministic, hermetic rendering on all target platforms and in node-based unit tests.

---

### ADR 006: Portfolio Summary Reconciliation & Unpriced Holdings
- **Context**: Unpriced holdings (like `OLDCO`) have known cost basis (`investedPaise`) but no market quote (`ltp === null`). If unpriced stocks are assigned a price of 0, the user's portfolio falsely shows an instant 100% loss on that position.
- **Decision**:
  - Unpriced stocks render `"--"` for price, current value, and P&L.
  - In `summarize()`, unpriced stocks are excluded from current value, total P&L, today's P&L, and from the invested capital figure used to calculate portfolio P&L percentage (`totalPnlPct = safePercent(totalPnlPaise, pricedInvestedPaise)`).
  - Unpriced invested capital is segregated into `unpricedInvestedPaise` and displayed in an informative footnote on the summary card.
  - **Reconciliation Invariant**: Summary totals are calculated as the arithmetic sum of the already-rounded individual rows (`sum(row.valuePaise)`), guaranteeing that the displayed summary number reconciles to the exact rupee and paise with the list of displayed rows.

---

### ADR 007: Today's P&L and Intraday Session Order Treatment
- **Context**: Need a uniform, deterministic calculation for "Today's P&L" across holdings, including positions updated via buy/sell orders during the current trading session.
- **Decision**:
  - Calculate row Day P&L uniformly as: `dayPnlPaise = qty * (ltp - prevClose)`.
  - For positions increased or bought intraday, apply the same formula against `prevClose`.
  - **Rationale**: In Indian brokerages (Zerodha Kite, Groww), Day's P&L on equity holdings is measured against the previous trading session's official exchange closing price (`prevClose`). Tracking intraday tax lots or FIFO buckets for local orders would introduce unwarranted state complexity without changing the underlying product requirement.

---

### ADR 008: Sequence-Based Tick Dropping, Boundary Widening, and Exact Reference Identity
- **Context**: In high-frequency market streaming (~20 ticks/s), network packets can arrive out-of-order, duplicated, or delayed. In React Native, triggering unnecessary state emissions degrades UI frame rates.
- **Decision**:
  - `mergeTick(state, tick)` tracks per-symbol sequence numbers (`seq`).
  - If `tick.seq <= currentQuote.seq`, the tick is dropped immediately and the function returns the **exact same state reference** (`state === mergeTick(state, tick)`).
  - High and low boundaries must strictly widen, never shrink, when `ltp` passes them.
  - Volume is monotonic (never decreases).
  - If a tick produces no state differences, the existing state reference is returned untouched.
- **Rationale**: Returning identical object references allows `useSyncExternalStore` and `React.memo` to skip re-renders entirely for dropped or duplicate packets, preserving 60 FPS under rapid streaming.

---

### ADR 009: Decoupled `PriceFeed` Interface and Functional Simulator Factory
- **Context**: The app requires realistic high-frequency market data (~20 ticks/sec across 25 symbols, ±0.2% price jitter, periodic 5s silence windows, and ~2% out-of-order packets) while remaining completely decoupled from network transport protocols. Furthermore, modern React Native architectures favor functional composition over classical object-oriented state.
- **Decision**:
  - Define an abstract `PriceFeed` interface (`connect`, `disconnect`, `onTick`) in `src/feed/types.ts`.
  - Implement a closure-encapsulated functional factory `createSimulatedFeed` in `src/feed/SimulatedFeed.ts` (with an optional backward-compatible `SimulatedFeed` class wrapper).
  - Internal state (interval timers, sequence maps, listener sets) is held entirely in private function closures without prototype chains or `this` context binding risks.
  - Restrict imports of `createSimulatedFeed` exclusively to the application composition root (`src/app/bootstrap.ts`). UI screens, hooks, and stores depend solely on the `PriceFeed` contract.
- **Rationale**:
  - **Hermes Optimization**: Functional closures avoid class prototype lookups and memory indirection on Hermes.
  - **Context Safety**: Callback methods (`connect`, `disconnect`, `onTick`) can be passed directly to React Native lifecycle effects (e.g. `useEffect(() => feed.connect(), [])`) without `.bind(this)` or arrow wrapper overhead.
  - **Determinism**: The factory accepts a seedable RNG and configurable intervals, fully controllable via Jest fake timers.

---

### ADR 010: Pure Functional React Native Architecture Across All Layers
- **Context**: Object-oriented patterns (classes, mutable instances, prototype inheritance) introduce subtle bugs in React Native applications: loss of `this` context when passing methods to React hooks or event handlers, prototype resolution overhead on Hermes, and unpredictable state mutation paths.
- **Decision**:
  - Enforce a 100% functional architecture across the entire project:
    1. **Domain Layer**: All calculations, order mutations, formatting, and tick merging are pure functions without side effects (`src/domain/`).
    2. **State & Feed Layer**: Stores (`createPriceStore`, `createPortfolioStore`, `createWatchlistStore`), network clients (`createOhlcClient`), and feeds (`createSimulatedFeed`) are functional factories with private lexical closures. Zero classes, zero prototype chains.
    3. **UI Layer**: All components are React Functional Components wrapped in `React.memo` where appropriate, reading state via custom hooks (`usePrice`, `useQuoteField`, `useSyncExternalStore`). Zero class components.
- **Rationale**:
  - Completely eliminates `this` rebinding errors in React effect teardowns and event callbacks.
  - Leverages Hermes engine optimizations for plain closures and flat object literals.
  - Enables effortless unit and integration testing without mocking prototypes or constructor state.

---

### ADR 011: Granular Per-Symbol Subscriptions and Batched Coalescing PriceStore
- **Context**: With 25 symbols ticking ~20 times per second, managing market quotes directly inside React component state (`useState` / Context) causes whole-tree re-renders on every tick (~20 renders/sec for the entire list), dropping frame rates well below 60 FPS.
- **Decision**:
  - Implement an external price store outside React via functional factory `createPriceStore()`.
  - Provide granular per-symbol subscriptions (`store.subscribe(symbol, callback)`).
  - Batch incoming ticks into a queue and flush at ~100 ms intervals.
  - During flush, only symbols whose quote reference actually changed notify their own subscribers. Other rows stay completely idle.
  - React rows subscribe via `usePrice(symbol)`, leveraging `useSyncExternalStore` with stable snapshot references.
  - Detect feed stalls (> 2 s without ticks) using an event-driven `setTimeout` (O(1), zero battery drain) to drive the `usePaused()` hook.
  - Wire the feed exclusively at the composition root (`src/app/bootstrap.ts`).
- **Rationale**:
  - Decouples high-frequency tick ingestion from the React commit phase.
  - Guarantees that a price tick for `RELIANCE` re-renders only the `RELIANCE` row.
  - Throttled summary subscriptions receive a single notification per batch instead of 20 uncoalesced renders.

---

### ADR 012: Single-Batch OHLC Ingestion and Sequence Preservation on Refresh
- **Context**: The app fetches market quotes once on bootstrap and on manual pull-to-refresh without polling. The remote API endpoint returns HTTP 201 with `message.data`. Absent symbols (like `OLDCO`) are omitted without error.
- **Decision**:
  - Request all 25 equity symbols plus `OLDCO` in one batch POST request using `createOhlcClient`.
  - Defensively validate raw response shape using `isOhlcResponse` and convert floats to integer `Paise` exclusively at this boundary via `toPaise(val)`.
  - Symbols missing from the API response are assigned `ltp: null` (rendering `"--"`).
  - **Sequence Preservation Rule on Refresh**: When pull-to-refresh re-seeds `priceStore`, existing per-symbol sequence numbers (`seq`) are strictly preserved (`seq: state[sym]?.seq ?? 0`).
- **Rationale**:
  - If a refresh reset sequence numbers to 0 while the simulator or socket feed continued generating higher sequence numbers (`seq >= 100`), incoming ticks would be erroneously dropped or stale market data could overwrite newer quotes.
  - Preserving sequence counters guarantees monotonic progress and continuous feed stability across network refreshes.

---

### ADR 013: Semantic Design Tokens and Accessible Multi-Cue State Primitives
- **Context**: The app must support seamless runtime switching between light mode ("Precision Fiscal") and dark mode ("Terminal Precision"). Live ticker updates (~20 Hz) cause horizontal layout jitter if proportional fonts are used. Furthermore, accessibility guidelines dictate that color alone cannot be the sole visual cue for profit or loss.
- **Decision**:
  - Centralize semantic tokens in `src/theme/tokens.ts` (`lightTokens`, `darkTokens`) and expose via functional `useTheme()` hook. Prohibit raw hex codes inside components.
  - Enforce `fontVariant: ['tabular-nums']` across all numeric and currency typography (`PriceText`, `PnLText`) to preserve fixed character width and prevent row shifting.
  - In `PnLText`, always render explicit algebraic signs (`+` or `-`) alongside semantic green/red coloring.
  - Build `StateView` and `PausedBanner` as functional memoized components with direct binding to external store indicators.
- **Rationale**:
  - Guarantees WCAG 2.1 compliance for color-blind users (deuteranopia / protanopia).
  - Maintains rock-solid layout alignment at 60 FPS under continuous market ticking.

---

### ADR 014: Throttled Derived Portfolio Summary and Missing-Price Rule
- **Context**: Portfolio totals (current value, total invested, total P&L, today's P&L) derive from the aggregation of all holding rows. At ~20 market ticks per second, recalculating totals and re-rendering the summary card on every tick or batch flush causes unnecessary CPU thrash and battery drain. Furthermore, unpriced holdings (such as `OLDCO` or suspended stocks) must never corrupt totals with assumed prices or ₹0 values.
- **Decision**:
  - Implement a dedicated external summary store via functional factory `createSummaryStore()` in `src/stores/summaryStore.ts`.
  - Throttle market price updates to ~4 Hz (250 ms) via a trailing timer. User-initiated portfolio actions (orders, initial load) recompute immediately.
  - Enforce strict reference stability (`areSummariesEqual`): if incoming ticks do not alter total portfolio figures, the snapshot reference is preserved, allowing `useSyncExternalStore` to bail out of re-rendering.
  - **Missing-Price Domain Rule**:
    - Unpriced holdings (`ltp === null`) are strictly excluded from portfolio current value, total P&L, today's P&L, and from the denominator of portfolio P&L percentage.
    - Unpriced holdings are tracked distinctly (`unpricedCount`, `unpricedInvestedPaise`) and presented in an informative footnote: `"1 holding has no price and is left out of these totals (₹12,375.00 invested)."`
    - If no holding is priced, all summary totals evaluate to `null`, rendering `"--"` across all financial metrics while displaying `"0 priced"`.
- **Rationale**:
  - Caps summary re-renders at ~4 Hz, maintaining a smooth 60 FPS mobile UI while prices tick rapidly.
  - Guarantees exact arithmetic reconciliation: summary totals match the exact sum of displayed priced rows to the paise.
  - Adheres to trading standards: never estimates, fakes, or assumes 0 for missing scrip prices.

---

### ADR 015: Virtualized Holdings List, Isolated Row Subscriptions, and Interval-Throttled Sorting
- **Context**: In a portfolio tracking 21+ equity positions with market updates arriving ~20 times per second, passing quote objects down to a `FlatList` causes the entire list to re-render continuously. Furthermore, sorting holdings by dynamic price metrics (e.g. Current Value or P&L) on every tick causes rows to rapidly jump positions on screen, creating an unreadable and disorienting UI.
- **Decision**:
  - The `FlatList` `data` prop is an array of symbol strings (`string[]`), never objects.
  - `HoldingRow` is wrapped in `React.memo` and receives only `symbol: string` and stable `onPress`. It isolates its subscriptions by reading quote via `usePrice(symbol)` and holding position via `useHolding(symbol)`.
  - Enforce a fixed row height (`HOLDING_ROW_HEIGHT = 72`) with `getItemLayout` for O(1) virtualization scroll calculations, bypassing costly dynamic measurement.
  - **Interval-Throttled Sorting Rule**:
    - User actions (filtering by symbol, toggling sort column, toggling direction) trigger immediate re-sorting.
    - When sorting by 'name', market ticks have zero effect on ordering.
    - When sorting by dynamic metrics ('value' or 'pnl'), ordering is refreshed at most once every 2 seconds via a slow interval timer. High-frequency price updates (~20 Hz) never trigger list re-ordering.
  - Unpriced holdings (`OLDCO`) consistently display `"--"` for price and P&L, and sort to the end of the list when descending.
- **Rationale**:
  - Guarantees optimal 60 FPS performance: one price tick re-renders exactly one row (plus the ~4 Hz throttled summary).
  - Eliminates visual row thrashing and UI jumping, providing a rock-solid trading UX.

---

### ADR 016: Zero-Cost Dev-Only Render Profiling and Automated Isolation Verification
- **Context**: Grading Priority 1 (30%) requires proving that one price tick re-renders only the affected row plus the throttled summary card. Verifying this in manual QA or interview walkthroughs requires immediate, observable visual feedback without compromising production performance.
- **Decision**:
  - Implement a development-only render counter hook `useRenderCount()` in `src/utils/useRenderCount.ts`. When `__DEV__` is false, it returns a constant 0 with zero runtime overhead.
  - Expose a global toggle via `usePerfOverlay()` and `togglePerfOverlay()` in `src/utils/perfOverlay.ts`.
  - When enabled, `HoldingRow` and `SummaryCard` display a high-contrast badge (`R: <count>`).
  - Add an automated unit test suite `__tests__/perf/isolatedRowRerender.test.tsx` proving that emitting a tick for `RELIANCE` increments its render count from 1 to 2, while un-ticked rows like `TCS` remain strictly at 1.
  - Document complete profiler recording instructions in `docs/PROFILING.md`.
- **Rationale**:
  - Provides instant verification in local runs and live interviews.
  - Guards against performance regressions in CI without relying on manual Profiler sessions.
  - Guarantees zero production bundle impact.

---

### ADR 017: Pluggable Watchlist Store with AsyncStorage Persistence and Whitelist Enforcement
- **Context**: Users can customize their watchlist by adding or removing symbols. This preference must persist across app reloads via mobile local storage (`AsyncStorage`). Furthermore, the app must remain resilient to storage corruption, enforce the strict 25-symbol universe (disallowing unlisted tickers like `OLDCO`), prevent duplicate entries, and allow isolated subscriptions via hooks.
- **Decision**:
  - Implement functional closure factory `createWatchlistStore(storage?: StorageBackend)` in `src/stores/watchlistStore.ts`.
  - Abstract storage operations behind a lightweight `StorageBackend` interface (`getItem`, `setItem`), defaulting to `@react-native-async-storage/async-storage`.
  - Seed default watchlist with 5 core large-cap scrips: `['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK']`.
  - **Storage Resilience & Sanitization**:
    - During hydration, parse JSON and validate that entries are arrays of strings.
    - Discard any ticker not present in `ALLOWED_SYMBOLS` (disallowing unknown symbols and unlisted holdings like `OLDCO`).
    - Deduplicate entries while preserving order.
    - If storage is corrupted or unreadable, fall back gracefully to the safe default watchlist without throwing or blocking render.
  - Export per-symbol hook `useIsInWatchlist(symbol)` returning a boolean, and `useWatchlist()` returning `{ symbols, addSymbol, removeSymbol, toggleSymbol, isLoaded }`.
- **Rationale**:
  - Decoupling storage via `StorageBackend` allows fast, deterministic Jest unit tests using in-memory mock storage with zero native runtime dependencies.
  - Hard whitelist validation protects the app from stale or invalid symbols stored in legacy app caches.
  - Per-symbol hook `useIsInWatchlist(symbol)` allows Add/Detail buttons to subscribe only to their own inclusion status, avoiding re-renders when other symbols are added or re-ordered.

---

### ADR 018: Watchlist UI, Pure Day Metrics Calculation, and Swipeable Gesture Row Isolation
- **Context**: The Watchlist screen must render live LTP and day changes (₹ and %) for user-selected stocks while maintaining 60 FPS under ~20 Hz ticks. It must allow seamless adding from the 25 allowed NSE universe and removing items via gestures or accessible buttons.
- **Decision**:
  - Formulate day change metrics in pure domain function `quoteDayMetrics(quote: Quote | null)` in `src/domain/calcs.ts`. If `ltp` is null or quote is missing, all metrics return `null` and `isPriced: false`, rendering `"--"` without guessing or defaulting to 0.
  - Implement `WatchRow` as a memoized functional component receiving only `symbol: string` (and stable callbacks), reading its own quote via `usePrice(symbol)` with a fixed 72px row height for O(1) `FlatList` virtualization.
  - Implement swipe-to-delete using `react-native-gesture-handler` `Swipeable`, while providing accessible direct removal buttons (`watch.remove.<symbol>`) for screen readers and automated testing.
  - Implement `WatchlistAddModal` displaying the 25 `ALLOWED_SYMBOLS`, with in-sheet search and instant status cues via `useIsInWatchlist(symbol)`.
- **Rationale**:
  - Maintains strict tick isolation: receiving a price tick for `TCS` only re-renders the `TCS` row in the Watchlist.
  - Pure calculation functions ensure 100% testable day change arithmetic with zero float errors.
  - Consistent layout and visual tokens match the Portfolio screen and the Stitch design specification.

---

### ADR 019: Granular Stock Detail Market Stats and Unavailable/Paused Trading Guardrails
- **Context**: The Stock Detail screen visualizes live tick updates, day range bounds, and market statistics (Open, High, Low, Prev. Close, Volume) for a selected stock. Updating any of these metrics at ~20 ticks/sec must not re-render the entire screen. Furthermore, unpriced stocks (like `OLDCO`) or periods of paused feeds must disallow trading actions and render `"--"` without crashing or guessing prices.
- **Decision**:
  - Decompose statistics into micro-components (`OpenStat`, `HighStat`, `LowStat`, `PrevCloseStat`, `VolumeStat`) inside `src/components/StockStatsGrid.tsx` wrapped in `React.memo`. Only updated stat values re-render on ticks.
  - Pure function `dayRangePosition(low, high, ltp)` in `src/domain/calcs.ts` calculates a normalized range ratio [0.0, 1.0], rendering a visual progress track and indicator pin. If any bound is null, returns null and displays `"--"`.
  - Missing price domain enforcement: when `ltp === null`, screen renders `"--"` for price and day change, shows a clear unavailable warning banner, and disables Buy and Sell action buttons.
  - Paused banner integration: when `isPaused === true`, displays `PausedBanner` and disables order entry.
  - Strictly omits extraneous un-contracted metrics (P/E, market cap, 52-week range, depth, range tabs) in compliance with domain guidelines.
- **Rationale**:
  - Eliminates screen-wide layout thrashing during high-frequency live ticks.
  - Protects users from placing invalid orders when quotes are stale, paused, or missing.
  - Adheres strictly to the institutional trading take-home spec.

---

### ADR 020: Hand-Rolled SVG Live Tick Chart with Throttled Ring Buffer and Reconciled Position Card
- **Context**: Real-time visualization of price action during an active user session requires displaying tick trajectories without introducing third-party chart library bloat. Furthermore, stocks held by the user must display a reconciled "Your Position" section reflecting live position value and P&L derived identically to the Portfolio screen.
- **Decision**:
  - Implement a hand-rolled SVG line chart in `src/components/LiveLineChart.tsx` utilizing `react-native-svg` (`Path`, `Circle`).
  - Derive chart SVG paths via pure domain function `chartPath(points, width, height, padding)` in `src/domain/chart.ts`, handling edge cases (fewer than 2 points, zero price variance) with deterministic Jest tests.
  - Ring buffer capped at 120 ticks: incoming ticks append to a mutable ref buffer. A trailing timer flushes accumulated points to React state at ~4 Hz (250 ms), decoupling 20 Hz tick arrivals from SVG render passes.
  - Directional coloring: line and current-price dot render in `tokens.gain` (green) if latest price >= session start price; `tokens.loss` (red) if below.
  - Conditional "Your Position" section (`PositionCard.tsx`): rendered only when `useHolding(symbol)` returns an active position. Computes Invested, Current Value, Total P&L, and Today's P&L using pure `rowMetrics`. Unpriced holdings cleanly display `"--"`.
- **Rationale**:
  - Eliminates external chart library bundle weight while delivering pixel-perfect integration with design tokens.
  - Caps chart re-renders at ~4 Hz, maintaining a smooth 60 FPS mobile UI.
  - Re-using pure domain `rowMetrics` guarantees 100% arithmetic parity between the Portfolio and Stock Detail screens.

---

### ADR 021: Local Order Sheet Execution, Pure Validation, and Instant Summary Reconciliation
- **Context**: The Buy/Sell order sheet allows local simulated trade execution from the Stock Detail screen. Trading actions must strictly enforce positive integer quantities, prevent overselling, disallow execution during paused feeds or when prices are unavailable, and update portfolio holdings atomically so summary totals immediately reflect the trade without diverging from displayed row values.
- **Decision**:
  - Pure domain validation in `validateOrder` (`src/domain/orders.ts`): enforces positive whole integers, checks `qty <= heldQty` on SELL, and blocks orders if `ltp === null` or `isPaused === true`.
  - Pure domain order preview in `computeOrderPreview`: calculates estimated total paise (`mulQty`) and produces informative impact text ("New average ₹...", "25 shares → 15 shares left", "Position will be closed").
  - `OrderSheet` modal component: uses native numeric keyboard (`keyboardType="number-pad"`), segmented BUY/SELL toggle, quick quantity preset chips ("10", "25", "50", "Sell All"), and confirmation toast.
  - Atomic local execution: reads live LTP at confirm time and invokes `portfolioStore.executeOrder`, synchronously triggering `applyOrder` and notifying subscribers so the portfolio list and summary card update in lockstep.
  - Automated integration tests prove:
    - Summary card totals match the sum of row metrics to the paise after a BUY.
    - Selling all shares completely removes the holding.
    - Average price rounds to whole paise.
- **Rationale**:
  - Decoupling validation into pure domain functions ensures 100% unit testability without React UI harness overhead.
  - Atomic execution satisfies the hard financial requirement that summary totals must equal the sum of displayed rows at all times.

---

### ADR 022: Global Accessibility Standards, SVG Tab Icons, and Theme Polishing
- **Context**: Institutional financial applications require rigorous accessibility (WCAG 2.1 AA touch targets >= 44x44px, screen-reader cues, color-blind gain/loss cues) and visual polish across both Light and Dark modes without reliance on external font files.
- **Decision**:
  - Create native-vector SVG icons in `src/components/icons/index.tsx` (`PortfolioTabIcon`, `WatchlistTabIcon`, `ThemeToggleIcon`, `SearchIcon`, `BackIcon`), removing third-party icon font overhead.
  - Integrate interactive theme toggle (☀️/🌙) into the main tab layout header, wired to `useTheme().toggleTheme()` and `useTheme().isDark`.
  - Enforce touch target accessibility: all interactive touch areas (sort pills, clear buttons, watchlist add/done buttons, star toggle, back button, order chips, confirm button) meet or exceed the 44px minimum touch target standard.
  - Multi-cue financial indicators: `PnLText` attaches `accessibilityRole="text"` and `accessibilityLabel` with explicit text cues ("Gain: +₹..." vs "Loss: -₹..."), preventing reliance on color alone.
  - Alert announcements: `PausedBanner` is enhanced with `accessibilityRole="alert"` and `accessibilityLiveRegion="polite"`.
  - Automated verification test suite in `__tests__/polish/statesAndAccessibility.test.tsx` testing token completeness, touch targets, and Indian formatting.
- **Rationale**:
  - Delivers a polished, accessible, institutional-grade experience.
  - Protects against color-blind misinterpretation of critical financial gains and losses.
  - Ensures seamless responsiveness across light, dark, and system themes.












