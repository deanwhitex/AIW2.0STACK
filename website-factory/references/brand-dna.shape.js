/**
 * brand-dna.shape.js
 *
 * CANONICAL DATA-SHAPE CONTRACT for every niche template's brand-dna.js.
 *
 * Every React component in every per-niche template reads from this shape.
 * The factory generator (Module 2D) instantiates a copy of this shape at
 * `templates/{niche-slug}/src/config/brand-dna.example.js` per niche, and
 * Stage 10.1 fills per-client values into
 * `templates/{niche-slug}/src/config/brand-dna.js` from
 * `Pipeline Data/brand/brand-dna.json`.
 *
 * This shape is universal and niche-agnostic. It describes the DATA the
 * factory tracks per client: identity, contact, address, palette,
 * typography, copy locks, page-level content. It does NOT describe a
 * wireframe. The wireframe (which sections render, which composition
 * variants get picked, which layouts the components implement) lives in
 * the per-niche template's components + the niche playbook.
 *
 * Every string value below is either a `__REQUIRED__*__` sentinel (must
 * be filled per-client by Stage 10.1) or `null` (truly optional). Arrays
 * default to `[]`. Numbers default to `0`.
 *
 * The validator at every niche template's
 * `scripts/validate-brand-dna.mjs` walks this shape and halts on missing
 * fields, wrong types, or surviving sentinels (in strict mode).
 */

