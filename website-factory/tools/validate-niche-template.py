#!/usr/bin/env python3
"""
validate-niche-template.py

Runs the six factory-generator safety gates against a per-niche template
at `templates/{niche-slug}/`. Four are HARD halts; two are WARNINGS.

Hard halts:
  Gate 1 — brand-dna shape contract: every generated component reads paths
           that exist in the canonical `references/brand-dna.shape.js`
           contract, stamped per-niche at
           `templates/{niche-slug}/src/config/brand-dna.example.js`. Run
           via the niche template's `scripts/validate-brand-dna.mjs`
           against a synthetic fully-populated brand-dna.js.
  Gate 2 — JSX parse (braces + tag balance per .jsx file). Authoritative
           lint runs at Gate 3 via the project's eslint config inside
           `npm run build`.
  Gate 3 — Vite build: `npm install && npm run build` succeeds on the
           niche template with synthetic brand-dna.js filled.
  Gate 6 — Factory completeness: per-niche components, pages, playbook
           JSON files, SOPs, agents, checklists are present, non-stub,
           free of `{{slot}}` placeholders, and collectively invoke at
           least one universal skill. Catches incomplete Module 2D runs.

Warnings (soft gates; can be promoted with --strict):
  Gate 4 — anti-slop audit: scans niche JSX + playbook markdown for
           visual AI-slop signatures + words/phrases from
           `references/copy/ai-vocab-blocklist.md`.
  Gate 5 — design token substitution smoke: niche-tailored palette,
           fonts, and typography preset surfaced cleanly in index.css +
           index.html + tailwind.config.js (no surviving `{{...}}`).
           Real SSIM-vs-winner runs at Stage 10.4a (design-fidelity-
           qa-agent) against the per-client build.

Exit codes:
  0  = all hard gates passed (warnings may be present)
  10 = Gate 1 failed (brand-dna shape or off-shape JSX access)
  20 = Gate 2 failed (JSX parse / tag-balance / brace-balance error)
  30 = Gate 3 failed (Vite build error)
  40 = Gate 4 failed in --strict mode (anti-slop hit)
  50 = Gate 5 failed in --strict mode (design tokens unsubstituted)
  60 = Gate 6 failed (factory incomplete or untailored)

When a hard gate fails the tool writes
`templates/{niche-slug}/GENERATION-FAILED.md` describing what failed so
`build-from-template.py` can detect it and halt cleanly. There is NO
fallback to a shared baseline template; every niche must be generated
end-to-end. Soft-gate warnings land in
`templates/{niche-slug}/AUDIT-WARNINGS.md`.

Usage:
  python3 tools/validate-niche-template.py --niche {slug} [--skip-install] [--strict]

  --skip-install   skip npm install on Gate 3 (faster local iteration)
  --strict         promote Gates 4 and 5 from warnings to hard halts
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = REPO_ROOT / "templates"


def _write_failure_marker(niche_dir: Path, gate: str, detail: str) -> None:
    """Write GENERATION-FAILED.md so build-from-template.py can detect the
    failure and halt cleanly. There is no fallback to a shared baseline."""
    marker = niche_dir / "GENERATION-FAILED.md"
    body = (
        f"# Niche template generation failed\n\n"
        f"Gate: **{gate}**\n\n"
        f"Timestamp: {datetime.now(timezone.utc).isoformat()}\n\n"
        f"## Detail\n\n```\n{detail.strip()}\n```\n\n"
        f"## What happens now\n\n"
        f"`tools/build-from-template.py` detects this marker file and halts "
        f"the per-client pipeline when this niche is active. There is no "
        f"fallback to a shared baseline template. To retry generation, "
        f"re-run `/build-niche-template` after addressing the failure.\n"
    )
    marker.write_text(body)


def _write_audit_warning(niche_dir: Path, gate: str, detail: str) -> None:
    """Append soft-gate findings to AUDIT-WARNINGS.md. Does NOT fail the run."""
    marker = niche_dir / "AUDIT-WARNINGS.md"
    existing = marker.read_text() if marker.exists() else "# Niche template audit warnings\n\n"
    body = (
        f"{existing}"
        f"## {gate} ({datetime.now(timezone.utc).isoformat()})\n\n"
        f"```\n{detail.strip()}\n```\n\n"
    )
    marker.write_text(body)


def _extract_canonical_brand_dna_paths(shape_js_path: Path) -> set[str]:
    """Walk the canonical brand-dna.shape.js file and return every valid
    dotted access path (e.g. "palette.primary", "founder.name",
    "trust.google_rating", "pages.home.hero.h1").

    Used by Gate 1's JSX grep to validate that every `brandDNA.X.Y.Z`
    access in a generated component resolves to a real shape field.
    """
    if not shape_js_path.exists():
        return set()
    text = shape_js_path.read_text(errors="ignore")
    # Match key names in the exported object literal. Captures simple
    # identifier keys at any nesting depth. Strips obvious non-keys
    # (numbers, quoted strings used as values, JS keywords).
    keys: set[str] = set()
    for m in re.finditer(r'(?:^|\s|[{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', text, re.MULTILINE):
        keys.add(m.group(1))
    # Reserved JS words and obvious-not-keys
    keys -= {"type", "const", "let", "var", "function", "return", "if", "else", "true", "false", "null"}
    return keys


def _extract_jsx_brand_dna_accesses(jsx_path: Path) -> list[str]:
    """Pull every `brandDNA.X.Y.Z` member chain out of a JSX file.

    Returns the list of accesses (de-duplicated, sorted). Captures simple
    dot-chains; brackets-access (`brandDNA["foo"]`) and computed access
    (`brandDNA[key]`) are not captured here (they're rare in our codegen
    and harder to validate statically).
    """
    text = jsx_path.read_text(errors="ignore")
    accesses: set[str] = set()
    for m in re.finditer(r"\bbrandDNA(\.[a-zA-Z_][a-zA-Z0-9_]*)+", text):
        accesses.add(m.group(0))
    return sorted(accesses)


def gate_1_brand_dna_shape(niche_dir: Path) -> tuple[bool, str]:
    """Two-layer shape conformance check.

    Layer A. Run scripts/validate-brand-dna.mjs against brand-dna.js so
    the .js file shape-matches the canonical export at brand-dna.example.js.

    Layer B. Walk every .jsx file in src/ and grep `brandDNA.X.Y.Z`
    accesses. Each leaf key in every chain must appear in the canonical
    shape contract at references/brand-dna.shape.js. Catches the
    "component reads brandDNA.bogusKey.thing" failure mode the .mjs
    script alone cannot see.
    """
    validator = niche_dir / "scripts" / "validate-brand-dna.mjs"
    brand_dna_js = niche_dir / "src" / "config" / "brand-dna.js"
    brand_dna_example = niche_dir / "src" / "config" / "brand-dna.example.js"

    missing = [p for p in (validator, brand_dna_js, brand_dna_example) if not p.exists()]
    if missing:
        return False, f"Required file(s) missing:\n  " + "\n  ".join(str(p.relative_to(REPO_ROOT)) for p in missing)

    # --- Layer A: shape conformance of the .js file vs the .example.js ---
    # At Module 2D time the niche template ships sentinel-laden; Stage 10.1
    # (tools/build-from-template.py) fills the sentinels per client. Gate 1
    # cares about shape conformance (no missing fields, no wrong types).
    result = subprocess.run(
        ["node", str(validator), "--shape-only"],
        cwd=niche_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return False, f"validate-brand-dna.mjs exit={result.returncode}\n\nSTDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"

    # --- Layer B: JSX accesses must resolve against the canonical shape ---
    # Reads `references/brand-dna.shape.js` (the universal contract) +
    # walks every `.jsx` under src/ for `brandDNA.X.Y.Z` chains. Flags any
    # leaf key that doesn't appear anywhere in the canonical shape.
    shape_js = REPO_ROOT / "references" / "brand-dna.shape.js"
    canonical_keys = _extract_canonical_brand_dna_paths(shape_js)
    if not canonical_keys:
        # Shape contract empty or missing — the .mjs script above would
        # have caught this, but double-check defensively.
        return False, f"could not extract canonical paths from {shape_js.relative_to(REPO_ROOT)}"

    src_dir = niche_dir / "src"
    bad_accesses: list[tuple[Path, str, str]] = []  # (file, access, bad_key)
    for jsx_path in src_dir.rglob("*.jsx"):
        for access in _extract_jsx_brand_dna_accesses(jsx_path):
            # `brandDNA.foo.bar.baz` -> ["foo", "bar", "baz"]
            keys = access.split(".")[1:]
            for key in keys:
                if key not in canonical_keys:
                    bad_accesses.append((jsx_path, access, key))
                    break  # one finding per access is enough

    if bad_accesses:
        detail = "\n".join(
            f"  - {p.relative_to(REPO_ROOT)}: {access!r} references {key!r} which is not in the canonical shape"
            for (p, access, key) in bad_accesses[:20]
        )
        more = f"\n  ... and {len(bad_accesses) - 20} more" if len(bad_accesses) > 20 else ""
        return False, (
            f"Layer A (shape conformance) passed.\n"
            f"Layer B (JSX path-grep against canonical shape) FAILED with {len(bad_accesses)} off-shape access(es):\n"
            f"{detail}{more}"
        )

    return True, (
        f"Layer A: {result.stdout.strip() or 'shape conformance OK'}. "
        f"Layer B: all brandDNA.X.Y.Z accesses resolve to canonical shape keys."
    )


def _strip_strings_and_comments(text: str) -> str:
    """Remove string literals + comments so the balance counters don't
    miscount characters inside them. Not a full JS parser; designed to
    catch the common cases (template literals, strings, line comments,
    block comments)."""
    out = text
    # Line comments
    out = re.sub(r"//[^\n]*", "", out)
    # Block comments
    out = re.sub(r"/\*.*?\*/", "", out, flags=re.DOTALL)
    # String literals (single, double, template)
    out = re.sub(r'"(?:\\.|[^"\\])*"', '""', out)
    out = re.sub(r"'(?:\\.|[^'\\])*'", "''", out)
    out = re.sub(r"`(?:\\.|[^`\\])*`", "``", out)
    return out


def _count_jsx_tag_balance(text: str) -> dict[str, int]:
    """Count opening vs closing JSX tags. Returns a dict mapping each
    tag name to its (opens - closes - self_closes) delta. A balanced file
    has every value == 0. Self-closing tags (`<div />`) count as both
    open and close so they balance themselves.

    Not a full JSX parser. Misses some cases (nested fragments, JSX
    expression-children), but catches the common "missing </Section>"
    typo a stub-shaped agent might emit.
    """
    # Strip strings + comments first so JSX-tag-shaped text inside them
    # doesn't pollute the count.
    clean = _strip_strings_and_comments(text)
    # Track per-tag-name delta. Fragments (<></>) are tracked under "".
    delta: dict[str, int] = {}
    # Opening tags: <Identifier or <identifier>
    # We DON'T match self-closing here (handled separately below).
    for m in re.finditer(r"<([A-Za-z][A-Za-z0-9]*)\b[^>]*?(?<!/)>", clean):
        delta[m.group(1)] = delta.get(m.group(1), 0) + 1
    # Closing tags: </Identifier>
    for m in re.finditer(r"</([A-Za-z][A-Za-z0-9]*)\s*>", clean):
        delta[m.group(1)] = delta.get(m.group(1), 0) - 1
    return {tag: d for tag, d in delta.items() if d != 0}


def gate_2_jsx_parse(niche_dir: Path) -> tuple[bool, str]:
    """Static-tier syntactic sanity check on every .jsx file.

    Two checks:
      1. Balanced curly braces (count `{` vs `}` ignoring string/comment
         contents). Catches truncated render bodies.
      2. Balanced JSX tags (count `<Tag>` vs `</Tag>` per identifier).
         Catches missing-closing-tag stubs and copy-paste errors.

    Sentinels (`__REQUIRED__SOMETHING__`) are EXPECTED in the niche
    template at Module 2D time — Stage 10.1 fills them per client. The
    Phase 1 dist/ scanner (`tools/build-from-template.py find_forbidden`)
    catches any sentinel that survives into a per-client build.

    The authoritative full-AST + lint pass happens at Gate 3 (Vite build
    runs the project's eslint + Babel parse during `npm run build`).
    """
    src_dir = niche_dir / "src"
    if not src_dir.exists():
        return False, f"src/ missing at {src_dir.relative_to(REPO_ROOT)}"

    bad_files: list[tuple[Path, str]] = []
    jsx_count = 0
    for path in src_dir.rglob("*.jsx"):
        jsx_count += 1
        text = path.read_text(errors="ignore")
        clean = _strip_strings_and_comments(text)
        opens = clean.count("{")
        closes = clean.count("}")
        if opens != closes:
            bad_files.append((path, f"unbalanced braces: {opens} open vs {closes} close (after strings + comments stripped)"))
            continue
        unbalanced_tags = _count_jsx_tag_balance(text)
        if unbalanced_tags:
            tag_detail = ", ".join(f"<{tag}> delta={d:+d}" for tag, d in sorted(unbalanced_tags.items()))
            bad_files.append((path, f"unbalanced JSX tags: {tag_detail}"))
            continue

    if bad_files:
        detail = "\n".join(f"  - {p.relative_to(REPO_ROOT)}: {reason}" for p, reason in bad_files)
        return False, f"{len(bad_files)} file(s) failed parse-tier checks:\n{detail}"
    return True, f"parse-tier checks passed on {jsx_count} JSX files (braces + JSX tags balanced)"


# Backward-compat alias for the previous gate name. Some callers may still
# import the old name; the function body now lives at gate_2_jsx_parse.
gate_2_eslint_parse = gate_2_jsx_parse


def gate_3_vite_build(niche_dir: Path, skip_install: bool) -> tuple[bool, str]:
    """Run npm install + npm run build against the niche template with
    sentinels temporarily replaced by synthetic placeholder values.

    The niche template ships sentinel-laden; the Phase 1 prebuild hook
    (validate-brand-dna.mjs without --shape-only) would otherwise halt the
    build on those sentinels. To smoke-test the build at Module 2D time,
    we swap brand-dna.js for a synthetic-filled copy, run the build, then
    restore the original.
    """
    if not (niche_dir / "package.json").exists():
        return False, f"package.json missing at {niche_dir.relative_to(REPO_ROOT)}"

    brand_dna_js = niche_dir / "src" / "config" / "brand-dna.js"
    brand_dna_example = niche_dir / "src" / "config" / "brand-dna.example.js"
    if not brand_dna_js.exists():
        return False, "src/config/brand-dna.js missing"
    if not brand_dna_example.exists():
        return False, "src/config/brand-dna.example.js missing"

    # Snapshot original, then write a synthetic-filled version for the build.
    original = brand_dna_js.read_text()
    synthetic_ok, synthetic_msg = _write_synthetic_filled(brand_dna_js, brand_dna_example)
    if not synthetic_ok:
        return False, f"could not write synthetic brand-dna.js: {synthetic_msg}"

    try:
        if not skip_install:
            install = subprocess.run(
                ["npm", "install", "--silent"],
                cwd=niche_dir,
                capture_output=True,
                text=True,
            )
            if install.returncode != 0:
                return False, f"npm install exit={install.returncode}\n\nSTDOUT:\n{install.stdout[-2000:]}\n\nSTDERR:\n{install.stderr[-2000:]}"

        build = subprocess.run(
            ["npm", "run", "build"],
            cwd=niche_dir,
            capture_output=True,
            text=True,
        )
        if build.returncode != 0:
            return False, f"npm run build exit={build.returncode}\n\nSTDOUT:\n{build.stdout[-3000:]}\n\nSTDERR:\n{build.stderr[-3000:]}"

        dist = niche_dir / "dist"
        if not dist.exists():
            return False, "build succeeded but dist/ not produced"
        return True, f"vite build OK -> {dist.relative_to(REPO_ROOT)} (with synthetic brand-dna fill)"
    finally:
        # Always restore the original sentinel-laden brand-dna.js so the
        # niche template ships in the expected state.
        brand_dna_js.write_text(original)


def _write_synthetic_filled(brand_dna_js: Path, brand_dna_example: Path) -> tuple[bool, str]:
    """Compose a fully-populated brand-dna.js by re-evaluating the example
    via a Node helper and stamping placeholder strings for every sentinel,
    real hex values for palette entries, and Inter for typography.

    Writes the result to brand_dna_js. Returns (ok, message).
    """
    helper_js = (
        "import { brandDNA as example } from './brand-dna.example.js';\n"
        "function fill(obj) {\n"
        "  if (obj === null) return null;\n"
        "  if (Array.isArray(obj)) return obj.map(fill);\n"
        "  if (typeof obj === 'object') {\n"
        "    const out = {};\n"
        "    for (const [k, v] of Object.entries(obj)) out[k] = fill(v);\n"
        "    return out;\n"
        "  }\n"
        "  if (typeof obj === 'string' && /__REQUIRED__[A-Z0-9_]+__/.test(obj)) {\n"
        "    return obj.replace(/__REQUIRED__[A-Z0-9_]+__/g, 'FILLED');\n"
        "  }\n"
        "  return obj;\n"
        "}\n"
        "const filled = fill(example);\n"
        "// Hex palette values must look like real hex so inject-theme.mjs's\n"
        "// hexToRgbTriplet() doesn't throw.\n"
        "filled.palette = {\n"
        "  primary: '#0066cc', primary_dark: '#003366', primary_slate: '#5577aa',\n"
        "  accent: '#ffaa00', accent_light: '#ffcc55', accent_dark: '#cc8800',\n"
        "  neutral: '#aaaaaa', neutral_dim: '#888888', silver: '#cccccc', ink: '#222222',\n"
        "};\n"
        "filled.typography = { heading: 'Inter', body: 'Inter', headingFontUrl: 'Inter', bodyFontUrl: 'Inter' };\n"
        "filled.meta = { title: 'Synthetic Build', description: 'Niche template smoke test' };\n"
        "process.stdout.write('export const brandDNA = ' + JSON.stringify(filled, null, 2) + ';\\nexport default brandDNA;\\n');\n"
    )
    # Write helper to a temp file inside the config dir so its `import` path resolves.
    helper_path = brand_dna_js.parent / ".synthetic-fill.tmp.mjs"
    helper_path.write_text(helper_js)
    try:
        result = subprocess.run(
            ["node", "--input-type=module", "-e", f"import('{helper_path.as_posix()}').catch(e => {{ console.error(e); process.exit(1); }})"],
            cwd=brand_dna_js.parent,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return False, f"node helper exit={result.returncode}: {result.stderr[-500:]}"
        if not result.stdout.strip():
            return False, "node helper produced no output"
        brand_dna_js.write_text(result.stdout)
        return True, "ok"
    finally:
        if helper_path.exists():
            helper_path.unlink()


def _load_ai_vocab_blocklist() -> tuple[list[str], list[str]]:
    """Parse references/copy/ai-vocab-blocklist.md and return
    (single_words, multi_word_phrases). The blocklist is the canonical
    source the copy-deck agent + copy-lint tool reads at Stage 6 + 10.4b;
    Gate 4 reuses it so Module 2D-time enforcement matches runtime
    enforcement (no double standard).

    Returns ([], []) if the file is missing — callers treat that as
    "skip Gate 4 detection on AI vocab" (other heuristics still run).
    """
    blocklist_path = REPO_ROOT / "references" / "copy" / "ai-vocab-blocklist.md"
    if not blocklist_path.exists():
        return [], []
    text = blocklist_path.read_text(errors="ignore")
    single_words: list[str] = []
    phrases: list[str] = []
    # The file is structured with `## Banned words (single tokens)` and
    # `## Banned phrases (multi-word)` headings each followed by a code
    # block of one entry per line. Parse each block by header context.
    current_bucket: list[str] | None = None
    in_code = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("## Banned words"):
            current_bucket = single_words
            in_code = False
            continue
        if stripped.startswith("## Banned phrases"):
            current_bucket = phrases
            in_code = False
            continue
        if stripped.startswith("## "):
            # Some other section (typographic patterns / acceptable exceptions /
            # adding to the list). Stop accumulating.
            current_bucket = None
            in_code = False
            continue
        if stripped.startswith("```"):
            in_code = not in_code
            continue
        if in_code and current_bucket is not None and stripped:
            # Phrases sometimes include alt-forms like "(noting|mentioning)"
            # — keep as-is; the consumer can either treat as regex or as
            # a literal substring. We use substring match below for speed.
            current_bucket.append(stripped)
    return single_words, phrases


def gate_4_design_audit(niche_dir: Path) -> tuple[bool, str]:
    """Soft gate. Surface generic-AI patterns the
    taste/skills/redesign-skill would flag.

    Sources:
      - references/copy/ai-vocab-blocklist.md (the same blocklist
        copy-lint.py + the copy-deck agent enforce at Stage 6 / 10.4b)
      - heuristic CSS / Tailwind class checks for visual AI-slop
        signatures (purple-blue gradients, default 3-column grids)

    Scans every .jsx file under src/ + every .md file under
    niche-playbook/ + the copy-bearing files under .claude/sops/ +
    .claude/agents/. Emits a `WARNINGS:` block the caller writes to
    AUDIT-WARNINGS.md.
    """
    if not niche_dir.exists():
        return True, "niche dir missing — skipping audit"

    hits: list[str] = []

    # --- Heuristic 1: visual AI-slop signatures (Tailwind / CSS) ---
    src_dir = niche_dir / "src"
    if src_dir.exists():
        for path in src_dir.rglob("*.jsx"):
            text = path.read_text(errors="ignore")
            three_col = len(re.findall(r"\b(?:md|lg|xl):?grid-cols-3\b", text))
            if three_col >= 3:
                hits.append(f"{path.relative_to(REPO_ROOT)}: {three_col} three-column grid uses (AI-slop layout signature)")
            if re.search(r"from-blue-\d{3}\b.*\bto-purple-\d{3}\b", text):
                hits.append(f"{path.relative_to(REPO_ROOT)}: purple-blue gradient (AI-slop visual signature)")
            if re.search(r"gradient.*blue.*purple|gradient.*purple.*blue", text, re.I):
                hits.append(f"{path.relative_to(REPO_ROOT)}: blue/purple gradient pattern (AI-slop visual signature)")

    # --- Heuristic 2: AI vocab + phrase blocklist (canonical source) ---
    single_words, phrases = _load_ai_vocab_blocklist()
    if single_words or phrases:
        # Files to scan for vocab. Components + copy-bearing markdown.
        scan_targets: list[Path] = []
        if src_dir.exists():
            scan_targets.extend(src_dir.rglob("*.jsx"))
        playbook = niche_dir / "niche-playbook"
        if playbook.exists():
            scan_targets.extend(playbook.glob("*.md"))
            scan_targets.extend(playbook.glob("*.json"))
        sops = niche_dir / ".claude" / "sops"
        if sops.exists():
            scan_targets.extend(sops.glob("*.md"))
        agents = niche_dir / ".claude" / "agents"
        if agents.exists():
            scan_targets.extend(agents.glob("*.md"))

        # Words: case-insensitive whole-word match
        word_patterns = [(w, re.compile(r"\b" + re.escape(w) + r"\b", re.IGNORECASE)) for w in single_words]
        # Phrases: substring match, case-insensitive (regex alternations in
        # the source are tolerated; they'll match literally, which is
        # acceptable for the heuristic surface).
        phrase_lowers = [p.lower() for p in phrases]

        for path in scan_targets:
            try:
                content = path.read_text(errors="ignore")
            except Exception:
                continue
            content_lower = content.lower()
            for word, pat in word_patterns:
                if pat.search(content):
                    hits.append(f"{path.relative_to(REPO_ROOT)}: AI-vocab word '{word}' (ai-vocab-blocklist.md)")
                    break  # one finding per file is enough for the audit summary
            else:
                for phrase in phrase_lowers:
                    if phrase in content_lower:
                        hits.append(f"{path.relative_to(REPO_ROOT)}: AI-vocab phrase '{phrase}' (ai-vocab-blocklist.md)")
                        break

    if hits:
        return True, "WARNINGS:\n" + "\n".join(f"  - {h}" for h in hits[:50]) + (
            f"\n  ... and {len(hits) - 50} more" if len(hits) > 50 else ""
        )
    if not single_words and not phrases:
        return True, "no visual AI-slop patterns detected (vocab blocklist file missing — vocab scan skipped)"
    return True, f"no generic-AI patterns detected (scanned against {len(single_words)} blocklist words + {len(phrases)} phrases)"


def gate_5_design_token_smoke(niche_dir: Path) -> tuple[bool, str]:
    """Soft gate. Verify the niche-specific design tokens substituted at
    Phase 2 actually appear in the rendered source files.

    Module 2D can't run real SSIM-vs-winner at validate time (no
    `tools/render-template-reference.py` exists — that needs Playwright +
    Pillow + the winner-pick screenshot). The authoritative SSIM check
    lives at Stage 10.4a (`design-fidelity-qa-agent`), against the
    per-client build.

    What this gate DOES check at Module 2D time:
      1. `src/index.css` has every per-niche palette CSS variable + the
         niche typography preset (no surviving `{{...}}` tokens)
      2. `index.html` has the niche-substituted `<title>` + `<meta>` +
         Google Fonts link (no surviving `{{...}}` tokens)
      3. `tailwind.config.js` carries the niche-specific token names
         (sanity check that Phase 2 ran on the .template files)

    Soft warn: misses become WARNINGS the agent writes to
    AUDIT-WARNINGS.md, not a hard halt. Module 2D continues; the per-
    client design fidelity QA at Stage 10.4a is the authoritative gate.
    """
    if not niche_dir.exists():
        return True, "niche dir missing — skipping smoke check"

    warnings: list[str] = []

    index_css = niche_dir / "src" / "index.css"
    if not index_css.exists():
        warnings.append("src/index.css missing (Phase 2 didn't materialise it)")
    else:
        css_text = index_css.read_text(errors="ignore")
        if "{{" in css_text:
            # Find which tokens survived
            survivors = sorted(set(re.findall(r"\{\{([A-Z_]+)\}\}", css_text)))
            warnings.append(f"src/index.css carries surviving tokens: {', '.join(survivors)} (Phase 2 token substitution incomplete)")
        if "--brand-primary" not in css_text and "--color-primary" not in css_text and ":root" not in css_text:
            warnings.append("src/index.css: no `:root` CSS variable block found (palette tokens not surfaced)")

    index_html = niche_dir / "index.html"
    if not index_html.exists():
        warnings.append("index.html missing (Phase 2 didn't materialise it)")
    else:
        html_text = index_html.read_text(errors="ignore")
        if "{{" in html_text:
            survivors = sorted(set(re.findall(r"\{\{([A-Z_]+)\}\}", html_text)))
            warnings.append(f"index.html carries surviving tokens: {', '.join(survivors)} (Phase 2 token substitution incomplete)")
        # The Google Fonts URL surface lives in either index.html or
        # index.css; we don't enforce the exact location, only that one
        # of them has it.
        css_has_fonts = index_css.exists() and "fonts.googleapis.com" in index_css.read_text(errors="ignore")
        html_has_fonts = "fonts.googleapis.com" in html_text
        if not (css_has_fonts or html_has_fonts):
            warnings.append("Neither src/index.css nor index.html imports any Google Fonts (niche typography preset not wired)")

    tailwind_config = niche_dir / "tailwind.config.js"
    if not tailwind_config.exists():
        warnings.append("tailwind.config.js missing (Phase 2 didn't materialise it)")
    else:
        tw_text = tailwind_config.read_text(errors="ignore")
        if "{{" in tw_text:
            survivors = sorted(set(re.findall(r"\{\{([A-Z_]+)\}\}", tw_text)))
            warnings.append(f"tailwind.config.js carries surviving tokens: {', '.join(survivors)} (Phase 2 token substitution incomplete)")

    if warnings:
        return True, "WARNINGS:\n" + "\n".join(f"  - {w}" for w in warnings)
    return True, "design tokens substitution OK (index.css + index.html + tailwind.config.js all niche-filled, no surviving {{...}} tokens, fonts wired)"


# Backward-compat alias for callers / tests that may use the old name.
gate_5_ssim_vs_winner = gate_5_design_token_smoke


# Minimum byte length for a "substantively tailored" SOP or agent. A skeleton
# stub or a near-empty file falls below this; a real niche-tailored document
# (per-stage SOP frame filled with niche-specific values, or an agent doc with
# steps + halt conditions + skill invocations) easily clears it. Tuned to
# catch the "agent wrote a stub then halted" failure mode without false-
# flagging legitimately concise specs.
MIN_TAILORED_LENGTH = 600

# Universal skills any per-niche agent should plausibly invoke (the build,
# QA, and design generation agents all consume at least one of these). If
# every per-niche agent in the .claude/agents/ tree fails to mention any of
# these, that signals "the agent docs are skeleton stubs not wired to the
# universal skill ecosystem."
UNIVERSAL_SKILL_KEYWORDS = (
    "frontend-design",
    "impeccable",
    "ui-ux-pro-max",
    "taste/skills",
    "redesign-skill",
    "copywriting",
    "asset-scraping",
    "design-synthesis",
    "design-language-extraction",
    "nano-banana",
    "template-capture-and-build",
)


def gate_6_factory_completeness(niche_dir: Path) -> tuple[bool, str]:
    """Hard gate. The Claude-driven Module 2D phases must produce every
    required artifact AND properly tailor each per-niche SOP + agent.

    Checks:
      - src/components/ has at least one .jsx file
      - src/pages/ has at least one .jsx file
      - niche-playbook/ has the required JSON files (10)
      - niche-playbook/ has the required markdown contracts (4)
      - .claude/checklists/sop-compliance.md + design-fidelity.md exist
        and are not the unfilled skeletons
      - .claude/sops/ has at least one SOP AND every SOP is properly
        niche-tailored (no `{{slot}}` placeholders, above minimum length)
      - .claude/agents/ has at least one agent AND every agent is properly
        niche-tailored (no `{{slot}}` placeholders, above minimum length,
        invokes at least one universal skill across the agent set)
      - MANIFEST.json exists

    Failure mode hints. When a HARD-fail surfaces a skeleton-shaped or
    untailored SOP/agent, Module 2D Phase 11 loops back to re-run Phase 9
    (per-niche SOP + agent generation). Cap 3 loops; halt with
    GENERATION-FAILED.md if still failing.
    """
    errors: list[str] = []
    # Track which Module 2D phase needs re-running so Phase 11 can route
    # the loop-back to the right Claude-driven step.
    phases_to_retry: set[str] = set()

    components = list((niche_dir / "src" / "components").glob("*.jsx"))
    if not components:
        errors.append("src/components/ is empty (Module 2D Phase 6 not run)")
        phases_to_retry.add("Phase 6 (per-section components)")

    pages = list((niche_dir / "src" / "pages").glob("*.jsx"))
    if not pages:
        errors.append("src/pages/ is empty (Module 2D Phase 7 not run)")
        phases_to_retry.add("Phase 7 (per-route pages)")

    required_playbook_jsons = [
        "copy-locks.json",
        "trust-signals.json",
        "process.json",
        "vocabulary.json",
        "motion-preset.json",
        "theme.json",
        "hero-mood-mapping.json",
        "photo-manifest.json",
        "asset-patterns.json",
        "proposal-pages.json",
    ]
    playbook_dir = niche_dir / "niche-playbook"
    for fname in required_playbook_jsons:
        p = playbook_dir / fname
        if not p.exists():
            errors.append(f"niche-playbook/{fname} missing (Module 2D Phase 8 not complete)")
            phases_to_retry.add("Phase 8 (niche playbook)")

    # Markdown contracts Stage 9 + Stage 10.1 + Stage 13 depend on. Each one
    # is a complete per-niche scaffold (not a fragment of a universal
    # template). Missing => the consuming stage halts at runtime.
    required_playbook_markdowns = [
        "hero-composition.md",
        "copywriting.md",
        "design-vocabulary.md",
        "cro-rules.md",
    ]
    for fname in required_playbook_markdowns:
        p = playbook_dir / fname
        if not p.exists():
            errors.append(f"niche-playbook/{fname} missing (Module 2D Phase 8 not complete)")
            phases_to_retry.add("Phase 8 (niche playbook)")

    sop_compliance = niche_dir / ".claude" / "checklists" / "sop-compliance.md"
    design_fidelity = niche_dir / ".claude" / "checklists" / "design-fidelity.md"
    for path in (sop_compliance, design_fidelity):
        if not path.exists():
            errors.append(f"{path.relative_to(niche_dir)} missing (Module 2D Phase 10 not run)")
            phases_to_retry.add("Phase 10 (per-niche QA checklists)")
        elif "{{" in path.read_text():
            errors.append(f"{path.relative_to(niche_dir)} still has unfilled {{...}} slots")
            phases_to_retry.add("Phase 10 (per-niche QA checklists)")

    # Per-niche SOPs MUST be tailored (no skeleton placeholders, substantive
    # content). Each SOP is read + scored individually.
    sops = sorted((niche_dir / ".claude" / "sops").glob("*.md"))
    if not sops:
        errors.append(".claude/sops/ is empty (Module 2D Phase 9 not run)")
        phases_to_retry.add("Phase 9 (per-niche SOPs + agents)")
    else:
        for sop in sops:
            content = sop.read_text()
            rel = sop.relative_to(niche_dir)
            if "{{" in content:
                errors.append(f"{rel} carries unfilled {{slot}} placeholders (Module 2D Phase 9 didn't tailor this SOP)")
                phases_to_retry.add("Phase 9 (per-niche SOPs + agents)")
            elif len(content) < MIN_TAILORED_LENGTH:
                errors.append(f"{rel} is suspiciously short ({len(content)} chars < {MIN_TAILORED_LENGTH} min); reads as a stub, not a tailored SOP")
                phases_to_retry.add("Phase 9 (per-niche SOPs + agents)")

    # Per-niche agents MUST be tailored AND collectively wire into the
    # universal skill ecosystem.
    agents = sorted((niche_dir / ".claude" / "agents").glob("*.md"))
    if not agents:
        errors.append(".claude/agents/ is empty (Module 2D Phase 9 not run)")
        phases_to_retry.add("Phase 9 (per-niche SOPs + agents)")
    else:
        any_skill_invoked = False
        for agent in agents:
            content = agent.read_text()
            rel = agent.relative_to(niche_dir)
            if "{{" in content:
                errors.append(f"{rel} carries unfilled {{slot}} placeholders (Module 2D Phase 9 didn't tailor this agent)")
                phases_to_retry.add("Phase 9 (per-niche SOPs + agents)")
                continue
            if len(content) < MIN_TAILORED_LENGTH:
                errors.append(f"{rel} is suspiciously short ({len(content)} chars < {MIN_TAILORED_LENGTH} min); reads as a stub, not a tailored agent")
                phases_to_retry.add("Phase 9 (per-niche SOPs + agents)")
                continue
            if any(kw in content for kw in UNIVERSAL_SKILL_KEYWORDS):
                any_skill_invoked = True
        if agents and not any_skill_invoked:
            errors.append(
                ".claude/agents/ does not invoke any universal skill across the entire agent set "
                f"(expected at least one reference to: {', '.join(UNIVERSAL_SKILL_KEYWORDS)}); "
                "Module 2D Phase 9 generated stubs instead of wiring the agents into the skill ecosystem"
            )
            phases_to_retry.add("Phase 9 (per-niche SOPs + agents)")

    manifest = niche_dir / "MANIFEST.json"
    if not manifest.exists():
        errors.append("MANIFEST.json missing (Module 2D Phase 12 not run)")
        phases_to_retry.add("Phase 12 (register + lock)")

    if errors:
        retry_hint = ""
        if phases_to_retry:
            retry_hint = (
                "\n\nLoop-back hint: Module 2D Phase 11 should re-run the "
                "following Claude-driven phases (cap 3 loops):\n  - "
                + "\n  - ".join(sorted(phases_to_retry))
            )
        return False, "Factory completeness check failed:\n  - " + "\n  - ".join(errors) + retry_hint
    return True, "factory completeness OK (components + pages + playbook + SOPs + agents + checklists + manifest, all tailored)"


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the 6 niche-template safety gates")
    parser.add_argument("--niche", required=True, help="Niche slug under templates/")
    parser.add_argument("--skip-install", action="store_true", help="Skip npm install on Gate 3")
    parser.add_argument("--strict", action="store_true", help="Promote soft gates (4, 5) to hard halts")
    args = parser.parse_args()

    niche_dir = TEMPLATES_DIR / args.niche
    if not niche_dir.exists():
        print(f"ERROR: niche template not found: {niche_dir}", file=sys.stderr)
        return 40
    if not niche_dir.is_dir():
        print(f"ERROR: not a directory: {niche_dir}", file=sys.stderr)
        return 40

    print(f"=== Niche template validation for '{args.niche}' ===\n")

    # Clean any prior marker so a successful re-run doesn't leave stale state.
    for fname in ("GENERATION-FAILED.md", "AUDIT-WARNINGS.md"):
        p = niche_dir / fname
        if p.exists():
            p.unlink()

    # Gate 1 — brand-dna shape (HARD)
    print("[Gate 1/6] brand-dna shape contract + JSX path-grep")
    ok, detail = gate_1_brand_dna_shape(niche_dir)
    if not ok:
        print(f"  FAIL: {detail}\n")
        _write_failure_marker(niche_dir, "Gate 1 — brand-dna shape", detail)
        return 10
    print(f"  PASS: {detail or 'shape OK'}\n")

    # Gate 2 — ESLint/parse (HARD)
    print("[Gate 2/6] JSX parse (braces + tag balance)")
    ok, detail = gate_2_jsx_parse(niche_dir)
    if not ok:
        print(f"  FAIL: {detail}\n")
        _write_failure_marker(niche_dir, "Gate 2 — JSX parse", detail)
        return 20
    print(f"  PASS: {detail}\n")

    # Gate 3 — Vite build (HARD)
    print("[Gate 3/6] Vite build smoke")
    ok, detail = gate_3_vite_build(niche_dir, args.skip_install)
    if not ok:
        print(f"  FAIL: {detail}\n")
        _write_failure_marker(niche_dir, "Gate 3 — Vite build", detail)
        return 30
    print(f"  PASS: {detail}\n")

    # Gate 4 — design audit (SOFT or HARD-if-strict)
    print("[Gate 4/6] generic-AI audit (anti-slop blocklist + visual signatures)")
    ok, detail = gate_4_design_audit(niche_dir)
    if "WARNINGS:" in detail:
        print(f"  WARN: {detail}\n")
        _write_audit_warning(niche_dir, "Gate 4 — generic-AI audit", detail)
        if args.strict:
            _write_failure_marker(niche_dir, "Gate 4 — generic-AI audit (strict)", detail)
            return 40
    else:
        print(f"  PASS: {detail}\n")

    # Gate 5 — design token substitution smoke check (SOFT). The
    # SSIM-vs-winner pixel check is at Stage 10.4a (design-fidelity-qa-agent
    # against the per-client build), not here. This gate verifies the
    # niche-tailored design tokens substituted in Phase 2 actually
    # surfaced in index.css + index.html + tailwind.config.js.
    print("[Gate 5/6] design token substitution smoke")
    ok, detail = gate_5_design_token_smoke(niche_dir)
    if "WARNINGS:" in detail:
        print(f"  WARN: {detail}\n")
        _write_audit_warning(niche_dir, "Gate 5 — design token substitution smoke", detail)
        if args.strict:
            _write_failure_marker(niche_dir, "Gate 5 — design token substitution smoke (strict)", detail)
            return 50
    else:
        print(f"  PASS: {detail}\n")

    # Gate 6 — Factory completeness (HARD)
    print("[Gate 6/6] Factory completeness")
    ok, detail = gate_6_factory_completeness(niche_dir)
    if not ok:
        print(f"  FAIL: {detail}\n")
        _write_failure_marker(niche_dir, "Gate 6 — Factory completeness", detail)
        return 60
    print(f"  PASS: {detail}\n")

    print("=== ALL HARD GATES PASSED ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
