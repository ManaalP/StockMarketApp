# Gemini CLI playbook: Live Portfolio, one PR per component or screen

How to use: do **Part A once**, then run the PRs in order. For each PR: create the branch, paste the prompt, review, merge, move on. Never paste two PR prompts at once.

---

## Part A. One-time setup

1. **Create the repo and install tools**
   ```bash
   mkdir live-portfolio && cd live-portfolio && git init
   npm i -g @google/gemini-cli      # then run `gemini` once and sign in
   gh auth login                    # GitHub CLI, needed for `gh pr create`
   ```
2. **Create the GitHub remote** and push an empty `main`:
   ```bash
   gh repo create live-portfolio --private --source=. --remote=origin
   git commit --allow-empty -m "chore: initial commit" && git push -u origin main
   ```
3. **Add project context.** Copy `GEMINI.md` (from this download) into the repo root. Gemini CLI loads it automatically each session. Check it loaded with `/memory show` inside `gemini`.
4. **Add the design and the spec.**
   ```bash
   mkdir design docs
   cp -r <your stitch export folder>/* design/
   cp React_Native_Take-Home_Live_Portfolio.pdf docs/
   ```
   Keep only the good screens if you can. `design/stock_detail_clean_light` is your reference style.
5. **Add the PR template** at `.github/pull_request_template.md`:
   ```md
   ## What
   ## Why
   ## How to test
   ## Screenshots / Profiler (UI PRs)
   ## Checklist
   - [ ] typecheck, lint, tests pass
   - [ ] no `any`, no float money math
   - [ ] 100% functional architecture (pure functions, closures, zero classes, no `this`)
   - [ ] "--" for missing prices
   - [ ] DECISIONS.md updated
   - [ ] I can explain every file in this PR
   ```
6. **Protect `main`** (GitHub > Settings > Branches): require a pull request. You review and merge each PR yourself.
7. **Per-PR routine** (repeat for every PR below):
   ```bash
   git checkout main && git pull
   git checkout -b <branch-from-the-PR>
   gemini                         # paste the PR prompt, review the diff
   # after Gemini finishes: read every changed file, run the app, then
   gh pr view --web               # review on GitHub, then merge
   ```
   Useful in-session commands: `@path/to/file` to attach a file or image (use it for Stitch `screen.png`), `/memory show` to confirm context, `/help` to see the rest. Start a fresh `gemini` session per PR so context stays small.
8. **Functional React Native & Expo rule:** The entire project strictly adheres to a functional architecture. No ES6 classes, no `this` binding context bugs. Domain logic uses pure functions. Stores, feeds, and network clients use closure-based functional factories (`createPriceStore`, `createSimulatedFeed`, `createOhlcClient`). UI is built with React Functional Components and hooks (`React.memo`, `useSyncExternalStore`).
9. **Your rule as reviewer:** if you cannot explain a file, ask Gemini "explain this file line by line, and why not <alternative>" before merging.

---

## Part B. PR roadmap

| # | Branch | Scope | Weight area |
|---|---|---|---|
| 0 | `chore/scaffold` | Expo, strict TS, lint, jest, folders | TS |
| 1 | `feat/money-and-format` | paise helpers, `formatINR` | Correctness |
| 2 | `feat/domain-calcs` | P&L, holdings, orders, summary | Correctness |
| 3 | `feat/feed-simulator` | PriceFeed, tick merge, simulator | Architecture |
| 4 | `feat/price-store` | external store, batching, paused | Performance |
| 5 | `feat/api-and-seed` | OHLC client, holdings CSV, bootstrap | Correctness |
| 6 | `feat/theme-and-primitives` | tokens, shared components | UI |
| 7 | `feat/portfolio-summary` | Summary card + unpriced note | Correctness |
| 8 | `feat/portfolio-list` | memo rows, search, sort, refresh | Performance |
| 9 | `chore/perf-profiling` | render counters, Profiler proof | Performance |
| 10 | `feat/watchlist-store` | persisted watchlist | Architecture |
| 11 | `feat/watchlist-screen` | list, add sheet, swipe remove | UI |
| 12 | `feat/stock-detail-core` | header, stats, range bar | UI |
| 13 | `feat/stock-detail-chart-position` | live chart, position | UI |
| 14 | `feat/order-sheet` | buy/sell, validation, fill | Correctness |
| 15 | `chore/states-and-polish` | every state, both themes | UI |
| 16 | `docs/readme` | README, DECISIONS, video notes | All |
| S | `feat/stretch-*` | only after 16 | Bonus |

