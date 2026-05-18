# proposal-pages.json contract

**Schema:** `references/niche-playbook/schemas/proposal-pages.schema.json`

The Stage 13 proposal generator (`tools/build-proposal.py`) reads
`templates/{active-niche-slug}/niche-playbook/proposal-pages.json` to
render the PAGE_DATA modal in the per-lead proposal HTML. The modal
lets the agency walk the lead through what's on their generated site
page-by-page.

Module 2D writes this file in Phase 8 (niche-playbook generation) from
the niche wireframe + `09-sitemap.json`. Every niche template must
ship one. If missing, the proposal generator halts with a Module 2D
pointer.

---

## Required structure

Three optional blocks layer on top of the required `pages` array:

1. **`pages`** (required), the static page list every client in this niche
   ships. Each entry carries a `tier` field (`root` / `core` / `pillar`)
   the proposal modal's sitemap pyramid reads to place the page.
2. **`perServicePageTemplate`** (optional), the section template that
   expands once per service in the active client's strategy. Per-service
   pages do NOT render in the pyramid; they show up as silo chips under
   the Services pillar.
3. **`perAreaPageTemplate`** (optional), the section template that
   expands once per service area (capped at 6 entries in the modal).
   Per-area pages do NOT render in the pyramid; they show up as silo
   chips under the Locations pillar.
4. **`aliasPages`** (optional), niche-specific shortcut pages (e.g.
   roofing's stormdamage / insuranceclaims, hospitality's bookings /
   event-spaces). Each resolves its URL by matching the client's
   service list and carries a `tier` field (typically `pillar`).

## Tier placement guidance

The proposal modal's sitemap pyramid renders pages by tier. The three
tiers are intentionally generic so every niche can map to them:

| Tier | What goes here | Typical count |
|---|---|---|
| `root` | The single homepage. One entry, always `id: "home"`. | 1 |
| `core` | Universally-useful pages every site ships: About, Contact, Reviews, Gallery, FAQ, etc. Pages the user expects regardless of niche. | 3-6 |
| `pillar` | The niche-specific pillar surfaces that drive conversion. For a contractor: Services, Locations, Process, Storm Damage, Insurance Claims, Warranty, Why Us. For a hospitality: Bookings, Menu, Event Spaces, Reviews, Concierge. For an auto detail: Services, Locations, Mobile Detail, Membership. | 4-8 |

The pyramid stats ("Core Pages", "Pillars", "Silo Pages", "Total Pages")
derive from the actual counts — there is no hardcoded 5 + 7 layout.

## `hasSilos` (optional, pillar pages only)

Set `hasSilos: "service"` on a pillar page if `perServicePageTemplate`
is present in this file. The pyramid box will render a `+N` count
badge showing how many service detail pages this client has.

Set `hasSilos: "city"` on a pillar page if `perAreaPageTemplate` is
present. The pyramid box will render a `+N` count badge showing how
many service-area pages this client has.

Most niches that ship perServicePageTemplate should set
`hasSilos: "service"` on their "Services" pillar entry (or whatever
the niche calls it: Treatments, Bookings, Menu, etc.). Same for
perAreaPageTemplate -> the "Locations" pillar entry.

---

## Token substitution

The proposal generator runs token substitution on every `name` +
`description` string before rendering. Supported tokens:

| Token | Resolves to | Default when missing |
|---|---|---|
| `{owner_first}` | Owner's first name from brand-dna.json | `Owner` |
| `{brand_short}` | Short brand name from brand-dna.json | `the company` |
| `{service_count}` | Length of the client's services list | `0` |
| `{city_count}` | Length of the client's service areas list | `0` |
| `{city}` | The per-area expansion's city name | (only in `perAreaPageTemplate`) |
| `{service_name}` | The per-service expansion's display name | (only in `perServicePageTemplate`) |
| `{service_slug}` | The per-service expansion's URL slug | (only in `perServicePageTemplate`) |

---

## Static page IDs

There is no fixed list of required page IDs. The proposal HTML template's
sitemap pyramid renders whatever pages the niche ships, placed by `tier`.
The previous architecture hardcoded 10 IDs (home, about, services,
service-areas, gallery, blog, contact, reviews, financing, locations) plus
5 contractor-flavoured aliases (whyus, stormdamage, insuranceclaims,
process, warranty). That hardcoding is gone; every niche now writes its
own page list.

