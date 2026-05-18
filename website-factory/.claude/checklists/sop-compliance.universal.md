# SOP Compliance Checklist - Universal Layer

This is the niche-agnostic floor that ships with the factory shell.
Every per-client build is scored against this layer PLUS the per-niche
layer at `templates/{active-niche-slug}/.claude/checklists/sop-compliance.md`
(which Module 2D generates from the niche wireframe).

The sop-qa-agent merges both layers at runtime. Items here apply to
every build regardless of niche. Items in the per-niche layer carry
the wireframe-specific checks (composition, route list, component-
level rules, copy locks).

---

## Universal HARD halts (override the 95% gate; not overridable via /override-sop)

The following items HALT the QA loop immediately when failing. No fix
attempt can bypass them; the build must be re-run.

- [ ] **U-H-1, Em-dash count = 0**.
      `grep -rn -E "—|&mdash;|&#8212;" src/` returns 0 matches.
      Fix: scan + replace every em-dash with the appropriate punctuation
      (comma, period, colon, or en-dash where typographically correct).
- [ ] **U-H-2, No surviving sentinels in `src/`**.
      `grep -rn "__REQUIRED__[A-Z0-9_]\+__" src/` returns 0 matches.
      Fix: trace the surviving sentinel back to brand-dna.json; if the
      field is genuinely missing, halt with `MANUAL-DROP-NEEDED.md`. If
      the build agent failed to inject it, fix the build agent.
- [ ] **U-H-3, No surviving sentinels in `dist/`**.
      `grep -rn "__REQUIRED__[A-Z0-9_]\+__" dist/` returns 0 matches.
      Fix: same as U-H-2. A dist sentinel that survived means the
      build silently swallowed a sentinel that should have been
      replaced.
- [ ] **U-H-4, `scripts/validate-brand-dna.mjs` exits 0**.
      Run `node scripts/validate-brand-dna.mjs --strict`. Exit code
      MUST be 0.
      Fix: inspect the error output. Either fill the missing field
      via the brand-dna source, or fix the build agent's mapping.

---

## Universal compliance items

### Typography

- [ ] **U-1, Smart quotes enforced in user-facing copy**.
      No `'` or `"` ASCII characters in JSX strings, alt text, or page
      copy. Curly quotes (`'`, `'`, `"`, `"`) and the real ellipsis
      character (`…`) only.
      Fix: scan copy-deck.md and per-section JSX strings; replace ASCII
      with the typographically correct character.
- [ ] **U-2, No en-dash / em-dash substitution errors**.
      Where a typographically correct en-dash is needed (number ranges,
      e.g. "9-5pm"), the character is the real `–` not `-` or `—`.
      Fix: per typographic-standards.
- [ ] **U-3, `tabular-nums` applied to numeric stats**.
      Stat counters, review counts, prices, phone numbers render with
      `font-variant-numeric: tabular-nums` so the digits don't shift
      when values change.
      Fix: add the CSS utility class on the stat surface.

### Accessibility

- [ ] **U-4, `prefers-reduced-motion: reduce` honoured**.
      Every CSS animation + transition + framer-motion call honours
      the user's reduced-motion preference. Test in DevTools "Emulate
      CSS prefers-reduced-motion: reduce" mode; nothing should
      animate.
      Fix: wrap every motion call in the prefers-reduced-motion
      conditional pattern.
- [ ] **U-5, Every interactive element is keyboard-reachable**.
      Tab through the page. Every CTA, form field, nav link, and
      accordion is reachable in DOM order with a visible focus ring.
      Fix: add `tabIndex` + focus-visible styles where missing.
- [ ] **U-6, Every form input has a label or aria-label**.
      Fix: add the missing label / aria-label.
- [ ] **U-7, Colour contrast >= WCAG AA**.
      Text on background passes 4.5:1 contrast at body size, 3:1 at
      heading sizes. Run the impeccable skill's contrast audit.
      Fix: shift the palette in brand-dna or adjust per-section
      utility classes.

### Mobile responsive

- [ ] **U-8, Mobile 375px viewport renders without horizontal scroll**.
      Resize Playwright to 375x812. Scroll the full page. No element
      causes a horizontal scrollbar.
      Fix: identify the overflowing element (DevTools "Show overflow"
      or a Playwright bounding-box check); add overflow handling or
      reflow the section.
- [ ] **U-9, Persistent mobile CTA element renders at mobile + hides at desktop**.
      The niche template ships a persistent mobile CTA element in some
      shape (sticky bottom bar, click-to-call, drawer, etc.). At 375px
      it's visible. At 1440px it's hidden.
      Fix: verify the `md:hidden` / `lg:hidden` utility is present.