Each prompt below ends with the same stop rule from `GEMINI.md`, so it is not repeated.

---

## Part C. The prompts

### PR 0: `chore/scaffold`
```
Task: scaffold the project. Branch: chore/scaffold.
- Create an Expo + TypeScript app in this repo (expo-router, tabs layout with Portfolio and Watchlist placeholders).
- tsconfig: "strict": true, noUncheckedIndexedAccess: true. ESLint with @typescript-eslint/no-explicit-any as error.
- Jest via jest-expo. Scripts: typecheck, lint, test.
- Create the folder structure from GEMINI.md with .gitkeep files. Add DECISIONS.md and a minimal README stub.
- Do not build any feature yet.
Acceptance: app runs, `npm run typecheck && npm run lint && npm test` pass (one trivial test is fine).
```
**You verify:** why strict mode, why expo-router, what `noUncheckedIndexedAccess` catches.

### PR 1: `feat/money-and-format`
```
Task: money primitives. Branch: feat/money-and-format. Tests first.
In src/domain/money.ts and format.ts:
- type Paise = number (integer). toPaise(rupees: number): Paise using Math.round(x*100). 
- mulQty(paise, qty), addPaise, and a safe percent helper returning a number rounded to 2 decimals using integer math where possible.
- formatINR(paise: Paise | null): string with lakh/crore grouping and 2 decimals, "₹12,34,567.89"; null => "--". Negative => "-₹1,234.50".
- formatSigned(paise) => "+₹1,234.50" / "-₹1,234.50"; formatPercent(x) => "+1.23%" / "-0.45%"; formatVolume(n) => "1,47,53,650".
- Do NOT use Intl.
Tests: 0, small, 999, 1000, 1,00,000, 12,34,567.89, negatives, rounding edge cases (0.005, 1.005), null.
```
**You verify:** why integers, why not `Intl` on Hermes, how `1.005` rounds.

### PR 2: `feat/domain-calcs`
```
Task: pure domain calculations. Branch: feat/domain-calcs. Tests first, in src/domain.
Types: Quote {ltp, open, high, low, prevClose, volume} all Paise except volume; Holding {symbol, qty, avgPaise}.
- rowMetrics(holding, quote | null): { valuePaise, investedPaise, pnlPaise, pnlPct, dayPnlPaise } | null-fields when quote or ltp is null. Round to paise per row.
- summarize(rows): totals as the SUM OF THE ALREADY-ROUNDED ROWS. Unpriced rows are excluded from value, P&L, today's P&L, and from the invested figure used for P&L%. Return { pricedCount, unpricedCount, unpricedInvestedPaise, totals | null } where totals is null if nothing is priced.
- applyOrder(holdings, order{side, symbol, qty, fillPaise}): buy => new avg = round((oldQty*oldAvg + qty*fill) / newQty) in paise; sell leaves avg unchanged; selling all removes the holding; throws a typed error if qty <= 0, non-integer, or sell > held.
- Today's P&L = qty * (ltp - prevClose). Document in DECISIONS.md how session buys are treated (recommended: same formula, keep it simple).
Tests: reconciliation (sum of displayed rows == totals), OLDCO unpriced, all unpriced, buy average math, sell-all, oversell, fractional qty rejected.
```
**You verify:** why unpriced is excluded not zeroed; how totals reconcile with rows.

