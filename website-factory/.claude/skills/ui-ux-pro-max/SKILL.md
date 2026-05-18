---
name: ui-ux-pro-max
description: UI/UX design intelligence. 67 styles, 96 palettes, 57 font pairings, 25 charts, 13 stacks (React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, Tailwind, shadcn/ui). Actions: plan, build, create, design, implement, review, fix, improve, optimize, enhance, refactor, check UI/UX code. Projects: website, landing page, dashboard, admin panel, e-commerce, SaaS, portfolio, blog, mobile app, .html, .tsx, .vue, .svelte. Elements: button, modal, navbar, sidebar, card, table, form, chart. Styles: glassmorphism, claymorphism, minimalism, brutalism, neumorphism, bento grid, dark mode, responsive, skeuomorphism, flat design. Topics: color palette, accessibility, animation, layout, typography, font pairing, spacing, hover, shadow, gradient.
---

# UI/UX Pro Max - Design Intelligence

Comprehensive design guide for web and mobile applications. Contains 67 styles, 96 color palettes, 57 font pairings, 99 UX guidelines, and 25 chart types across 13 technology stacks. Searchable database with priority-based recommendations.

## Searchable Database (CLI)

The full database is queryable via Python from the project root:

```bash
# Design system (recommended starting point)
python3 .claude/skills/ui-ux-pro-max/ui-ux-pro-max-skill-main/src/ui-ux-pro-max/scripts/search.py "<product_type> <keywords>" --design-system

# Domain search
python3 .claude/skills/ui-ux-pro-max/ui-ux-pro-max-skill-main/src/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain>

# Stack guidelines
python3 .claude/skills/ui-ux-pro-max/ui-ux-pro-max-skill-main/src/ui-ux-pro-max/scripts/search.py "<keyword>" --stack <stack>
```

**Available domains:** `product`, `style`, `typography`, `color`, `landing`, `chart`, `ux`, `react`, `web`, `prompt`

**Available stacks:** `html-tailwind`, `react`, `nextjs`, `astro`, `vue`, `nuxtjs`, `svelte`, `swiftui`, `react-native`, `flutter`, `shadcn`, `jetpack-compose`

**Example for roofing contractor landing page:**
```bash
python3 .claude/skills/ui-ux-pro-max/ui-ux-pro-max-skill-main/src/ui-ux-pro-max/scripts/search.py "contractor service landing dark premium" --design-system
python3 .claude/skills/ui-ux-pro-max/ui-ux-pro-max-skill-main/src/ui-ux-pro-max/scripts/search.py "hero CTA social-proof testimonial" --domain landing
python3 .claude/skills/ui-ux-pro-max/ui-ux-pro-max-skill-main/src/ui-ux-pro-max/scripts/search.py "dark premium" --domain style
```

---

## When to Apply

Use this skill for any task involving UI structure, visual design decisions, interaction patterns, or UX quality control.

### Must Use
- Designing new pages (Landing Page, Dashboard, SaaS, Mobile App)
- Creating or refactoring UI components (buttons, modals, forms, tables, charts)
- Choosing color schemes, font systems, spacing, or layout systems
- Reviewing UI code for UX, accessibility, or visual consistency
- Making product-level design decisions (style, hierarchy, brand expression)

### Skip
- Pure backend logic
- API or database design only
- Infrastructure or DevOps
- Non-visual scripts or automation

---

## Rule Categories by Priority

| Priority | Category | Impact | Domain | Key Checks | Anti-Patterns |
|----------|----------|--------|--------|------------|---------------|
| 1 | Accessibility | CRITICAL | `ux` | Contrast 4.5:1, Alt text, Keyboard nav, Aria-labels | Removing focus rings, Icon-only buttons without labels |
| 2 | Touch & Interaction | CRITICAL | `ux` | Min size 44x44px, 8px+ spacing, Loading feedback | Hover-only interactions, Instant state changes (0ms) |
| 3 | Performance | HIGH | `ux` | WebP/AVIF, Lazy loading, Reserve space (CLS < 0.1) | Layout thrashing, Cumulative Layout Shift |
| 4 | Style Selection | HIGH | `style`, `product` | Match product type, Consistency, SVG icons (no emoji) | Mixing flat and skeuomorphic randomly |
| 5 | Layout & Responsive | HIGH | `ux` | Mobile-first breakpoints, No horizontal scroll | Fixed px container widths, Disable zoom |
| 6 | Typography & Color | MEDIUM | `typography`, `color` | Base 16px, Line-height 1.5, Semantic color tokens | Text < 12px body, Gray-on-gray, Raw hex in components |
| 7 | Animation | MEDIUM | `ux` | Duration 150-300ms, Motion conveys meaning | Decorative-only animation, Animating width/height |
| 8 | Forms & Feedback | MEDIUM | `ux` | Visible labels, Error near field, Progressive disclosure | Placeholder-only label, Errors only at top |
| 9 | Navigation Patterns | HIGH | `ux` | Predictable back, Bottom nav 5 max, Deep linking | Overloaded nav, Broken back behavior |
| 10 | Charts & Data | LOW | `chart` | Legends, Tooltips, Accessible colors | Relying on color alone to convey meaning |