- [ ] **U-10, Touch targets >= 44x44 px on mobile**.
      Every tappable element (CTA, nav item, form input) meets the
      iOS-Android minimum.
      Fix: bump padding or min-width.

### Performance

- [ ] **U-11, Lighthouse mobile perf >= 80** (informational; does not halt).
      Run Lighthouse in headless Chrome at mobile preset. Log the
      score.
      Fix: surface in the report; do not gate the QA loop on this.
- [ ] **U-12, Hero image is WebP and dimension-capped**.
      `public/hero-image.webp` exists and is <500KB at q=92. The
      mobile variant `public/hero-image-mobile.webp` exists and is
      <300KB.
      Fix: re-run `tools/optimise-image.py` with the documented
      defaults.
- [ ] **U-13, No console errors in the rendered page**.
      Open the dev server in Playwright; load every route; collect
      console errors. Expected count: 0.
      Fix: trace + fix per error.

### Copy quality

- [ ] **U-14, No AI-vocab blocklist terms**.
      Run the copy-lint script against the rendered text. Blocklist:
      `realm`, `tapestry`, `beacon`, `symphony`, `testament`, `leverage`,
      `synergize`, `seamless`, `robust`, `game-changer`, `cutting-edge`,
      `world-class`, `best-in-class`, `in the realm of`, `rich tapestry of`,
      `stands as a testament`, `in today's fast-paced`, plus any niche-
      specific additions from the niche playbook.
      Fix: rewrite the offending copy block.
- [ ] **U-15, No `Lorem ipsum` / placeholder text**.
      Fix: replace with real copy.
- [ ] **U-16, No US/UK spelling inconsistency within a single page**.
      Pick one (per the niche playbook's `copywriting.md`); enforce
      uniformly.

### Schema + data integrity

- [ ] **U-17, `brand-dna.json` validates against `references/schemas/brand-dna.schema.json`**.
      Run the JSON Schema validator.
- [ ] **U-18, Every sitemap route in `templates/{slug}/src/pages/` builds + renders cleanly**.
      For each `.jsx` page file, `npm run build` succeeds and the
      route returns 200 at dev-server runtime.
- [ ] **U-19, No fabricated review counts, ratings, or testimonials**.
      Every Google review count + rating + sample quote in
      `brand-dna.json` traces back to a real Google Place ID. The
      research-data.json must carry the source.

### Build infrastructure

- [ ] **U-20, `npm run build` succeeds with zero warnings beyond the universal allowed set**.
      Allowed warnings: deprecated Tailwind utility migration notices.
      Fix: trace the warning to source, address it.
- [ ] **U-21, Bundle size <= 1MB gzip**.
      Run `du -sh dist/` and `vite build --report`. Log the size.
      Fix: code-split heavy components; defer non-critical imports.

---

## How this layer composes with the per-niche layer

The sop-qa-agent reads the universal layer first, then concatenates
the per-niche layer at
`templates/{active-niche-slug}/.claude/checklists/sop-compliance.md`.

The merged checklist is scored as one set. Per-niche items follow the
same `U-N` / `N-N` numbering pattern, prefixed with the niche slug for
uniqueness (e.g. `{niche-slug}-1`, `{niche-slug}-2`).

Pass rate = (PASS items) / (PASS + FAIL items, excluding N/A) * 100.

Gate: >= 95% on the merged checklist AND every universal HARD halt
passing.

Items the per-niche layer must encode (Module 2D writes them from the
niche wireframe + niche playbook):

- Section composition (which sections render, in what order, on what
  page types)
- Per-section component-level checks (correct layout variant,
  brand-dna paths read, locked-copy sentinels present)
- Route list (every route in `09-sitemap.json` builds + renders)
- Trust signal placements (per `niche-playbook/trust-signals.json -> placements`)
- Process section step count (per `niche-playbook/process.json -> stepCount`)
- Theme support (light/dark/both per `niche-playbook/theme.json`)
- Locked copy + form headers + privacy line + mobile call label
  (per `niche-playbook/copy-locks.json`)
- Niche-specific trust badge presence + count
  (per `niche-playbook/trust-signals.json -> trustStripCount`)

These do NOT belong in this universal layer. If a niche needs a check
that's near-universal (e.g. "page must have an H1"), Module 2D may
write a near-duplicate item in the per-niche layer to bind it to a
specific section.