### PR 3: `feat/feed-simulator`
```
Task: feed layer. Branch: feat/feed-simulator. Tests first.
- src/feed/types.ts: Tick {symbol, seq, ltp?, high?, low?, volume?}; PriceFeed {connect(); disconnect(); onTick(handler): () => void}.
- src/domain/tickMerge.ts: pure function mergeTick(state: Record<symbol, Quote & {seq}>, tick) => new state or the SAME reference if the tick is late (seq <= lastSeq) or empty. High/low must widen, never shrink, when ltp passes them.
- src/feed/SimulatedFeed.ts implements PriceFeed via functional factory `createSimulatedFeed(initialQuotes, options)` (plus `SimulatedFeed` wrapper). Factory takes initial quotes, a seedable RNG, and injectable clock/timers with closure-encapsulated state so tests are deterministic.
  ~20 ticks/s across all symbols, each moves one symbol's ltp by up to ±0.2%, may change high/low/volume, per-symbol increasing seq, ~2% of ticks delivered late/out of order (older seq), and roughly once a minute the feed goes silent for 5 s then resumes.
- Screens must not know it is fake: nothing outside src/feed imports createSimulatedFeed except the composition root.
Tests (fake timers): rate, late ticks ignored by mergeTick, silence window, disconnect stops emissions, onTick unsubscribe.
```
**You verify:** the `seq` rule, why the same-reference return matters for performance, why the feed is behind an interface and built as a closure factory.

### PR 4: `feat/price-store`
```
Task: external price store. Branch: feat/price-store. Tests first.
- src/stores/priceStore.ts: functional framework-free store factory `createPriceStore()` holding quotes by symbol in private closure state. API: getQuote(symbol), subscribe(symbol, cb), subscribeAll(cb) (for summary), seed(quotes), applyTicks(ticks[]). No classes, no `this`.
- Batch: incoming ticks are queued and flushed every ~100 ms; only symbols whose quote object changed notify their own subscribers.
- Track lastTickAt. A `paused` flag becomes true when no tick arrived for > 2 s and false on the next tick; expose usePaused().
- Hooks: usePrice(symbol) and useQuoteField(symbol, selector) built on useSyncExternalStore with stable getSnapshot (return the same reference when unchanged). 
- Wire the feed in one composition root (src/app/bootstrap.ts) so feed -> store is the only link.
Tests: a tick for RELIANCE notifies only RELIANCE subscribers; late ticks do nothing; paused toggles with fake timers; batching coalesces.
```
**You verify:** why `useSyncExternalStore`, what a stable snapshot is, why 100 ms batching, why closure-based store.

### PR 5: `feat/api-and-seed`
```
Task: API client and bundled holdings. Branch: feat/api-and-seed.
- src/api/ohlcClient.ts: functional client `createOhlcClient()`: POST https://api.v2.liquide.life/api/markets/ohlc {"symbols":[...]} for all 25 + OLDCO in ONE request. Success is HTTP 201 (accept any 2xx); list at message.data; symbols not returned are simply absent (OLDCO). Timeout with AbortController (8 s), typed functional errors (network, timeout, http, parse). Validate the shape defensively (no `any`; use a type guard). Convert floats to paise at this boundary.
- Return a typed result; a `retry` helper with a small backoff for the retry button (not polling).
- src/data/holdings.csv bundled exactly as in the spec, plus a typed parser that converts to Holding (avg to paise). Tests for the parser.
- Bootstrap: on start fetch once, seed the store, then connect the feed. Pull-to-refresh calls the same fetch and re-seeds WITHOUT resetting seq tracking incorrectly (document the rule).
- Expose status: loading | ready | error(retry) for screens.
Tests with a mocked fetch: 201 OK, partial symbols, empty list, 500, timeout, malformed JSON.
```
**You verify:** why one request, how OLDCO flows to `--`, what refresh does to `seq`.

### PR 6: `feat/theme-and-primitives`
```
Task: theme and shared primitives. Branch: feat/theme-and-primitives.
Reference: @design/stock_detail_clean_light/screen.png and its DESIGN.md for tokens only.
- src/theme: semantic tokens (background, surface, surfaceAlt, text, textMuted, divider, accent, gain, loss, sell, warning, warningBg) for light and dark; useTheme() driven by useColorScheme(); spacing and type scale.
- Components, each memoized and presentational: PriceText (tabular nums, "--" for null), PnLText (sign + colour + arrow, never colour alone), StateView (loading | empty | error with Retry), Skeleton, PausedBanner (reads usePaused), Divider (hairline), Button (primary, buy, sell, text).
- A temporary dev "gallery" screen showing every component in both themes.
Acceptance: no raw hex outside src/theme; both themes switch with system setting.
```
**You verify:** why semantic tokens, why `React.memo` on leaf components.

