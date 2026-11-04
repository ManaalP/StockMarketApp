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
  - Conversely, `0.005` is stored as `0.0050000000000000001...`, which multiplies to `0.5000000000000001` and rounds up to `1` paise.
  - Converting once at the boundary bounds this unavoidable binary representation anomaly to input parsing, preventing it from corrupting ongoing domain arithmetic.

---

### ADR 005: Custom Indian Number Formatting (`formatINR`) Without `Intl`
- **Context**: Indian currency requires non-standard digit grouping: the rightmost 3 digits are grouped, followed by successive pairs of 2 digits (e.g., `₹12,34,567.89` for lakhs/crores).
- **Decision**: Write our own zero-dependency regex formatter in `src/domain/format.ts` using `slice(-3)` and `/\B(?=(\d{2})+(?!\d))/g`. Never rely on `Intl.NumberFormat`.
- **Trade-off**: The Hermes JavaScript engine on Android has historically bundled incomplete ICU data depending on build flags, causing `Intl` to fall back to western thousands separators (`₹1,234,567.89`) or crash on older engine distributions. A pure algorithmic string formatter guarantees 100% deterministic, hermetic rendering on all target platforms and in node-based unit tests.