---

## Quick Reference

### 1. Accessibility (CRITICAL)
- Minimum 4.5:1 contrast ratio for normal text (large text 3:1)
- Visible focus rings on all interactive elements (2-4px)
- Descriptive alt text for all meaningful images
- aria-label for icon-only buttons
- Tab order matches visual order; full keyboard support
- Don't convey information by color alone
- Support system text scaling; avoid truncation as text grows
- Respect prefers-reduced-motion

### 2. Touch & Interaction (CRITICAL)
- Min 44x44pt (iOS) / 48x48dp (Android) touch targets
- Minimum 8px gap between touch targets
- Use click/tap for primary interactions; don't rely on hover alone
- Disable button during async operations; show spinner or progress
- Clear error messages near the problem field
- Visual feedback on press within 100ms

### 3. Performance (HIGH)
- Use WebP/AVIF for images; declare width/height to prevent layout shift
- font-display: swap to avoid invisible text during font load
- Lazy load non-hero components
- Virtualize lists with 50+ items
- Keep per-frame work under ~16ms for 60fps
- Use skeleton screens for >1s operations

### 4. Style Selection (HIGH)
- Match style to product type (run `--design-system` for recommendations)
- Consistent style across all pages; no mixing flat + skeuomorphic
- SVG icons only (Heroicons, Lucide, Phosphor); never emojis as icons
- Make hover/pressed/disabled states visually distinct

### 5. Layout & Responsive (HIGH)
- viewport meta: width=device-width initial-scale=1 (never disable zoom)
- Mobile-first; systematic breakpoints (375 / 768 / 1024 / 1440)
- Minimum 16px body text on mobile
- 4pt/8dp spacing system
- Consistent max-width on desktop (max-w-6xl / 7xl)
- min-h-dvh instead of 100vh on mobile

### 6. Typography & Color (MEDIUM)
- Line height 1.5-1.75 for body text
- 65-75 characters per line maximum
- Define semantic color tokens; no raw hex in components
- Font weight hierarchy: Bold headings (600-700), Regular body (400), Medium labels (500)
- Test dark mode contrast independently

### 7. Animation (MEDIUM)
- Duration 150-300ms for micro-interactions; complex transitions max 400ms
- Use transform/opacity only; never animate width/height/top/left
- ease-out for entering elements; ease-in for exiting
- Every animation must express a cause-effect relationship
- Exit animations shorter than enter (~60-70% of enter duration)
- Stagger list/grid entrance by 30-50ms per item

### 8. Forms & Feedback (MEDIUM)
- Visible label per input (never placeholder-only)
- Show error below the related field, not at the top only
- Validate on blur, not keystroke
- Mark required fields
- Auto-dismiss toasts in 3-5s
- Confirm before destructive actions

### 9. Navigation Patterns (HIGH)
- Bottom navigation max 5 items with labels + icons
- Back navigation predictable and consistent; preserve scroll/state
- Current location highlighted in navigation
- Modals must offer a clear close affordance
- Don't use modals for primary navigation flows

### 10. Charts & Data (LOW)
- Match chart type to data type (trend = line, comparison = bar, proportion = pie/donut)
- Use accessible color palettes; avoid red/green-only pairs
- Provide text summary for screen readers
- Show meaningful empty state when no data

---

## Pre-Delivery Checklist

### Visual Quality
- [ ] No emojis used as icons
- [ ] All icons from a consistent family and style
- [ ] Semantic theme tokens used consistently (no ad-hoc hardcoded colors)
- [ ] Pressed states don't shift layout bounds

### Interaction
- [ ] All tappable elements have clear pressed feedback
- [ ] Touch targets meet minimum size (44x44pt iOS / 48x48dp Android)
- [ ] Micro-interaction timing 150-300ms with native-feeling easing
- [ ] Disabled states visually clear and non-interactive

### Light/Dark Mode
- [ ] Primary text contrast >= 4.5:1 in both modes
- [ ] Secondary text contrast >= 3:1 in both modes
- [ ] Both themes tested before delivery

### Layout
- [ ] Safe areas respected for headers, tab bars, bottom CTA bars
- [ ] Scroll content not hidden behind fixed/sticky bars
- [ ] Verified on small phone, large phone, and tablet

### Accessibility
- [ ] All meaningful images/icons have accessibility labels
- [ ] Form fields have labels, hints, and clear error messages
- [ ] Color is not the only indicator
- [ ] Reduced motion and dynamic text size supported
