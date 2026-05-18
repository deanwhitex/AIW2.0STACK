# Design Fidelity Checklist - Universal Layer

This is the niche-agnostic floor that ships with the factory shell.
Every per-client build is scored against this layer PLUS the per-niche
layer at `templates/{active-niche-slug}/.claude/checklists/design-fidelity.md`
(which Module 2D generates from the niche wireframe + design tokens).

The design-fidelity-qa-agent merges both layers at runtime. Items here
apply to every build regardless of niche. Items in the per-niche layer
carry the wireframe-specific region weights + per-section composition
thresholds.

The fidelity score is computed as SSIM (structural similarity) between
a Playwright screenshot of the per-client build and a headless render
of `templates/{active-niche-slug}/` with the client's brand-dna applied.

---

## Universal HARD halts (override the 0.90 gate; not overridable)

- [ ] **U-H-1, Reference render produced cleanly**.
      `tools/render-template-reference.py --client "[X]"` exited 0
      AND wrote `qa-screenshots/reference-desktop.png` +
      `qa-screenshots/reference-mobile.png`.
      Fix: if the reference build failed, the per-niche template is
      broken (failing Vite build OR brand-dna validator). Fix at
      source; this QA cannot proceed.
- [ ] **U-H-2, Per-client `npm run build` succeeds**.
      The build output `clients/[X]/[X] Website/dist/` exists and
      `index.html` is present.
      Fix: trace the build error; QA cannot diff a missing build.

---

## Universal fidelity items

### Layout integrity

- [ ] **U-1, Section order matches the per-niche `HomePage.jsx` declared order**.
      Every section in the niche template's HomePage.jsx appears on
      the rendered page in the same order. No section reordered, no
      section dropped without a brand-dna `manual_overrides` reason.
      Weight: 2x.
- [ ] **U-2, No section overflows its container at any breakpoint**.
      Test at 1440px desktop + 1024px tablet + 375px mobile. No
      element extends outside its parent's padding box.
- [ ] **U-3, Section spacing matches the niche template's spacing token scale**.
      Top + bottom padding on each section uses the niche template's
      declared `section-gap` / `section-gap-lg` utilities. No inline
      `style={{ paddingTop }}` overrides.

### Typography fidelity

- [ ] **U-4, Heading hierarchy matches the niche template**.
      Same `text-{N}xl` / heading utility classes per section.
      Weight: 1.5x.
- [ ] **U-5, Variable-font opsz axis is applied**.
      If the niche template uses a variable display font (e.g.
      Fraunces 9..144), `font-optical-sizing: auto` is set globally
      and the opsz axis renders at the correct size per breakpoint.
- [ ] **U-6, Line-height + tracking match the niche template**.
      Display headings use the niche template's `leading-display` +
      `tracking-display` utilities; body copy uses `leading-body`.

### Colour + theme fidelity

- [ ] **U-7, Palette derives from `brand-dna.json` via CSS variables**.
      No hardcoded hex values in JSX. The `:root` block is rewritten
      from brand-dna at build time.
- [ ] **U-8, Light/dark theme support matches `niche-playbook/theme.json`**.
      If the niche supports both modes, the toggle works at runtime.
      If the niche is single-mode, the toggle is absent.
- [ ] **U-9, Accent colour passes WCAG AA contrast against background + foreground**.

### Motion fidelity

- [ ] **U-10, Premium easings replace bounce-spring defaults**.
      No `cubic-bezier(0.34, 1.56, 0.64, 1)` in any animation. Use
      `ease-premium-out` / `ease-premium-in` utilities the niche
      template ships.
- [ ] **U-11, Scroll reveals fire per the niche template's motion preset**.
      Sections fade-up on intersection at 200ms ease-out (or per the
      niche's motion preset).
- [ ] **U-12, Hover lift on cards matches the niche template**.
      Card elevation utilities give the same lift the niche template
      ships; no inline `transform: translateY` overrides.

### Asset fidelity

- [ ] **U-13, Hero image desktop variant >= 1920x1080**.
- [ ] **U-14, Hero image mobile variant >= 828x1200**.
- [ ] **U-15, Logo renders crisp at every breakpoint**.
      SVG preferred; PNG accepted at 2x density.
- [ ] **U-16, No `[BRACKET]` placeholder strings anywhere on the page**.

### Composition (per-region SSIM diff)

The aggregate fidelity score is the weighted mean of per-region SSIM
scores. Region weights + per-region thresholds come from the per-niche
layer (Module 2D writes them from the niche wireframe + `09-template-
spec.md` fidelity table).

Universal defaults applied when the per-niche layer is silent:

- Hero region: weight 1.5x, threshold >= 0.92
- Above-fold trust signal surface: weight 1.5x, threshold >= 0.95
- All other sections: weight 1x, threshold >= 0.88

The aggregate target is >= 0.90 (weighted mean).

---

## How this layer composes with the per-niche layer

The design-fidelity-qa-agent reads the universal layer first, then
concatenates the per-niche layer at
`templates/{active-niche-slug}/.claude/checklists/design-fidelity.md`.

Per-niche items carry:

- The complete region list (every section in the niche wireframe)
- Per-region SSIM thresholds (Module 2D writes from
  `09-template-spec.md`)
- Per-region weights (Module 2D writes from the niche playbook's
  conversion-critical ranking)
- Per-component layout-variant checks (split-screen vs centered vs
  full-bleed; the niche wireframe declares which)
- Niche-specific decorative motif placement (background SVGs, corner
  overlays)

These do NOT belong in the universal layer.