### PR 7: `feat/portfolio-summary`
```
Task: Portfolio summary card. Branch: feat/portfolio-summary.
Reference: @design/live_portfolio_clean_light_3/screen.png (layout only).
- SummaryCard shows Current value, Total invested, Total P&L (₹ and %), Today's P&L (₹ and %).
- Data from a useSummary() hook: derives from holdings + store using summarize(), THROTTLED to ~4 Hz (not per tick).
- Unpriced note: "1 holding has no price and is left out of these totals (₹12,375.00 invested)." Totals show "--" when nothing is priced.
- Document in README/DECISIONS the missing-price rule.
Tests: hook-level test for throttling (fake timers) and the all-unpriced case.
```

### PR 8: `feat/portfolio-list`
```
Task: Holdings list. Branch: feat/portfolio-list.
Reference: @design/portfolio_light_mode/screen.png (layout only).
- FlatList with fixed row height + getItemLayout, stable keyExtractor, a module-level renderItem (or useCallback with no changing deps). Data is an array of SYMBOLS (strings), not objects.
- HoldingRow = React.memo, props: symbol (+ stable onPress). It reads quote via usePrice(symbol) and holding via a selector; computes via rowMetrics. Do NOT pass inline objects/functions.
- Search "Filter by symbol", sort Name | Value | P&L with direction. The ordered symbol list is recomputed on user action and on a slow interval (2 s) for Value/P&L, never on every tick.
- Pull to refresh -> refetch (once), with loading/empty/error/paused states via StateView.
- OLDCO shows "--" for last, value and P&L.
Acceptance: one tick re-renders exactly one row + the summary (proved in PR 9).
```

### PR 9: `chore/perf-profiling`
```
Task: prove performance. Branch: chore/perf-profiling.
- Add a dev-only render counter hook (useRenderCount) and a dev overlay toggle that shows renders per row and for the summary.
- Add docs/PROFILING.md: exact steps to verify in React DevTools Profiler (record 10 s of ticks, show one row committing per tick), plus a scroll test at 20 ticks/s.
- Fix anything found: unstable props, selectors returning new objects, context re-renders, list props.
- Keep the counter out of production builds.
```
**You verify and save:** Profiler screenshots for the README. This is the most graded PR, so do it carefully.

### PR 10: `feat/watchlist-store`
```
Task: watchlist store. Branch: feat/watchlist-store. Tests first.
- src/stores/watchlistStore.ts: add/remove/has/list, restricted to the 25 allowed symbols, persisted with AsyncStorage, hydrated on start with a safe default and a loading flag. Corrupt storage falls back to an empty list.
- useWatchlist() hooks with stable snapshots.
Tests with a mocked AsyncStorage: persist, hydrate, reject unknown symbol, dedupe, corrupt JSON.
```

### PR 11: `feat/watchlist-screen`
```
Task: Watchlist screen. Branch: feat/watchlist-screen.
Reference: @design/watchlist_clean_light/screen.png, @design/watchlist_add_sheet/screen.png (layout only).
- Memoized WatchRow (symbol prop only): last price, day change ₹ and % from open/prevClose, "--" when missing.
- Add sheet listing the 25 symbols (added ones disabled), swipe to remove (react-native-gesture-handler Swipeable), empty/loading/error states, paused banner.
- Row tap opens Stock detail.
```

### PR 12: `feat/stock-detail-core`
```
Task: Stock detail, live data. Branch: feat/stock-detail-core.
Reference: @design/stock_detail_clean_light/screen.png (this is the target style).
- Header with symbol, Updated time, watchlist star. Price block with day change.
- Stats: Open, High, Low, Previous close, Volume (Indian grouping), all live, each in its own small memoized component so only changed values re-render.
- Day range bar from low/high/ltp. Price unavailable state with "--" everywhere and disabled Buy/Sell. Paused banner.
- Opens from both Portfolio and Watchlist rows.
Do NOT show P/E, market cap, 52-week, depth, or range tabs.
```

