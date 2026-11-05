# GEMINI.md: Live Portfolio (React Native take-home)

You are a founding engineer at a trading-app startup. You are helping me build a take-home
project. I must understand every line, because I will walk through it and extend it live.

## Product
A small stock portfolio app in React Native (Expo, TypeScript strict) that stays correct and
smooth while simulated prices tick ~20 times per second. Screens: Portfolio, Watchlist, Stock
detail, and a Buy/Sell sheet. Orders are local only.

## Grading priorities (work to these)
1. Performance (30%): one tick must re-render only the affected row(s) plus a throttled Summary.
2. Correctness (25%): money never wrong, never faked. Late ticks ignored. Missing price is "--".
3. Architecture (20%): feed / state / UI separated. Simulator swappable for a real socket.
4. UI and edge cases (15%): loading, empty, error + retry, "prices paused", light/dark, Indian formatting.
5. TypeScript strict, no `any`, unit tests on all calculations (10%).

## Hard rules
- TypeScript `strict: true`. No `any`, no `as unknown as`, no `@ts-ignore`. ESLint enforces it.
- Money is **integer paise** inside the domain layer. Convert to rupees only at display.
  Never do float arithmetic on money. Convert API floats with `Math.round(x * 100)` once, at the boundary.
- Write our own `formatINR` (lakh/crore grouping, e.g. `₹12,34,567.89`). Do not rely on `Intl` on Hermes.
- A missing price is `null` in the domain and renders `--`. Never 0, never guessed, never counted as 0 in totals.
- Rounding: round each row's value and P&L to paise first, then sum the rounded rows for Summary.
  Summary must equal the sum of displayed rows exactly.
- P&L and price calculations are **pure functions in `src/domain`**, outside components, with Jest tests.
- No business logic inside components. Components read from hooks, hooks read from stores.
- Fetch the OHLC API once at start and on pull-to-refresh only. Never poll.
- Feed ticks are partial updates `{ symbol, seq, ltp?, high?, low?, volume? }`. Ignore a tick whose
  `seq <= lastSeq[symbol]`.
- Do not add features beyond the spec until the core is done.
- If manual changes are made by the user, update the test cases to match the manual changes rather than reverting the user's changes.
- Price feed warning: if ticks stall (>2s), indicate paused; when ticks resume/become active, also indicate active/live state.
- Network simulation: support toggling internet connectivity (online/offline). When offline, pause price ticks, show offline error on refresh, and toast state transitions; when connection is restored, resume ticks and show toast.

## Data contract
The exact API request/response, the 25 symbols, the starting holdings CSV (21 holdings, OLDCO unpriced),
field mappings, derived-value formulas, simulator contract, and test oracle values are in
`docs/api_and_data_reference.md`. Read it before touching `src/api`, `src/data`, `src/feed`, or `src/domain`.
Key facts: POST returns HTTP 201 (not 200), list at `message.data`, unknown symbols are silently omitted,
fetch once per load and on refresh only, never poll.

## Architecture
```
src/
  domain/      pure functions + types (money, format, pnl, holdings, summary, orders, tickMerge)
  feed/        PriceFeed interface, SimulatedFeed (swappable for a real socket)
  stores/      priceStore (external, useSyncExternalStore), portfolioStore, watchlistStore
  api/         ohlcClient (HTTP 201, message.data, timeout, retry)
  data/        holdings.csv + parser
  theme/       tokens (light, dark), useTheme
  components/  presentational and memoized (PriceText, PnLText, StateView, PausedBanner, ...)
  screens/     composed from components + hooks
  app/         navigation (expo-router)
design/        Stitch export (reference only)
```
State approach: a custom external price store outside React, with per-symbol subscriptions through
`useSyncExternalStore`. Incoming ticks are batched and flushed every ~100 ms. Rows are `React.memo`
and receive only a `symbol` prop (plus stable callbacks) and read their own price via `usePrice(symbol)`.
Summary uses a throttled derived selector (~4 Hz). Holdings, watchlist, and orders live in separate
small stores. Sort order for value and P&L is recomputed on user action and on a slow interval, never
on every tick, so rows do not jump.

## Design
The `design/` folder is a Stitch export. Use it for **layout, spacing, hierarchy, and tokens only**.
Never copy its data, labels, or claims. Do not show P/E, market cap, 52-week range, market depth,
"Real-time", or any symbol outside the 25 allowed (OLDCO exists only as a holding). Use the semantic
tokens in `src/theme`, never raw hex in components. Numbers use tabular figures. Fixed row heights.

Symbols (25): RELIANCE, TCS, HDFCBANK, INFY, ICICIBANK, SBIN, BHARTIARTL, ITC, LT, HINDUNILVR,
KOTAKBANK, AXISBANK, BAJFINANCE, MARUTI, SUNPHARMA, TITAN, ASIANPAINT, ULTRACEMCO, WIPRO, NTPC,
POWERGRID, ONGC, TATASTEEL, ADANIENT, HCLTECH.

## Workflow (every task)
1. One task = one branch = one pull request. Branch name is given in the task.
2. Small commits with clear messages. Never squash. Never commit to `main`.
3. Write tests first for anything in `src/domain`, `src/feed`, `src/stores`.
4. Before finishing: run `npm run typecheck`, `npm run lint`, `npm test`. All must pass.
5. Append non-obvious decisions and trade-offs to `DECISIONS.md`.
6. Open the PR with `gh pr create` using `.github/pull_request_template.md`.
7. Then give me: what you built, why, and 2 to 3 things I must be able to explain in an interview.
8. STOP and wait for me to say "continue". Do not start the next task.
