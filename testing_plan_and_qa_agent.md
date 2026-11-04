# Testing plan and QA "dummy user" agent: Live Portfolio

Companion to `GEMINI.md` and `gemini_cli_pr_playbook.md`. The detailed test cases are written **after development** (PR 17 below). What you do **now** is make the app testable, so the later work is cheap.

---

## 1. Goals

1. Prove the graded areas: **correctness** (money, late ticks, `--`, reconciliation) and **performance** (isolated re-renders).
2. Cover every flow in the spec with a repeatable test, plus the edge cases around it.
3. Have a **dummy user** that can walk the whole app on an emulator, deterministically (scripted) and exploratively (agent).
4. Keep it small enough to finish in 3 days. Unit tests first, E2E second, agent last.

## 2. Test layers

| Layer | Tool | What it covers | When it runs |
|---|---|---|---|
| Unit | Jest | `src/domain`: money, formatINR, P&L, summary, orders, tickMerge, chartPath, validation | every commit |
| Property / fuzz | Jest + `fast-check` | invariants over random inputs (see 5.2) | every commit |
| Feed and store integration | Jest + fake timers | simulator rate, late ticks, silence, batching, paused flag, per-symbol notify | every commit |
| Component / hook | `@testing-library/react-native` | rows, sheet validation, states, throttled summary, `--` rendering | every commit |
| Render-count | RNTL + render counter | one tick re-renders one row | every PR touching lists |
| E2E scripted user | **Maestro** (YAML flows) | full user journeys on emulator, both themes | before each merge to `main`, and at the end |
| Exploratory agent | Gemini CLI driving the emulator | unscripted edge-case hunting, produces bug reports | once the app is feature-complete |
| Manual | You | profiler check, visual check, video recording | end |

Why Maestro: simple YAML, no native build tweaks, works with Expo dev builds and Expo Go, readable by a reviewer. Detox is more powerful but heavier to configure; not worth it in 3 days.

## 3. Testability requirements (build these into the app now)

Ask Gemini to implement these in **PR T0** (prompt in section 8). Without them the later tests will be flaky.

1. **`testID` convention:** `screen.element[.symbol]`, e.g. `portfolio.summary.currentValue`, `portfolio.row.RELIANCE`, `portfolio.row.RELIANCE.ltp`, `portfolio.search`, `portfolio.sort.value`, `watchlist.add`, `detail.stat.open`, `order.qty`, `order.confirm`, `banner.paused`, `state.error.retry`.
2. **Deterministic simulator:** seedable RNG and injectable clock. Env/dev setting `QA_SEED`.
3. **API modes** via `EXPO_PUBLIC_API_MODE`: `live | mock | slow | fail | partial | empty | malformed`. `mock` serves a bundled fixture (all 25 symbols except OLDCO). `partial` drops some symbols.
4. **QA scenario controller** (dev builds only, not in production): a small panel and a deep link `liveportfolio://qa?...` that can:
   - `reset` (clear holdings, watchlist, orders to the seed state)
   - `silence=5000` (force the feed to go quiet now)
   - `late=0.5` (raise the late-tick ratio)
   - `rate=1|20|100` (ticks per second)
   - `drop=SYMBOL` (stop ticks for one symbol), `price=SYMBOL:null` (make a quote unavailable)
   - `freeze` (stop all ticks, to assert exact values)
   - `theme=light|dark`
5. **Fixture state:** `fixtures/` with the spec's starting holdings and a canned OHLC response, shared by Jest, Maestro, and the agent.
6. **No random UI behaviour** when `QA_SEED` is set (no random sort jitter, no random timers other than the seeded simulator).

## 4. The dummy user (three kinds)

### 4.1 Scripted personas (Maestro, deterministic)
Each persona is a set of flow files in `e2e/flows/`. Flows start with `reset` and a seed so they are repeatable.

| Persona | Behaviour | Purpose |
|---|---|---|
| **Newbie** | opens app, reads Summary, taps a row, buys 1 share, adds 2 watchlist items | happy paths |
| **Active trader** | filters, sorts by value then P&L, buys and sells repeatedly, sells everything | state consistency |
| **Chaos user** | rapid taps, double-submit, huge quantities, `0`, `-1`, `1.5`, paste text, background and foreground the app, rotate, toggle theme mid-flow, kill network, pull to refresh repeatedly | robustness |
| **Offline user** | API in `fail` mode, retry, recover | error and retry states |
| **Stale-feed user** | force silence, wait, watch the banner appear and clear, try to trade while paused | paused state |