### PR 13: `feat/stock-detail-chart-position`
```
Task: live chart and position. Branch: feat/stock-detail-chart-position.
- Hand-rolled LineChart with react-native-svg: ticks received since the screen opened, ring buffer capped at 120 points, appended via a subscription (not React state per tick: batch at ~250 ms), empty state "Waiting for first tick...". Line colour by direction since open.
- Pure function chartPath(points, w, h) in src/domain with tests.
- "Your position" section only when held: Quantity, Average price, Invested, Current value, P&L, Today's P&L, from the same domain functions as the Portfolio.
```

### PR 14: `feat/order-sheet`
```
Task: Buy/Sell sheet. Branch: feat/order-sheet. Tests first for validation.
Reference: @design/buy_sheet_valid_quantity_clean_light/screen.png, @design/sell_sheet_validation_error_clean_light/screen.png (layout only; use the NATIVE numeric keyboard).
- Opens from Stock detail as a modal sheet. Buy/Sell switch, quantity field, estimated value at the live price.
- Validation (pure function): whole number, > 0, sell <= held. Errors: "Enter a whole number above 0", "You hold 25 shares. You can't sell 30.". Disable confirm when the price is unavailable or prices are paused, with an explanation.
- On confirm: fill at the CURRENT last price read at confirm time, call applyOrder, update the portfolio store atomically. Portfolio rows and Summary must update immediately and stay consistent.
- Previews: Buy => "New average ₹...", Sell => "25 shares → 15 shares left", Sell all => "Position will be closed".
- Success state and a toast. Orders are local only; say so in a footnote.
Tests: integration test that after a buy the summary equals the sum of rows; sell-all removes the holding; average rounding.
```

### PR 15: `chore/states-and-polish`
```
Task: states and polish. Branch: chore/states-and-polish.
- Audit every screen for loading, empty, error+retry, and paused states, in light and dark.
- Remove any leftover unstable props. Confirm "--" everywhere a price is missing and never counted as 0.
- Accessibility: touch targets >= 44, labels, contrast, gain/loss not colour-only.
- Verify Indian formatting everywhere. List what you changed in the PR description.
```

### PR 16: `docs/readme`
```
Task: README. Branch: docs/readme. Include:
- Install and run, and which platform I tested (ask me).
- State and re-render approach and why (store, batching, memo rows, throttled summary, stable sort order).
- How Summary handles an unpriced holding, and why.
- Rounding and reconciliation rule.
- Libraries chosen and why not alternatives.
- What was skipped and what I would do next with another day.
- Roughly how long I spent (ask me).
- Profiler screenshots from PR 9 and a short architecture diagram.
```

### Stretch (only after PR 16 is merged)
- `feat/stretch-flash`: price flash on the UI thread with Reanimated shared values.
- `feat/stretch-reconnect`: reconnect with backoff plus a single catch-up fetch.
- `feat/stretch-orders-history`: persisted orders screen.
- `feat/stretch-dev-menu`: tick-rate slider and force disconnect.

---

## Part D. Review checklist for every PR (you, not Gemini)

1. Read the whole diff. Can you explain each file out loud?
2. Run `npm run typecheck && npm run lint && npm test`.
3. Run the app and try to break it: oversell, disable the network, wait for the 5-second silence.
4. For UI PRs, open the React DevTools Profiler and watch what re-renders on a tick.
5. Search the diff for `any`, `0` used as a missing price, float money math, and inline functions in list rows.
6. Ask Gemini: "What are the two biggest risks in this PR, and what did you choose not to do?"

## Part E. Time plan (3 days)

- **Day 1:** PRs 0 to 5 (domain, feed, store, API). This is the 55% of the grade you can fully test.
- **Day 2:** PRs 6 to 11 (UI primitives, Portfolio, profiling, Watchlist).
- **Day 3:** PRs 12 to 16 (Detail, orders, polish, README, video).
If you fall behind, cut the stretch goals first, then the chart polish. Never cut PR 9 or the unit tests.
