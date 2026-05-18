# Universal CRO SOPs

Source: AIW course material. Moved here from the Research System
framework where it lived in Appendix B. These SOPs encode **universal
CRO principles** that apply to every niche.

Section composition + ordering is **NOT** in here. That decision is
niche-specific and comes from Module 2D's analysis of the top-of-niche
reference pool. The niche wireframe at
`research/02-niche-research/{niche-slug}/09-wireframe.md` is the
authority on which sections exist for this niche and in what order. The
niche playbook's `cro-rules.md` (one of the playbook artifacts Module
2D writes per niche, contract at
`website-factory/references/niche-playbook/contracts/cro-rules.contract.md`)
carries the niche-specific conversion mechanics that layer on top of
these universal principles.

---

## Trust SOP (B1)

**Principle:** every section earns its place by answering "what is this
for?" — trust, conversion, or SEO. Trust loads earliest and heaviest in
high-research, high-ticket niches. Where trust loads (above the fold vs
below, before or after the form) is a niche-wireframe decision; THAT it
loads early-and-heavy is a universal principle.

**Universal trust signals (the niche wireframe decides where + how these
render):**

- Social proof tied to a recent transformation result
- Aggregate review count + star rating where it's persuasive
- Case studies + before/after structured as situation -> solution ->
  result (lead with the result)
- Niche-appropriate certifications, badges, accreditations
- Press or "as seen in" placements
- Owner / team presence (face on the page)
- Reasons-to-choose framed as results, not features
- FAQ that addresses actual buyer objections

**Niche overrides** come from the niche playbook's
`trust-signals.json` (which badges + placements apply for this niche)
and `cro-rules.md` (how trust sequences for this niche's end customer).

**SOP checklist (universal — applies regardless of wireframe):**
- [ ] Some social proof element is visible above the fold on the
      homepage and on key conversion pages
- [ ] Aggregate review count + rating exist somewhere on the homepage
- [ ] At least 3 case studies / project examples ship with measurable
      results
- [ ] Niche-appropriate trust badges render where the niche playbook's
      `trust-signals.placements` say they belong
- [ ] An owner / team photo exists on the homepage (per niche
      wireframe placement)
- [ ] Reasons-to-choose copy frames results, not features
- [ ] FAQ addresses 6 to 10 actual buyer objections (per the niche
      playbook's `copywriting.md` voice grammar)

---

## Traffic SOP (B2)

**Principle:** traffic is one of three legs. Built on SEO + GBP. Paid
layers on separately.

**Workflow:**

1. **Keyword research before content.** Google Keyword Planner +
   SEMrush. 3 keywords per page, exact match, ~10 mentions per 1,000
   words.
2. **Sitemap from keywords.** Homepage broad. Service pages
   `[service] in [city]`. Service-area pages only where volume exists.
   About, Past Work, Contact brand-focused. Blog for long-tail.
3. **On-page mechanics.** H1 with primary keyword early in HTML. No
   cannibalization. Cluster related keywords. Alt text. Internal
   linking.
4. **GBP early.** Roughly a week of focused setup work. Traffic in
   weeks not months. Run parallel to SEO build.
5. **Technical.** Speed 1 to 3s desktop, under 5s mobile. 301
   redirects for rebuilds. Schema markup.
6. **Reporting.** Results, then deliverables, then rankings.

**Stack:** Google Keyword Planner (free), SEMrush, Search Atlas, a
speed tool like NitroPack or WPMU Dev, CallRail, an analytics
dashboard.

**SOP checklist:**
- [ ] Keyword research doc before any content
- [ ] Sitemap from research, not guessed
- [ ] H1, title, meta optimised per page
- [ ] GBP fully optimised and verified
- [ ] Speed: desktop above 85, mobile above 70
- [ ] 301 redirect map if rebuild
- [ ] CallRail tracking calls from every source
- [ ] Monthly report: results before deliverables before rankings

---

## Conversion SOP (B3)

**Principle:** target 6 to 10% of organic visitors converting (industry
benchmark for high-intent local services; adjust the target per the
niche playbook's `cro-rules.md`).

**Universal conversion mechanics (the niche wireframe decides where +
how these render):**

- Primary + secondary CTAs reachable above the fold (form vs phone vs
  magnet vs calendar). Which CTA is primary is a niche decision.
- Frictionless contact form: 4 fields or fewer on first ask. Field
  list is niche-specific (per the niche playbook's `copy-locks.json`
  formHeader + per-niche field set in `cro-rules.md`).
- A persistent CTA path on mobile (sticky element, click-to-call,
  bottom bar, drawer — pick per niche wireframe).
- At least one email magnet keyed to the niche's high-intent moment
  (ebook, brochure, price guide, etc., per niche).
- Footer carries a final contact path on every page.
- A "what happens next" / process surface (form follows the niche
  wireframe).
- Multiple commitment levels exposed: phone, form, magnet, calendar.

**Section composition + order** for these mechanics is NOT specified
here. Module 2D's `09-wireframe.md` carries the per-niche section
order; the niche playbook's `cro-rules.md` carries the per-niche
conversion stack (which mechanics to lead with, which to push down,
which to omit).

**Measurement:** CallRail tags every call source. Forms tagged in GA4.
Conversion rate per channel. Hotjar for the first 60 days.

**SOP checklist (universal — applies regardless of wireframe):**
- [ ] At least two CTAs reachable above the fold (primary +
      secondary; which is which is the niche playbook's call)
- [ ] First-ask form has 4 fields or fewer
- [ ] Persistent CTA path exists on mobile
- [ ] At least one email magnet ships per key page set
- [ ] Footer contact path on every page
- [ ] GA4 + CallRail wired and tagged
- [ ] Hotjar for the first 60 days post-launch

---

## How these get used in the factory

Module 2D reads these universal SOPs as the floor for the niche
playbook's `cro-rules.md`. The niche playbook layers on niche-specific
mechanics + the niche-specific section ordering from
`09-wireframe.md`. The factory's QA agents (sop-qa-agent +
design-fidelity-qa-agent) check the universal items here and the
niche-specific items in the per-niche checklists at
`templates/{niche-slug}/.claude/checklists/`.

Every checklist item must answer: **does this win the end customer of
the niche business?** If a niche-specific override would weaken
end-customer conversion, the universal floor wins.
