# Architecture Decisions Record (ADR)

This file tracks non-obvious technical decisions, architecture trade-offs, and rationale for the Live Portfolio application.

---

### ADR 001: Strict TypeScript and `noUncheckedIndexedAccess`
- **Context**: The app consumes live feeds (~20 ticks/s) updating an arbitrary set of 25 symbols. Accessing symbol maps (`quotes[symbol]`) or arrays without bounds-checking risks runtime exceptions under Hermes.
- **Decision**: Enforce `"strict": true` and `"noUncheckedIndexedAccess": true` in `tsconfig.json`. Enforce `@typescript-eslint/no-explicit-any: "error"` and `@typescript-eslint/ban-ts-comment: "error"` in ESLint.
- **Trade-off**: Requires explicit narrowing and undefined handling when accessing collections, but eliminates `TypeError: Cannot read properties of undefined` in production.

---

### ADR 002: Expo SDK 52 + Expo Router
- **Context**: Need standard cross-platform navigation with deep linking, modal sheets, and optimal bundle size.
- **Decision**: Use Expo SDK 52 with `expo-router` v4 (file-based tabs and stack navigation).
- **Trade-off**: Requires adhering to file-based routing conventions, which clean up boilerplate and separate navigation concerns from business logic.

---

### ADR 003: `react-native-wagmi-charts` for Stock Detail Live Chart
- **Context**: PR 13 requires a live stock chart plotting received ticks with touch scrubbing.
- **Decision**: Integrate `react-native-wagmi-charts` powered by `react-native-reanimated` and `react-native-gesture-handler`.
- **Trade-off**: Reanimated runs gestures and crosshair animations directly on the UI thread, freeing the JavaScript thread to process high-frequency price feed ticks (~20/s) without frame drops.