export const brandDNAShape = {
  meta: {
    title: "__REQUIRED__META_TITLE__",
    description: "__REQUIRED__META_DESCRIPTION__",
  },

  company: {
    name: "__REQUIRED__COMPANY_NAME__",
    shortName: "__REQUIRED__COMPANY_SHORT_NAME__",
    tagline: "__REQUIRED__COMPANY_TAGLINE__",
    url: "__REQUIRED__COMPANY_URL__",
    licenseNumber: null,
    description: "__REQUIRED__COMPANY_DESCRIPTION__",
    serviceRegion: "__REQUIRED__SERVICE_REGION__",
  },

  contact: {
    phone: "__REQUIRED__PHONE__",
    phoneTelLink: "__REQUIRED__PHONE_TEL_LINK__",
    email: "__REQUIRED__EMAIL__",
    googleMapsUrl: null,
    mapsEmbedUrl: null,
  },

  address: {
    street: "__REQUIRED__STREET__",
    city: "__REQUIRED__CITY__",
    state: "__REQUIRED__STATE_CODE__",
    zip: "__REQUIRED__ZIP__",
    full: "__REQUIRED__ADDRESS_FULL__",
    lat: null,
    lng: null,
  },

  // Human-readable display blocks rendered by per-niche pages + JSON-LD
  // openingHoursSpecification source.
  hours: {
    weekday: {
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "__REQUIRED__HOURS_OPEN__",
      closes: "__REQUIRED__HOURS_CLOSE__",
    },
    saturday: null,
    display: [
      { label: "Weekdays", value: "__REQUIRED__HOURS_WEEKDAYS__" },
    ],
    emergencyBadge: null,
  },

  // Programmatic open/close detection. Components that show an
  // "available now" indicator read this. Both `open` and `close` are
  // 24-hour HH:MM in `tz`.
  businessHours: {
    tz: "__REQUIRED__BUSINESS_HOURS_TZ__",
    open: "__REQUIRED__BUSINESS_HOURS_OPEN__",
    close: "__REQUIRED__BUSINESS_HOURS_CLOSE__",
  },

  social: {
    facebook: null,
    facebookReviews: null,
    instagram: null,
    linkedin: null,
    youtube: null,
  },

  team: {
    founder: {
      name: "__REQUIRED__FOUNDER_NAME__",
      displayName: "__REQUIRED__FOUNDER_DISPLAY_NAME__",
      title: "__REQUIRED__FOUNDER_TITLE__",
      yearsExp: "__REQUIRED__FOUNDER_YEARS_EXP__",
      expLabel: "__REQUIRED__FOUNDER_EXP_LABEL__",
    },
    founders: [],
  },

  // Optional team photo filename. Resolves to `/team/{filename}`. Set
  // null to omit.
  team_group_photo: null,

  // Optional team-member tiles. Each entry: { filename, name, role }.
  team_members: [],

  theme_mode: "light",
  voice_register: "__REQUIRED__VOICE_REGISTER__",

  // Optional decorative motif slug. Resolves against the niche
  // template's bg-pattern + corner-overlay asset library. Module 2D
  // emits the motif library when generating the niche template.
  shape_motif: "__REQUIRED__SHAPE_MOTIF__",

  // Per-section decorative corner overlay. Set null to disable.
  corner_overlay: {
    motif: "__REQUIRED__CORNER_OVERLAY_MOTIF__",
    color: "__REQUIRED__CORNER_OVERLAY_COLOR__",
    opacity: 0.08,
  },

  palette: {
    primary: "__REQUIRED__PALETTE_PRIMARY__",
    primary_dark: "__REQUIRED__PALETTE_PRIMARY_DARK__",
    primary_slate: "__REQUIRED__PALETTE_PRIMARY_SLATE__",
    accent: "__REQUIRED__PALETTE_ACCENT__",
    accent_light: "__REQUIRED__PALETTE_ACCENT_LIGHT__",
    accent_dark: "__REQUIRED__PALETTE_ACCENT_DARK__",
    neutral: "__REQUIRED__PALETTE_NEUTRAL__",
    neutral_dim: "__REQUIRED__PALETTE_NEUTRAL_DIM__",
    silver: "__REQUIRED__PALETTE_SILVER__",
    ink: "__REQUIRED__PALETTE_INK__",
  },

  typography: {
    heading: "__REQUIRED__TYPOGRAPHY_HEADING__",
    body: "__REQUIRED__TYPOGRAPHY_BODY__",
    headingFontUrl: "__REQUIRED__TYPOGRAPHY_HEADING_URL__",
    bodyFontUrl: "__REQUIRED__TYPOGRAPHY_BODY_URL__",
  },

  // Review aggregates + per-platform items. Per-niche components decide
  // whether to render a carousel, grid, or single feature.
  reviews: {
    rating: 0,
    googleCount: 0,
    facebookCount: 0,
    totalReviewCount: 0,
    googleLabel: "__REQUIRED__GOOGLE_LABEL__",
    facebookLabel: "__REQUIRED__FACEBOOK_LABEL__",
    googleStat: "__REQUIRED__GOOGLE_STAT__",
    facebookStat: "__REQUIRED__FACEBOOK_STAT__",
    // items[] item shape: { author? | name?, source, rating, text }
    items: [],
  },

  // services[] item shape: { slug, name, iconPath?, body? }
  services: [],

  // serviceAreas[] item shape: ARRAY OF STRINGS (city names).
  // Components render each entry directly. Use plain strings, not objects.
  serviceAreas: [],

  // trust_badges[] item shape: { filename, alt }
  // Files resolve to `/badges/{filename}` per the niche template's public/.
  trust_badges: [],

  // press_logos[] item shape: { filename, alt }
  // Optional. Used by niches that have press / "as-seen-in" placements.
  press_logos: [],

  // previous_projects[] item shape:
  //   { filename, alt, type?, caption?, category? }
  // Files resolve to `/work/{filename}` per the niche template's public/.
  // `type` may be "video" (then the component renders a <video> element).
  previous_projects: [],

  // Universal copy data the niche template's components consume. The
  // niche playbook's copy-locks.json supplies the per-niche default
  // values for the sentinel fields below; per-client values may override.
  copy: {
    hero: {
      eyebrow: "__REQUIRED__HERO_EYEBROW__",
      headline: "__REQUIRED__HERO_HEADLINE__",
      subheadline: "__REQUIRED__HERO_SUBHEADLINE__",
      imageAlt: "__REQUIRED__HERO_IMAGE_ALT__",
    },

    // Both are ARRAYS OF STRINGS. Components render each as bare text.
    heroTrustChips: [],
    trustClaims: [],

    // Locked copy strings (resolved from the niche playbook's
    // copy-locks.json by Stage 10.1).
    formHeader: "__REQUIRED__FORM_HEADER__",
    formSubtext: "__REQUIRED__FORM_SUBTEXT__",
    buttonText: "__REQUIRED__BUTTON_TEXT__",
    submitButton: "__REQUIRED__SUBMIT_BUTTON__",
    privacyLine: "__REQUIRED__PRIVACY_LINE__",
    mobileCallLabel: "__REQUIRED__MOBILE_CALL_LABEL__",
    availableNow: "__REQUIRED__AVAILABLE_NOW__",
    footerCta: "__REQUIRED__FOOTER_CTA__",
    copyright: "__REQUIRED__COPYRIGHT__",

    // Per-section label/heading/body bundles. The niche template's
    // components consume these; Stage 10.1 fills them from the niche
    // playbook's copy-locks.json + per-client copy-deck.
    topBar: { cta: "__REQUIRED__TOPBAR_CTA__" },
    blog: {
      label: "__REQUIRED__BLOG_LABEL__",
      heading: "__REQUIRED__BLOG_HEADING__",
      body: "__REQUIRED__BLOG_BODY__",
      featuredLabel: "__REQUIRED__BLOG_FEATURED_LABEL__",
    },
    cta: {
      label: "__REQUIRED__CTA_LABEL__",
      heading: "__REQUIRED__CTA_HEADING__",
      body: "__REQUIRED__CTA_BODY__",
    },
    faq: {
      label: "__REQUIRED__FAQ_LABEL__",
      heading: "__REQUIRED__FAQ_HEADING__",
    },
    founder: {
      label: "__REQUIRED__FOUNDER_LABEL__",
      heading: "__REQUIRED__FOUNDER_HEADING__",
      para1: "__REQUIRED__FOUNDER_PARA1__",
      para2: "__REQUIRED__FOUNDER_PARA2__",
      visionLabel: "__REQUIRED__FOUNDER_VISION_LABEL__",
      vision: "__REQUIRED__FOUNDER_VISION__",
      missionLabel: "__REQUIRED__FOUNDER_MISSION_LABEL__",
      mission: "__REQUIRED__FOUNDER_MISSION__",
    },
    gallery: {
      label: "__REQUIRED__GALLERY_LABEL__",
      heading: "__REQUIRED__GALLERY_HEADING__",
      body: "__REQUIRED__GALLERY_BODY__",
    },
    offers: {
      label: "__REQUIRED__OFFERS_LABEL__",
      heading: "__REQUIRED__OFFERS_HEADING__",
      body: "__REQUIRED__OFFERS_BODY__",
      detail: "__REQUIRED__OFFERS_DETAIL__",
    },
    process: {
      label: "__REQUIRED__PROCESS_LABEL__",
      heading: "__REQUIRED__PROCESS_HEADING__",
      body: "__REQUIRED__PROCESS_BODY__",
      badgeText: "__REQUIRED__PROCESS_BADGE_TEXT__",
      badgeSubtext: "__REQUIRED__PROCESS_BADGE_SUBTEXT__",
    },
    reviews: {
      label: "__REQUIRED__REVIEWS_LABEL__",
      heading: "__REQUIRED__REVIEWS_HEADING__",
      body: "__REQUIRED__REVIEWS_BODY__",
      summary: "__REQUIRED__REVIEWS_SUMMARY__",
    },
    serviceAreaCard: {
      heading: "__REQUIRED__SERVICEAREACARD_HEADING__",
      body: "__REQUIRED__SERVICEAREACARD_BODY__",
    },
    serviceAreas: {
      label: "__REQUIRED__SERVICEAREAS_LABEL__",
      heading: "__REQUIRED__SERVICEAREAS_HEADING__",
      body: "__REQUIRED__SERVICEAREAS_BODY__",
    },
    services: {
      label: "__REQUIRED__SERVICES_LABEL__",
      heading: "__REQUIRED__SERVICES_HEADING__",
      body: "__REQUIRED__SERVICES_BODY__",
    },
    whyChoose: {
      label: "__REQUIRED__WHYCHOOSE_LABEL__",
      heading: "__REQUIRED__WHYCHOOSE_HEADING__",
      body: "__REQUIRED__WHYCHOOSE_BODY__",
    },
  },

  // process_steps[] item shape: { n, title, body }
  process_steps: [],

  // why_choose_us[] item shape: ARRAY OF STRINGS (titles only).
  why_choose_us: [],

  // special_offers[] item shape: { label, description }
  special_offers: [],

  // faq[] item shape: { q, a }
  faq: [],

  // blog_posts[] item shape:
  //   { slug, cover, title, date, category, excerpt, readTime,
  //     content?: [{ type: 'p' | 'h2' | 'list', text? | items? }],
  //     body?: markdown-string }
  blog_posts: [],
  blog_categories: [],

  // location_pages[] item shape: { slug, city, state, ... }. Set to []
  // when the niche template doesn't ship per-city sub-pages.
  location_pages: [],

  // Per-page copy bundles. Each niche template generates pages from the
  // niche wireframe; the corresponding copy bundle here keeps the
  // page-level copy data-driven. Empty {} entries mean the page doesn't
  // ship for this niche.
  pages: {
    about: {},
    serviceAreas: {},
    locationDetail: {},
    blogPost: {},
    blog: {},
    contact: {},
    services: {},
    financing: {},
  },

  credit: {
    agency: "__REQUIRED__AGENCY_NAME__",
    url: null,
  },
};

export default brandDNAShape;