Flow skeleton (illustrative; real flows come in PR 17):
```yaml
appId: host.exp.exponent   # or your dev-build id
---
- openLink: liveportfolio://qa?reset=1&seed=42&freeze=1
- assertVisible: { id: "portfolio.summary.currentValue" }
- assertVisible: { id: "portfolio.row.OLDCO.ltp", text: "--" }
- tapOn: { id: "portfolio.row.RELIANCE" }
- tapOn: { id: "detail.buy" }
- inputText: "10"
- tapOn: { id: "order.confirm" }
- assertVisible: "Bought 10 RELIANCE"
```

### 4.2 Property-based "random user" (fast-check, no UI)
Generates random sequences of buys and sells and random tick streams, and checks invariants after every step (list in 5.2). It finds correctness bugs no human would think to write.

### 4.3 Exploratory agent (Gemini CLI + emulator)
An LLM that behaves like a curious, slightly adversarial user for 20 to 30 minutes, then files structured bug reports. It is a **bug finder**, not a pass/fail gate: anything it finds becomes a Maestro or Jest case. Charter prompt in section 9. Guardrails: dev build only, `QA_SEED` set, scenario controller enabled, step budget, and it must record each action so every bug is reproducible.

## 5. Test case catalogue: skeleton to fill in later

IDs use `AREA-NNN`. Each area below lists **edge-case seeds** only, to jog your memory. Full cases are authored in PR 17 (section 7).

### 5.1 Areas and edge-case seeds

| Area | Layer | Edge-case seeds (not full cases) |
|---|---|---|
| **MON** money and format | Unit | 0, 0.005, 1.005, 999.995, negative zero, 1,00,000 and 1,00,00,000 grouping, very large values, NaN or Infinity input, null to `--` |
| **CALC** P&L and summary | Unit | loss, gain, flat, zero qty, avg of 0, prevClose equals ltp, unpriced row, all unpriced, one priced, rows sum equals totals after rounding, percent when invested is 0 |
| **ORD** order logic | Unit | buy new symbol, buy existing (avg rounding), sell part, sell all removes holding, sell 0, sell more than held, 1.5, -1, `"abc"`, 1e9, buy when price null, order at exact boundary |
| **FEED** simulator | Unit | rate near 20/s, seq increases per symbol, ~2% late ticks, move within ±0.2%, high/low only widen, volume never decreases, silence about once a minute for 5 s, disconnect stops, double connect |
| **STORE** price store | Integration | late tick ignored, equal seq ignored, partial tick merges, only that symbol notifies, batching coalesces, paused after >2 s, resumes on tick, seed from refresh keeps seq rules |
| **API** client | Unit | 201, 200, partial symbols, empty list, 500, 429, timeout, malformed JSON, missing `message.data`, extra fields, duplicate symbols |
| **PORT** portfolio screen | Component + E2E | loading, empty (no holdings), no filter match, error and retry, pull to refresh once, sort by each key and direction, filter case-insensitive, filter while ticking, OLDCO shows `--`, row tap opens detail |
| **SUM** summary card | Component | throttled update, unpriced note text and amount, all unpriced shows `--`, totals match rows after an order |
| **WL** watchlist | Component + E2E | add, add duplicate, remove by swipe, persists after restart, corrupt storage, empty state, symbol outside list rejected, `--` price |
| **DET** stock detail | Component + E2E | held and not held, price unavailable, paused, all stats live, chart empty then fills, buffer cap, open from Portfolio and Watchlist, back navigation |
| **SHEET** order sheet | Component + E2E | valid buy, valid sell, validation messages, double tap confirm, price changes between open and confirm (fills at last price), sell all, paused disables confirm, unavailable disables confirm, keyboard open and dismiss |
| **STATE** loading, empty, error, paused | Component + E2E | each screen, each state, retry works, banner appears and clears |
| **THEME** light and dark | E2E + visual | system switch at runtime, contrast, gain and loss never colour-only |
| **FMT** Indian formatting | Unit + E2E | every price, P&L, volume uses lakh/crore grouping |
| **PERF** performance | Render-count + manual | one tick re-renders one row plus Summary, scroll at 20 ticks/s, 100 ticks/s stress, memory stable after 5 min |
| **PERS** persistence | E2E | watchlist survives restart, holdings behaviour after restart documented |
| **A11Y** | Manual | touch targets 44 or more, labels, dynamic text size |
| **LIFE** app lifecycle | E2E | background for 30 s then resume, kill and relaunch, rotate, low connectivity |

