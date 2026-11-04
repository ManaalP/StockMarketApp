---
name: Precision Fiscal
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434655'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006e2d'
  on-secondary: '#ffffff'
  secondary-container: '#7cf994'
  on-secondary-container: '#007230'
  tertiary: '#ae0010'
  on-tertiary: '#ffffff'
  tertiary-container: '#d52022'
  on-tertiary-container: '#ffecea'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#7ffc97'
  secondary-fixed-dim: '#62df7d'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005320'
  tertiary-fixed: '#ffdad6'
  tertiary-fixed-dim: '#ffb4ab'
  on-tertiary-fixed: '#410002'
  on-tertiary-fixed-variant: '#93000b'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  data-metric-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.02em
  data-metric-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.01em
  data-metric-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.5rem
  gutter-md: 1rem
  margin: 1rem
  margin-sm: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers an institutional-grade, distraction-free portfolio tracking experience for Indian retail equity and F&O investors. The design language rejects speculative gamification, neon accents, decorative illustrations, gradients, and heavy skeuomorphic effects. Instead, it prioritizes absolute legibility, geometric order, and data density.

The aesthetic fuses modern high-density financial tooling with understated Swiss minimalism:
- **Tone:** Objective, dependable, analytical, calm.
- **Visual Style:** Flat and precise. Depth is constructed strictly through hairline dividers and tonal differentiation rather than drop shadows or glassmorphism.
- **Cultural Adaptability:** Built natively around the Indian financial numbering architecture (Lakhs and Crores) and INR currency notation (`₹`), ensuring layout widths and data cells are calibrated for asymmetrical digit clustering (e.g., `₹12,45,678.90`).

## Colors

The palette employs high-contrast functional roles with zero atmospheric gradients. Colors operate as pure semantic signals.

### Core Canvas & Accents
- **Light Canvas:** Pure `#FFFFFF` background with a secondary grouped surface of `#F8FAFC`.
- **Dark Canvas:** Cool blue-black `#0B0F14` background with elevated structural rows on `#11161D`.
- **Primary Action (Light):** `#2563EB` (Cobalt Blue).
- **Primary Action (Dark):** `#4F8CFF` (Electric Sky Blue).

### Semantic & Market Data Tokens
- **Gain / Profit:** `#16A34A` (Light) / `#22C55E` (Dark).
- **Loss / Deficit:** `#DC2626` (Light) / `#EF4444` (Dark).
- **Sell / Neutral Warning:** `#EA580C` (Light) / `#FB923C` (Dark).
- **Advisory Warning Surface:** Text `#B45309`, filled background `#FEF6E7` (Light) / Text `#FBBF24`, background `#2D2012` (Dark).

### Typography & Dividers
- **Text Primary:** `#0F172A` (Light) / `#F1F5F9` (Dark).
- **Text Secondary / Muted:** `#64748B` (Light) / `#94A3B8` (Dark).
- **Text Tertiary / Placeholder:** `#94A3B8` (Light) / `#64748B` (Dark).
- **Hairline Divider:** 1px solid `#E2E8F0` (Light) / 1px solid `#1E293B` (Dark).

## Typography

The type scale relies exclusively on `Inter`. All numerical surfaces (prices, P&L percentages, lots, holding balances) must strictly implement:
```css
font-variant-numeric: tabular-nums lining-nums;
```
This guarantees vertical decimal alignment across multi-line holding feeds and table rows.

### Number Formatting Protocol
- All financial balances are prefixed with `₹` using the standard Indian numbering system: thousands (`₹1,000`), Lakhs (`₹1,00,000`), and Crores (`₹1,00,00,000`).
- Compact abbreviations are allowed only on constrained micro-chips: `L` for Lakhs (e.g., `₹4.25L`) and `Cr` for Crores (e.g., `₹1.12Cr`).
- Data labels must render in uppercase with positive letter tracking (+0.04em) at `11px` to enforce rapid eye-scanning without visual fatigue.

## Layout & Spacing

Designed for mobile portrait viewports (baseline target: 390x844pt) with strict adhesion to an 8-point layout rhythm (4-point micro-scale for alignment).