Common page IDs across most niches:

- `home` (tier: root), the homepage
- `about` (tier: core), founder + team
- `contact` (tier: core), lead form + address
- `reviews` (tier: core), social proof carousel
- `gallery` (tier: core), portfolio / before-after / project photos
- `services` (tier: pillar, hasSilos: service), the services index
- `locations` (tier: pillar, hasSilos: city), the service-areas index

Niche-specific examples:

- Hospitality: `bookings`, `menu`, `event-spaces`, `concierge`
- Auto-detailing: `mobile-detail`, `membership`, `before-after`
- Roofing: `stormdamage`, `insuranceclaims`, `warranty`, `process`

---

## Per-service page template

When `perServicePageTemplate` is present, the generator emits one
`/services/{slug}` page per service in the client's strategy. Use
`{service_name}` + `{service_slug}` tokens in section descriptions to
reference the specific service.

Example:

```json
{
  "perServicePageTemplate": {
    "sections": [
      {
        "name": "Service hero",
        "description": "H1 set to '{service_name}'. Lead form anchored top-right.",
        "tag": "Convert"
      }
    ]
  }
}
```

---

## Per-area page template

When `perAreaPageTemplate` is present, the generator emits one
`/service-area/{slug}` page per service area (capped at 6). Use
`{city}` token in section descriptions.

Example:

```json
{
  "perAreaPageTemplate": {
    "sections": [
      {
        "name": "City hero",
        "description": "H1: 'Service in {city}'. Local lead form.",
        "tag": "Local"
      }
    ]
  }
}
```

---

## Alias pages (niche-specific shortcuts)

Some niches have shortcut surfaces that target a subset of the
service list. The classic example: roofing has a "Storm Damage" page
that's actually `/services/storm-damage-restoration` (or whichever
service slug matches). The proposal modal labels it "Storm Damage" so
the agency can pitch the storm-response capability directly.

Alias pages resolve their URL by matching the active client's services
list against `urlFromService` needles:

```json
{
  "aliasPages": [
    {
      "id": "stormdamage",
      "title": "Storm Damage",
      "urlFromService": ["storm", "hail", "wind"],
      "fallbackUrl": "/services",
      "fallbackTitleFromService": true,
      "sections": [
        {
          "name": "Hero",
          "description": "Storm hit your property? We tarp, file the claim, and rebuild.",
          "tag": "Convert"
        }
      ]
    }
  ]
}
```

When `fallbackTitleFromService` is true AND a service matches, the
alias's `title` is overridden with the matched service's name (e.g.
"Storm Damage" becomes "Storm Damage Restoration" if that's the
service slug).

Alias pages are niche-specific; only include them when the niche
playbook prescribes them. Hospitality doesn't have stormdamage; auto-
detailing has its own shortcut surfaces.

---

## Module 2D generation procedure

Module 2D Phase 8 fills proposal-pages.json from these sources:

1. **`09-sitemap.json`** for the route list -> drives `pages[]` URLs +
   IDs
2. **`09-wireframe.md`** for the section composition per page -> drives
   `sections[]` per page
3. **`09-template-spec.md`** for the per-section visual treatment -> drives
   the `description` strings (one-sentence summary per section)
4. **`niche-playbook/cro-rules.md`** for the function tags (`Convert`,
   `Trust`, etc.) per section
5. **The top-of-niche reference pool** for which alias pages the niche
   needs (e.g. roofing's stormdamage; auto-detailing's mobile-detailing
   shortcut)

The agent must verify every static page ID the proposal HTML template
expects (`home`, `about`, `services`, etc.) is present. If a niche
doesn't ship one of those routes (e.g. some niches don't have
`/financing`), Module 2D writes a placeholder entry with a single
section explaining the niche doesn't ship that surface — so the
proposal modal's openPage() call still resolves cleanly, just to a
brief "not applicable" panel.

---

## Validation

Stage 13 validates against the schema before render. Halts on:

- Missing `pages` array
- Any static page ID required by the proposal HTML template absent
  from `pages` AND from `aliasPages`
- A `Section.tag` outside the allowed enum
- A token that resolves to empty (logs a warning, doesn't halt)