### 5.2 Invariants for the property tests
After any sequence of orders and ticks:
1. Summary totals equal the sum of the displayed rounded rows.
2. No holding has qty <= 0, and none has a `NaN` or `Infinity` field.
3. Average price only changes on a buy, and equals the weighted formula rounded to paise.
4. An unpriced holding never contributes to any total.
5. A tick with `seq <=` the last applied seq for that symbol never changes state.
6. High is always at least ltp and low is at most ltp after merging.
7. `formatINR` output always parses back to the same paise value.

### 5.3 Test case template
```md
**ID:** SHEET-007
**Title:** Oversell is rejected with a clear message
**Spec link:** Buy/sell: no selling more than you hold
**Layer:** Component + E2E
**Preconditions:** seed 42, holding RELIANCE 25, feed frozen
**Steps:** 1. Open RELIANCE detail 2. Tap Sell 3. Enter 30
**Expected:** error "You hold 25 shares. You can't sell 30."; confirm disabled; holdings unchanged
**Edge notes:** also 26, 25 (allowed), 0, 1.5
**Status:** TODO | Automated (file path)
```

### 5.4 Spec traceability (fill the IDs later)
| Spec requirement | Test IDs |
|---|---|
| Summary: value, invested, P&L, today's P&L in ₹ and % | SUM-, CALC- |
| Holdings: live rows, green/red | PORT-, THEME- |
| Sort and filter, pull to refresh | PORT- |
| Watchlist add, swipe remove, survives restart | WL-, PERS- |
| Stock detail live fields, chart, position | DET- |
| Buy/sell validation, fill at last price, avg price | SHEET-, ORD- |
| Loading, empty, error + retry, paused | STATE- |
| Light and dark, Indian formatting | THEME-, FMT- |
| Late ticks ignored | FEED-, STORE- |
| `--` never zero, never counted | CALC-, PORT-, DET- |
| One tick, one row re-render | PERF- |
| Totals match displayed rows | CALC-, SUM- |

## 6. Where this fits in the PR plan

| PR | Branch | Content | When |
|---|---|---|---|
| **T0** | `chore/testability` | testIDs, API modes, seeded simulator, QA controller, fixtures, `fast-check` and Maestro setup | right after PR 6 (theme and primitives) |
| 1 to 5 | existing | write unit and integration tests **inside each PR** (already required) | Day 1 |
| **17** | `test/case-authoring` | write the full case catalogue from section 5 and automate it | after PR 15 |
| **18** | `test/e2e-flows` | Maestro persona flows (4.1) | after PR 17 |
| **19** | `test/exploratory-agent` | run the agent, convert findings to cases, fix bugs | after PR 18 |
| 16 | existing | README references the testing approach and results | last |

## 7. Prompts

### PR T0: make the app testable (do this early)
```
Task: testability hooks. Branch: chore/testability. Do not change user-visible behaviour.
1. Add testIDs using the convention screen.element[.symbol] to every interactive and value element
   (list in testing_plan_and_qa_agent.md section 3). Create src/testing/ids.ts exporting typed id builders
   so components and tests share them.
2. Make SimulatedFeed fully deterministic with a seedable RNG and injectable clock via QA_SEED.
3. Add EXPO_PUBLIC_API_MODE = live | mock | slow | fail | partial | empty | malformed.
   `mock` serves fixtures/ohlc.json (all 25 symbols except OLDCO).
4. Add a dev-only QA scenario controller: panel plus deep link liveportfolio://qa?reset=1&seed=42&freeze=1
   &silence=5000&late=0.5&rate=20&drop=SYMBOL&theme=dark. Compile it out of production builds.
5. Add fixtures/ (starting holdings, canned OHLC response).
6. Install and configure fast-check and Maestro. Add a smoke Maestro flow and one fast-check test.
7. Document usage in docs/TESTING.md.
Acceptance: with QA_SEED set, two runs produce identical tick sequences; each API mode works.
```