- **Screen Canvas:** Fixed edge margin of `16px` (`margin: 1rem`) on outer containers. Content lists span the full screen width (`390px`) with edge-to-edge separators, while interactive content inside rows conforms to horizontal paddings of `16px`.
- **List Heights:** Full-width holding, positions, and watchlist rows are locked to a strict height bracket of `68px` to `72px` to optimize vertical reachability and rhythmic one-handed thumb navigation.
- **Section Rhythm:**
  - Header metric blocks: 24px vertical padding.
  - Section-to-section gap: 32px (`space-xl`).
  - Row internal gap between stock ticker and current price: Flex-between with minimum `16px` safe gutter.

## Elevation & Depth

Visual hierarchy uses a purely planar model. Zero dropshadows, zero blurred underlays, and zero floating dimensional surfaces.

- **Planar Stacking:** Surfaces remain flat. Modals, bottom sheets, and sticky total-value summary bars rest directly against the page surface separated solely by a 1px border (`#E2E8F0` Light / `#1E293B` Dark).
- **Hairline Framing:** All data isolation is managed through exact 1px hairline dividers. When grouping is required, items share a unified outline container rather than floating as individual soft-shadow cards.
- **State Feedback:** Pressed and active states do not project elevation; they shift surface fill directly (Light: `#F1F5F9`; Dark: `#1E293B`) with immediate 0.1s linear response.

## Shapes

The geometry balances soft utility with strict tabular order. The base corner radius is fixed at `8px` (`0.5rem` / roundedness level `2`).

- **Base Cards and Containers:** `8px` corner radius.
- **Form Inputs and Buttons:** `8px` corner radius.
- **Pills and Badges:** P&L change indicators and exchange identification tags (e.g., `NSE`, `BSE`) use a constrained micro-radius of `4px` (`rounded-sm`) to preserve tabular vertical flow.
- **Full-bleed Components:** Watchlist rows, market tickers, and sticky action headers maintain square `0px` outer contours with internal `8px` interaction states.

## Components

### Iconography Standard
All system icons are monoline 1.5px stroke vector glyphs rendered in slate tones (`#64748B` Light, `#94A3B8` Dark). No multi-color fills, duotone backgrounds, or drop shadows.

### Buttons
- **Primary:** Solid `#2563EB` (Light) / `#4F8CFF` (Dark) background, white text, 48px height, 8px corner radius, bold 14px typography. Zero shadow.
- **Secondary / Ghost:** Transparent background with 1px border (`#E2E8F0` Light, `#1E293B` Dark), text `#0F172A` (Light) / `#F1F5F9` (Dark).
- **Direct Trading Action (Buy / Sell):** Buy is signaled via primary or neutral actions; Sell buttons use flat `#EA580C` on interactive trade drawers.

### Stock Holding List Rows (68px – 72px)
- **Geometry:** 100% full-width, 68px minimum height, separated by a 1px hairline divider along the bottom edge.
- **Left Column:** Ticker symbol in `data-metric-md` (`#0F172A` / `#F1F5F9`), followed by holding quantity and average purchase price in `body-sm` (`#64748B` / `#94A3B8`).
- **Right Column:** Current market price in `data-metric-md` aligned right with `tabular-nums`, followed by total returns formatted in Lakhs/Crores and percentage change in `gain` (`#16A34A`) or `loss` (`#DC2626`).

### Input Fields
- **Container:** 48px height, 8px radius, flat background (`#FFFFFF` Light, `#0B0F14` Dark), 1px stroke (`#CBD5E1` Light, `#334155` Dark).
- **Focus:** Sharp 1px ring `#2563EB` (no offset, no blur).
- **Numerical Entry:** Left-anchored `₹` prefix in fixed muted slate with oversized tabular numerals (20px).

### Chips & Filter Tabs
- **Height:** 32px height, 8px radius.
- **Unselected:** Transparent fill, 1px border `#E2E8F0` (Light) / `#1E293B` (Dark), text `#64748B`.
- **Selected:** Flat `#0F172A` with `#FFFFFF` text (Light) / `#F1F5F9` with `#0B0F14` text (Dark). No shadows.

### Warning & Compliance Banner
- **Geometry:** 8px radius, padded with 12px horizontal and 10px vertical.
- **Palette:** `#FEF6E7` background with `#B45309` typography (Light) / `#2D2012` background with `#FBBF24` typography (Dark).
- **Usage:** SEBI advisories, market holiday notices, and circuit breaker status.