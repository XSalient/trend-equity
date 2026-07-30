---
name: Trend Equity
colors:
  surface: '#0e1511'
  surface-dim: '#0e1511'
  surface-bright: '#343b36'
  surface-container-lowest: '#09100c'
  surface-container-low: '#161d19'
  surface-container: '#1a211d'
  surface-container-high: '#242c27'
  surface-container-highest: '#2f3632'
  on-surface: '#dde4dd'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dde4dd'
  inverse-on-surface: '#2b322d'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#5de6ff'
  on-secondary: '#00363e'
  secondary-container: '#00cbe6'
  on-secondary-container: '#00515d'
  tertiary: '#f9bd22'
  on-tertiary: '#402d00'
  tertiary-container: '#ce9a00'
  on-tertiary-container: '#4a3500'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#a2eeff'
  secondary-fixed-dim: '#2fd9f4'
  on-secondary-fixed: '#001f25'
  on-secondary-fixed-variant: '#004e5a'
  tertiary-fixed: '#ffdf9f'
  tertiary-fixed-dim: '#f9bd22'
  on-tertiary-fixed: '#261a00'
  on-tertiary-fixed-variant: '#5c4300'
  background: '#0e1511'
  on-background: '#dde4dd'
  surface-variant: '#2f3632'
typography:
  display:
    fontFamily: Archivo Narrow
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Archivo Narrow
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Archivo Narrow
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Archivo Narrow
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
  mono-data:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: '0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-margin: 16px
  gutter: 12px
---

## Brand & Style
The design system for this product is engineered for high-velocity decision-making in the startup ecosystem. It targets founders, investors, and analysts who require a high-density, data-driven environment that feels authoritative and urgent. 

The aesthetic is **High-Contrast Modernism** with a **Technical/Developer** edge. It leverages a deep, monochromatic foundation to make signal-based data points vibrate with importance. The personality is professional and unsentimental, stripping away decorative fluff in favor of raw information clarity. High-contrast accents and sharp geometry evoke a sense of precision and "bleeding edge" technology.

## Colors
The palette is built on a "Total Dark" architecture. Backgrounds utilize a near-black Zinc (#09090b) to ensure maximum contrast for accent colors. 

- **Primary (Emerald):** Used for primary actions, success states, and growth indicators.
- **Evidence (Cyan):** Dedicated to verified data, citations, and structural "proof" points.
- **Signal (Amber-to-Coral):** A high-energy gradient reserved exclusively for "Heat" and "Live" market signals. This color should be used sparingly to prevent visual fatigue.
- **Borders:** A consistent 1px Zinc (#27272a) is used to define structure without creating heavy visual noise.

## Typography
The typographic strategy balances raw impact with technical legibility. 

**Headlines** use *Archivo Narrow* in heavy weights and italics. This creates a "newsroom urgency" and a sense of forward momentum. Letter-spacing is intentionally tight to keep the data-dense UI feeling cohesive.

**Body and Data** use *Geist*. This provides a clean, monospaced-influenced feel that suggests technical accuracy. For body text, line heights are kept generous (1.5 - 1.6x) to ensure readability against the dark background, preventing "halation" (where white text appears to glow/blur on black).

## Layout & Spacing
This design system follows a **Mobile-First Fluid Grid**. Given the data-rich nature of the app, spacing is disciplined and based on a 4px baseline grid.

- **Mobile:** Single column with 16px side margins. Cards span the full width minus margins.
- **Desktop:** 12-column grid. Information is organized into modular "Dashboard" panes.
- **Rhythm:** Use "Lg" (24px) spacing between major sections and "Sm" (8px) for internal element grouping. The goal is to maximize information density while using sharp margins to maintain a sense of order.

## Elevation & Depth
Depth in this system is achieved through **Tonal Layering** and **Subtle Outlines** rather than traditional shadows.

- **Level 0 (Base):** #09090b.
- **Level 1 (Cards/Surfaces):** #18181b with a 1px border of #27272a.
- **Level 2 (Modals/Popovers):** #18181b with a brighter 1px border of #3f3f46 and a very faint, 20% opacity black shadow to slightly separate from the surface.

Do not use blurs or frosted glass. The intent is to look like a high-end terminal or industrial interface—matte, flat, and structured.

## Shapes
The shape language is **Technical and Precise**. The default roundedness is "Soft" (0.25rem/4px) for UI elements like buttons and input fields. This is enough to prevent the UI from feeling aggressive but sharp enough to maintain a professional, "engineered" look. 

Larger containers (Cards) use a slightly more pronounced 8px radius to subtly distinguish them from the background structure.

## Components

### Buttons
- **Primary:** Background Emerald (#10b981), Text Black (#000), Weight 600. No shadow.
- **Secondary:** Border #27272a, Background Transparent, Text White.
- **Signal:** Background is the Signal Gradient, Text Black. Reserved for "Analyze" or "Live Feed" triggers.

### Data Ribbons & Signals
- Used for market alerts. These should be thin, full-bleed strips using the Signal Gradient with scrolling "Ticker" text using the `mono-data` typography style.

### Cards
- Use #18181b background. Header sections of cards should have a 1px bottom border of #27272a. Card titles must use `headline-md`.

### Input Fields
- Background #09090b (inset feel), 1px border #27272a. Focus state: Border color shifts to Primary Emerald (#10b981) with a 1px solid outer ring.

### Evidence Tags (Chips)
- Small, uppercase labels. Background: #22d3ee at 10% opacity. Text: #22d3ee. Border: 1px #22d3ee at 20% opacity.

### Lists
- High-density. Each row separated by a 1px #27272a border. Active/Hover state: Background shifts to #1d1d20.