### PR 17: author the full test cases (after development)
```
Task: write the complete test-case catalogue and automate it. Branch: test/case-authoring.
Inputs: @docs/React_Native_Take-Home_Live_Portfolio.pdf, @testing_plan_and_qa_agent.md, the source in src/.
1. Read the spec and the code. For every area in section 5.1, write full cases using the template in 5.3
   and save to docs/test-cases/<AREA>.md. Expand each edge-case seed; add any you find in the code.
2. Fill the traceability matrix in docs/test-cases/TRACEABILITY.md. Every spec sentence must map to a case.
3. Automate: Jest for unit and integration, RNTL for component, render-count tests for PERF-.
   Implement the 7 property tests from section 5.2 with fast-check.
4. List any case you cannot automate and why (those go to the manual checklist).
5. Report the coverage per area and any bugs found. Fix real bugs in separate commits with a failing test first.
```

### PR 18: scripted dummy users
```
Task: Maestro persona flows. Branch: test/e2e-flows.
Create e2e/flows/ with the 5 personas from section 4.1 (newbie, trader, chaos, offline, stale-feed), each
starting with the QA deep link reset and a fixed seed. Add a run-all script and run the suite in both themes.
Each flow asserts on testIDs, never on coordinates. Screenshot on failure. Report results.
```

## 8. Exploratory QA agent charter (PR 19)

Paste this into a separate Gemini CLI session with access to an emulator (for example through Maestro or a mobile automation tool you have configured). Check your tool setup first; the agent can only click what its tools allow.

```
You are a senior QA engineer and a curious, slightly adversarial retail investor. You are testing the
"Live Portfolio" app on an emulator. Read @docs/React_Native_Take-Home_Live_Portfolio.pdf and
@docs/test-cases/TRACEABILITY.md first. The app is a dev build with the QA scenario controller.

RULES
- Start every session with: liveportfolio://qa?reset=1&seed=<N>. Record the seed.
- Time-box: 30 minutes or 150 actions. Log every action as a numbered step so any bug is reproducible.
- Never edit source code. You only observe, act, and report.
- Prefer testIDs over coordinates.

MISSIONS (do all, in any order)
1. Complete every flow in the spec as a normal user, in light and dark.
2. Break validation: 0, -1, 1.5, 1e9, empty, pasted text, emoji, leading zeros, very long input, double tap confirm.
3. Break money: sell everything then re-buy, many tiny buys, check the average price and Summary after each, check totals equal the sum of rows.
4. Break the feed: force silence, set late=0.5, rate=100, drop a symbol, make a price null, watch banners and states, try to trade while paused or unpriced.
5. Break the network: API modes fail, slow, partial, malformed. Retry, refresh repeatedly, refresh during ticks.
6. Break navigation and lifecycle: back button spam, open detail from Portfolio and Watchlist, background then resume, kill and relaunch, rotate, change the system theme at runtime.
7. Break lists: filter while ticking, sort by value and P&L while ticking (rows must not jump on every tick), clear filter, no match.
8. Watch for: "0" or blank in place of "--", NaN, wrong sign, wrong colour, non-Indian grouping, clipped text, jank, crashes, stale numbers after an order, Summary not matching rows.

REPORT (markdown, one entry per bug)
- Title, severity (blocker/major/minor), area ID (for example SHEET), seed, exact steps, expected, actual,
  screenshot name, and a suggested automated test (Jest or Maestro).
End with: coverage of the spec (which requirements you exercised), and the top 5 risks.
```

## 9. Bug report template (for your own findings)
```md
**Title:**
**Severity:** blocker | major | minor
**Area ID:**
**Build / seed / API mode:**
**Steps:** 1. 2. 3.
**Expected:**
**Actual:**
**Evidence:** screenshot or recording
**Regression test added:** file path
```

## 10. Exit criteria (before you submit)

- [ ] Unit and integration tests pass; domain coverage at least 90% lines, with every branch of `applyOrder`, `summarize`, and `mergeTick` covered
- [ ] All 7 property tests pass with a high run count (for example 1,000 runs)
- [ ] Render-count test proves one tick re-renders one row plus Summary
- [ ] All 5 Maestro personas pass in light and dark
- [ ] Exploratory agent run done, bugs triaged, no open blocker or major
- [ ] Traceability matrix has no empty row
- [ ] Manual checklist done: Profiler screenshots saved, 5-minute soak test, video recorded
- [ ] README states how to run tests (`npm test`, `npm run e2e`) and what is not covered

## 11. Caveats

- Tool details (Maestro flags, Expo Go app id, how your agent drives the emulator) vary by version and setup. Treat the YAML above as a pattern and confirm with `maestro --help` and the current docs.
- The exploratory agent finds bugs but is not proof of correctness. Your Jest and property tests are the proof; the agent is the net.
- Keep the QA controller out of production builds. Say so in the README.
