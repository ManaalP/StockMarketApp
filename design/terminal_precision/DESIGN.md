---
name: Terminal Precision
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
  display-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  tabular-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  tabular-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0em
  tabular-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  label-xs:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.06em
spacing:
  gutter: 0.75rem
  gutter-desktop: 1rem
  margin: 0.75rem
  margin-desktop: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system establishes an ultra-flat, utilitarian trading terminal interface tailored specifically for Indian capital markets. It eschews decorative trends—forbidding drop shadows, skeuomorphism, ambient blurs, and gradient fills—in favor of structural discipline, pure data density, and uncompromising legibility. 

The aesthetic is grounded in the tradition of high-performance financial terminals: stark 1px grid networks, fixed information hierarchy, zero elevation shifts, and absolute optical predictability. The target user base demands instant visual parsing of complex positions, market depth (L2/L3 books), P&L metrics, and order routing states under high-stress, rapid-execution market conditions. Every pixel serves a communicative function; decoration is considered cognitive noise.

## Colors

The palette is engineered for rapid state identification and strict WCAG AA contrast compliance across both Light and Dark paradigms. 

### Core Semantic Roles

- **Primary Action & Navigation (Accent Blue):** `#2563EB` (Light) / `#4F8CFF` (Dark). Strictly reserved for affirmative primary actions (`BUY`), primary active tab indicators, and critical navigational hyperlinks. Never used for decorative accents or passive status indicators.
- **Gain / Long Execution (Green):** `#16A34A` (Light) / `#3DD68C` (Dark). Used exclusively for positive P&L shifts, LTP upticks, bid depth dominances, and completed executions.
- **Loss / Short Pressure (Red):** `#DC2626` (Light) / `#FF6B6B` (Dark). Applied strictly to negative P&L metrics, LTP downticks, ask depth dominances, and system-level rejections/errors.
- **Sell / Square-Off (Orange):** `#EA580C` (Light) / `#FB923C` (Dark). Explicitly dedicated to the `SELL` execution workflow, square-off triggers, and trailing stop modifications.

### Surfaces & Structural Dividers

- **Canvas Background:** `#FFFFFF` (Light) / `#0B0F15` (Dark).
- **Surface Level 1 (Panels, Rows, Data Grids):** `#F8FAFC` (Light) / `#121820` (Dark).
- **Surface Level 2 (Selected Rows, Active Cell Highlights):** `#EDF2F7` (Light) / `#1A222C` (Dark).
- **Hairline Dividers (1px Structural Borders):** `#E5E9F0` (Light) / `#232B35` (Dark). Must be applied with 0px blur and exact 1px solid definitions.

### Typography & Contrast Tokens

- **Text High-Contrast (Headings, LTP, Primary Quantities):** `#0F172A` (Light) / `#F1F5F9` (Dark).
- **Text Muted / Secondary (Labels, Subtitles, Timestamps, Exchange Tags):** `#475569` (Light) / `#94A3B8` (Dark), achieving a contrast ratio of > 4.5:1 against respective panel surfaces.

## Typography

The typography is built entirely on **Inter** to ensure mechanical alignment and low-latency legibility across high-density data tables.

### Font Feature Settings
Every numeric display, price feed, order depth count, and P&L metric must enforce the following OpenType features:
- `font-feature-settings: "tnum" 1, "cv05" 1, "cv11" 1` (Tabular Numbers enabled globally for financial metrics, disambiguated `l`, and slashed zero).
- Proportional figures are strictly forbidden in quote screens, portfolio summaries, and transaction tables.

### Indian Numbering Format Rule
All currency and positional volume figures must strictly adhere to the Indian numbering system using the Indian Rupee symbol (`₹`):
- Format structure: `₹[Hundreds],[Lakhs],[Thousands].[Decimals]`
- Example output: `₹12,34,567.89`
- Integer quantities: `10,00,000 shares` (never `1,000,000`).
- Positive P&L shifts must be explicitly prefixed with a `+` symbol (`+₹14,250.00`), while negative shifts retain the standard minus prefix (`-₹8,120.45`). Zero values must render without sign in neutral text tone (`₹0.00`).

## Layout & Spacing

The layout philosophy follows a rigid, non-floating, boundary-defined structural grid modeled after financial terminal workbenches. Content does not "float" in empty space; it is locked within 1px bounded viewports.

### Grid & Breakpoints

