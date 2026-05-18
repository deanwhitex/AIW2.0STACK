#!/usr/bin/env node
/**
 * inject-theme.mjs
 *
 * Vite prebuild hook. Reads `src/config/brand-dna.js`, then rewrites the
 * `:root` palette + `@import url('https://fonts.googleapis.com/...')` lines
 * + `<html data-theme-mode="...">` attribute + `<title>` + meta description
 * + JSON-LD script so per-client palette, fonts, theme mode, and SEO land
 * in the bundle BEFORE `vite build` reads them.
 *
 * Shape validation runs first via `validate-brand-dna.mjs` (a separate prebuild
 * step). This script ASSUMES the brandDNA object is already shape-valid and
 * sentinel-free; it does not duplicate that check.
 *
 * IMPORTANT: every `replace` call uses a function replacer (not a string
 * replacement). String replacers in JS interpret `$1`, `$&`, `$$` as regex
 * backreferences, which corrupts the output when the injected value contains
 * `$` followed by digits (e.g. a price like `$110`). Function replacers do
 * not interpret `$` specially, so they are the safe path.
 *
 * Triggered by `npm run prebuild` (configured in package.json).
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const INDEX_CSS = resolve(ROOT, "src/index.css");
const INDEX_HTML = resolve(ROOT, "index.html");
const BRAND_DNA = resolve(ROOT, "src/config/brand-dna.js");

function hexToRgbTriplet(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`inject-theme: invalid hex color ${hex}`);
  const v = m[1];
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ].join(" ");
}

async function loadBrandDNA() {
  const mod = await import(BRAND_DNA);
  const brandDNA = mod.brandDNA;
  if (!brandDNA) {
    throw new Error("inject-theme: src/config/brand-dna.js does not export `brandDNA`");
  }
  return brandDNA;
}

function buildRootBlock(palette) {
  const lightVars = Object.entries(palette)
    .map(([k, v]) => `  --${k.replace(/_/g, "-")}: ${hexToRgbTriplet(v)};`)
    .join("\n");
  return `:root {\n${lightVars}\n}\n`;
}

function normaliseGoogleFontUrl(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  // Brand-dna schema specifies URL fragment (e.g. 'Oswald:wght@400;500;600;700').
  // Wrap in canonical Google Fonts CSS2 endpoint with display=swap.
  return `https://fonts.googleapis.com/css2?family=${v}&display=swap`;
}

function buildFontImports({ headingFontUrl, bodyFontUrl }) {
  const heading = normaliseGoogleFontUrl(headingFontUrl);
  const body = normaliseGoogleFontUrl(bodyFontUrl);
  const lines = [];
  if (heading) lines.push(`@import url('${heading}');`);
  if (body && body !== heading) lines.push(`@import url('${body}');`);
  return lines.join("\n") + "\n";
}

async function injectCss(brandDNA) {
  let css = await readFile(INDEX_CSS, "utf8");

  // Strip existing Google Fonts imports.
  css = css.replace(/^@import url\('https:\/\/fonts\.googleapis\.com[^']+'\);\s*\n?/gm, "");

  // Replace the existing :root { ... } block. If none exists, prepend.
  const rootBlock = buildRootBlock(brandDNA.palette);
  const rootRegex = /:root\s*\{[^}]*\}\s*\n?/;
  if (rootRegex.test(css)) {
    css = css.replace(rootRegex, () => rootBlock);
  } else {
    css = rootBlock + css;
  }

  // Move font imports + tailwind directives to the very top (Vite requires
  // @import at the start of the file).
  const tailwindDirectives = [];
  css = css.replace(/^@tailwind\s+[^;]+;\s*\n?/gm, (m) => {
    tailwindDirectives.push(m.trim());
    return "";
  });

  const fontImports = buildFontImports(brandDNA.typography);
  const finalCss = fontImports + tailwindDirectives.join("\n") + "\n" + css.trimStart();
  await writeFile(INDEX_CSS, finalCss, "utf8");
  return finalCss.length;
}

function buildJsonLd(brandDNA) {
  const company = brandDNA.company || {};
  const contact = brandDNA.contact || {};
  const address = brandDNA.address || {};
  const hours = brandDNA.hours || {};
  const reviews = brandDNA.reviews || {};
  const team = brandDNA.team || {};

  const openingHours = [
    hours.weekday
      ? {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": hours.weekday.dayOfWeek,
          "opens": hours.weekday.opens,
          "closes": hours.weekday.closes,
        }
      : null,
    hours.saturday
      ? {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": "Saturday",
          "opens": hours.saturday.opens,
          "closes": hours.saturday.closes,
        }
      : null,
  ].filter(Boolean);

  const ld = {
    "@context": "https://schema.org",
    "@type": brandDNA.jsonLdType || "LocalBusiness",
    "name": company.name,
    "url": company.url,
    "telephone": contact.phoneTelLink,
    "email": contact.email,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": address.street,
      "addressLocality": address.city,
      "addressRegion": address.state,
      "postalCode": address.zip,
      "addressCountry": "US",
    },
    "openingHoursSpecification": openingHours,
    "aggregateRating":
      reviews && (reviews.googleCount || reviews.totalReviewCount)
        ? {
            "@type": "AggregateRating",
            "ratingValue": String(reviews.rating),
            "reviewCount": String(reviews.googleCount || reviews.totalReviewCount),
            "bestRating": "5",
            "worstRating": "1",
          }
        : undefined,
    "description": company.description,
    "areaServed": company.serviceRegion,
    "priceRange": "$$",
    "founder": team.founder ? [{ "@type": "Person", "name": team.founder.name }] : undefined,
  };

  return JSON.parse(JSON.stringify(ld));
}

async function injectHtml(brandDNA) {
  let html = await readFile(INDEX_HTML, "utf8");
  const themeMode = brandDNA.theme_mode || "light";
  const title = brandDNA.meta?.title || "";
  const description = brandDNA.meta?.description || "";

  // <html data-theme-mode="..."> — use function replacer so any literal `$`
  // in the value cannot be interpreted as a backreference.
  if (/<html\b[^>]*\bdata-theme-mode=/.test(html)) {
    html = html.replace(
      /(<html\b[^>]*\bdata-theme-mode=")[^"]*(")/,
      (_match, open, close) => `${open}${themeMode}${close}`
    );
  } else {
    html = html.replace(/<html\b/, () => `<html data-theme-mode="${themeMode}"`);
  }

  // <title> — function replacer for safety even though title rarely has `$`.
  html = html.replace(
    /(<title>)[^<]*(<\/title>)/,
    (_match, open, close) => `${open}${title}${close}`
  );

  // <meta name="description" content="..."> — function replacer is REQUIRED here.
  // Description strings often contain prices like `$110`, which a string
  // replacer would interpret as `$1` (capture group 1) + `10`, corrupting
  // the output.
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    (_match, open, close) => `${open}${description}${close}`
  );

  // Regenerate the entire JSON-LD <script> block from brandDNA so no template
  // defaults survive into the per-client build.
  const ldJson = JSON.stringify(buildJsonLd(brandDNA), null, 2);
  const ldBlock = `<script type="application/ld+json">\n${ldJson}\n    </script>`;
  if (/<script type="application\/ld\+json">[\s\S]*?<\/script>/.test(html)) {
    html = html.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      () => ldBlock
    );
  } else {
    html = html.replace(/<\/head>/, () => `    ${ldBlock}\n  </head>`);
  }

  await writeFile(INDEX_HTML, html, "utf8");
}

async function main() {
  const brandDNA = await loadBrandDNA();
  const cssLen = await injectCss(brandDNA);
  await injectHtml(brandDNA);
  console.log(
    `inject-theme: wrote index.css (${cssLen} bytes) and updated index.html theme_mode=${brandDNA.theme_mode}`
  );
}

main().catch((err) => {
  console.error("inject-theme: failed");
  console.error(err);
  process.exit(1);
});
