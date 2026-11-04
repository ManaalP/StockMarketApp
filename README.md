# Live Portfolio (React Native)

A high-performance, real-time stock portfolio tracker built with **React Native (Expo SDK 57)** and **strict TypeScript**, engineered to maintain 60 FPS while processing high-frequency simulated market data (~20 ticks/sec across 25 NSE equity symbols).

---

## Architectural Highlights

1. **Deterministic Financial Domain**
   - **Zero Floating-Point Money**: Money values are strictly modeled as integer `Paise` in the domain layer. Conversions from API floats occur exactly once at system boundaries via `Math.round(x * 100)`.
   - **Custom Indian Numbering**: Custom `formatINR` formatter supporting Indian grouping (e.g. `₹12,34,567.89`) without relying on Hermes ICU / `Intl.NumberFormat`.
   - **Reconciliation Invariant**: Each holding's current value and P&L is rounded to nearest paise first, then summed to compute portfolio summaries. Displayed portfolio totals match the sum of displayed rows to the exact paise.
   - **Missing Data Handling**: Unpriced stocks are represented as `null` in domain and rendered strictly as `"--"`. They are excluded from value and P&L totals rather than being coerced to zero.

2. **Decoupled High-Frequency State**
   - **Per-Symbol Subscriptions**: Built on an external price store outside React, integrated via `useSyncExternalStore`.
   - **Batched Engine**: Market ticks arriving at ~20 Hz are queued and flushed at ~100 ms intervals.
   - **Isolated Re-renders**: Incoming ticks trigger re-renders only on affected rows (`React.memo`), keeping the rest of the UI idle.
   - **Throttled Portfolio Summary**: High-level portfolio aggregates recalculate via a throttled selector at ~4 Hz to prevent unnecessary layout thrash.

3. **Production-Ready Visuals & Charts**
   - Native gesture-driven interactive price charts powered by `react-native-wagmi-charts` and Reanimated.
   - Semantic design tokens matching Stitch design specs with full Light / Dark theme support.

4. **100% Functional Architecture (React Native + Expo)**
   - **Pure Domain Functions**: All calculations (P&L, valuations, allocations, tick-merging) are deterministic pure functions with zero side effects.
   - **Closure-Based State Factories**: State stores, feed simulator, and API clients use functional factories (`createPriceStore`, `createSimulatedFeed`, `createOhlcClient`) with private lexical closures. No ES6 classes, no prototypes, no `this` context binding hazards.
   - **Functional UI Components**: All screens and presentation rows are React Functional Components utilizing `React.memo`, `useSyncExternalStore`, and custom hooks.
   - **Hermes Engine Optimized**: Maximizes execution speed and memory efficiency on React Native's Hermes engine by bypassing prototype resolution.

---

## 25 Allowed NSE Symbols

`RELIANCE`, `TCS`, `HDFCBANK`, `INFY`, `ICICIBANK`, `SBIN`, `BHARTIARTL`, `ITC`, `LT`, `HINDUNILVR`, `KOTAKBANK`, `AXISBANK`, `BAJFINANCE`, `MARUTI`, `SUNPHARMA`, `TITAN`, `ASIANPAINT`, `ULTRACEMCO`, `WIPRO`, `NTPC`, `POWERGRID`, `ONGC`, `TATASTEEL`, `ADANIENT`, `HCLTECH`.

*(Note: `OLDCO` exists only as a static holding to demonstrate unlisted/unpriced asset handling).*

---

## Stacked PR Architecture Roadmap

The project is structured into sequential, independently verifiable Pull Requests:

- **PR 0: `chore/scaffold`** — Expo SDK 57 base, TypeScript strict mode, ESLint zero-any, Jest preset, tab navigation skeleton.
- **PR 1: `feat/money-and-format`** — Integer paise math primitives and Indian currency formatting with comprehensive unit tests.
- **PR 2: `feat/domain-calcs`** — Pure domain calculation logic: row metrics, reconciliation summarize, and local order execution.
- **PR 3: `feat/feed-simulator`** — Market tick stream generator (~20 ticks/sec), tick merger, and sequence validation.
- **PR 4: `feat/external-price-store`** — External price store with per-symbol `useSyncExternalStore` subscriptions and batch flusher.
- **PR 5: `feat/csv-parser-and-portfolio-store`** — Local CSV holdings parser and portfolio state persistence.
- **PR 6: `feat/ohlc-api-and-watchlist-store`** — Historical OHLC API client with retry/timeout resilience and watchlist store.
- **PR 7: `feat/theme-system`** — Semantic design tokens, color palette, and dynamic light/dark mode hook.
- **PR 8: `feat/memoized-components`** — Tabular presentational components (`PriceText`, `PnLText`, `StateView`).
- **PR 9: `feat/portfolio-screen`** — Live portfolio dashboard with memoized rows and throttled summary card.
- **PR 10: `feat/watchlist-screen`** — Live watchlist screen with search, pull-to-refresh, and empty/error states.
- **PR 11: `feat/stock-detail-screen`** — Stock detail screen with key metrics and live quote updates.
- **PR 12: `feat/buy-sell-sheet`** — Bottom sheet modal for local order execution with balance/quantity validation.
- **PR 13: `feat/wagmi-charts-integration`** — Interactive live price sparkline and detail charts.
- **PR 14: `feat/polishing-and-e2e`** — Edge cases, paused feed banner, connection recovery, and final verification.

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo Go app on iOS/Android (SDK 57)

### Installation
```bash
npm install
```

### Start Expo Development Server
```bash
npx expo start
```
To run on your local Wi-Fi network with your mobile device:
```bash
REACT_NATIVE_PACKAGER_HOSTNAME=<YOUR_LAN_IP> npx expo start --host lan -c
```

---

## Verification Suite

Ensure code quality, typing discipline, and mathematical correctness:

```bash
# Verify TypeScript strict mode (zero errors)
npm run typecheck

# Verify ESLint rules (zero any, strict rules)
npm run lint

# Run Jest unit test suite
npm test
```

---

## Documentation
- [GEMINI.md](./GEMINI.md) — Technical constraints, architectural mandates, and interview guidelines.
- [DECISIONS.md](./DECISIONS.md) — Architecture Decision Records (ADR 001 - ADR 007).