- **Mobile Viewport (<768px):** Single-column layout. Header sticky at top; primary metrics fixed; ticker strip docked. Gutters fixed at `0.75rem` (`12px`) with zero margin padding on edge-to-edge data tables.
- **Tablet / Split Viewport (768px - 1024px):** 2-pane fixed layout (Watchlist / Depth split on 40/60 ratio). Gutters fixed at `0.75rem`.
- **Desktop Workbench (>1024px):** 3-pane fixed data workbench:
  - Watchlist pane: fixed `340px`.
  - Main Chart / Execution Book pane: fluid width.
  - Position & Order Matrix: fixed bottom drawer or right docked pane (`360px`).
  - Columns strictly separated by `1px` solid divider lines, bypassing traditional empty whitespace gutters.

### Layout Density Principles
- Padding within table cells is constrained to `space-xs` vertically and `space-sm` horizontally to achieve maximum visible data rows above the fold.
- Margins between modular panels are replaced by explicit structural 1px hairline dividers.

## Elevation & Depth

This design system uses an **absolute zero-elevation model**.

- **No Shadows:** `box-shadow: none` is enforced across all components, popovers, dropdowns, and modals.
- **No Gradients:** Backgrounds, button surfaces, and progress meters are 100% solid flat fills.
- **Hairline Bounding Technique:** Spatial separation, modular grouping, and visual stacking are accomplished solely through:
  - 1px hairline borders (`#E5E9F0` light, `#232B35` dark).
  - Background surface contrast (toggling between `#FFFFFF` and `#F8FAFC` in light mode, or `#0B0F15` and `#121820` in dark mode).
- **Overlays & Modals:** When dialogs or quick-order slips overlay the interface, they use a solid 1px border perimeter without drop shadows. The backdrop overlay is a flat `#000000` with strict 50% opacity, completely devoid of backdrop blur (`backdrop-filter: none`).

## Shapes

The design system enforces a **0px (Sharp)** corner model across the entire application footprint. 

- All containers, order execution slips, buttons, tabs, input fields, badges, and notification bars utilize strictly unrounded corners (`border-radius: 0px`).
- Sharp corners maximize usable screen area within table cells, align perfectly to the 1px grid coordinate lines, and evoke the precision of institutional trading systems.

## Components

### Buttons
- **Buy Primary:** Solid Accent Blue (`#2563EB` light, `#4F8CFF` dark). Text: Pure White (`#FFFFFF`) or Dark Black (`#0B0F15` dark mode). `border-radius: 0px`. Height: `36px` (desktop), `44px` (mobile touch target). Font weight: 600.
- **Sell Primary:** Solid Sell Orange (`#EA580C` light, `#FB923C` dark). Text: `#FFFFFF` / `#0B0F15`. `border-radius: 0px`.
- **Secondary / Outline:** Background transparent. 1px solid hairline divider token border. Text: High-contrast neutral. On hover: Surface Level 1 fill.
- **Ghost:** Background transparent. Zero borders. Text: Muted neutral. On hover: High-contrast neutral text with Surface Level 1 background.

### Navigation & Tabs
- Horizontal tab headers sit on a single continuous 1px bottom border.
- **Active Tab:** Underlined by an exact 2px Accent Blue line extending only across the width of the tab label or container. Text color shifts to Accent Blue with semi-bold weight. No pill capsules or rounded backgrounds.

### Data Tables & Portfolio Lists
- Edge-to-edge rendering without outer rounded corners or card framing.
- Header row: Surface Level 1 background, uppercase 10px or 11px label font (`label-xs` or `label-sm`), muted text token, 1px bottom hairline border.
- Data rows: Single-line height of `36px` to `40px`. Alternating or hover state uses Surface Level 2. Bottom border: 1px hairline divider.
- Right-aligned tabular numeric values for Price (LTP), Quantity, Net Change, and Total Value.

### Input Fields
- Flat rectangular containers (`border-radius: 0px`) bounded by a 1px hairline border.
- Background: Surface Level 1.
- Focus State: 1px solid Accent Blue border. Zero glow, zero focus ring shadow.
- Number inputs for Lots, Limit Price, and Trigger Price must display a monospaced/tabular numerical display with step increment triggers embedded inside the border matrix.

### Chips & Badges
- Strict flat rectangles: `border-radius: 0px`, height `20px` to `22px`.
- Status Indicators (e.g., `MIS`, `CNC`, `NRML`, `LIMIT`, `MARKET`): 1px border matching the text color, 0% opacity background (outline style) or 10% tinted background with 100% solid text. No rounded pills.

### Floating Cards (Disallowed)
- Floating elevated cards are replaced by **Tiled Dock Panes**. Every pane is bordered on relevant sides by a 1px solid hairline line, creating an interlocking data grid across the entire canvas.