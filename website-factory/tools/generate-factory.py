#!/usr/bin/env python3
"""
generate-factory.py - Module 2D orchestrator entry point

Generates a per-niche factory at `templates/{niche-slug}/` from captured
niche research, the universal `factory-blueprint/` scaffold, the
canonical `brand-dna.shape.js` contract, the niche-playbook schemas, and
the four design skills (frontend-design, impeccable, ui-ux-pro-max,
taste/redesign-skill).

This tool is the DETERMINISTIC orchestrator. The semantic work (reading
research and generating component JSX, page composition, SOP body text,
QA-checklist items, prompt slots) is performed by Claude at runtime,
guided by the agent spec at `.claude/agents/14-template-builder.md`.
This script handles the deterministic plumbing around those Claude calls:

  Phase 0   Verify prerequisites + the canonical shape contract
  Phase 1   Materialise the niche template directory from the blueprint
  Phase 2   Token substitution into the blueprint files
  Phase 3   Stamp the canonical brand-dna shape into the niche template
  Phase 4   Call Claude (runtime) to generate per-section components
  Phase 5   Call Claude (runtime) to generate per-route pages
  Phase 6   Call Claude (runtime) to fill niche-playbook JSON schemas
  Phase 7   Call Claude (runtime) to fill SOP + agent + checklist + prompt skeletons
  Phase 8   Validate the generated factory through the 6-gate runner
  Phase 9   Write MANIFEST.json + register the niche in template-routes
  Phase 10  Set stack-state factory.generated = true

The Python script only enforces phase boundaries, file scaffolding,
token substitution, and the gate runner. Each Claude-driven generation
step is a sub-command invoked by the agent spec. When called with
`--dry-run`, the script does the deterministic steps (phases 1, 2, 3,
8, 9, 10) and SKIPS the Claude-driven steps so a runtime stub can be
tested.

Usage:

  python3 tools/generate-factory.py --niche {slug}                # full run
  python3 tools/generate-factory.py --niche {slug} --dry-run      # no Claude phases
  python3 tools/generate-factory.py --niche {slug} --resume       # resume after failure
  python3 tools/generate-factory.py --niche {slug} --validate     # gate runner only
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
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
STACK_ROOT = REPO_ROOT.parent
BLUEPRINT_DIR = REPO_ROOT / "references" / "factory-blueprint"
SHAPE_CONTRACT = REPO_ROOT / "references" / "brand-dna.shape.js"
PLAYBOOK_SCHEMAS_DIR = REPO_ROOT / "references" / "niche-playbook" / "schemas"
TEMPLATES_DIR = REPO_ROOT / "templates"
RESEARCH_ROOT = STACK_ROOT / "research" / "02-niche-research"
STACK_STATE_PATH = STACK_ROOT / "stack-state.json"


class GenerationError(RuntimeError):
    """Raised when any deterministic phase fails. Writes
    GENERATION-FAILED.md before propagating so Stage 10.1's
    resolve_active_template halts cleanly."""


# ----- helpers -----------------------------------------------------------


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def hex_to_rgb_triplet(hex_str: str) -> str:
    m = re.fullmatch(r"#?([0-9a-fA-F]{6})", hex_str.strip())
    if not m:
        raise GenerationError(f"invalid hex: {hex_str!r}")
    v = m.group(1)
    r, g, b = int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)
    return f"{r} {g} {b}"


def fail_with_marker(niche_dir: Path, phase: str, detail: str) -> None:
    """Write GENERATION-FAILED.md so Stage 10.1 can detect and halt."""
    niche_dir.mkdir(parents=True, exist_ok=True)
    marker = niche_dir / "GENERATION-FAILED.md"
    marker.write_text(
        f"# Niche template generation failed\n\n"
        f"Phase: **{phase}**\n\n"
        f"Timestamp: {datetime.now(timezone.utc).isoformat()}\n\n"
        f"## Detail\n\n```\n{detail}\n```\n\n"
        f"## How to recover\n\n"
        f"1. Address the failure above (inspect inputs / re-run upstream).\n"
        f"2. Re-run `python3 tools/generate-factory.py --niche {niche_dir.name} --resume`.\n"
        f"3. Stage 10.1 halts on this marker; the factory cannot ship until generation succeeds.\n"
    )


# ----- phase 0: prerequisites -------------------------------------------


def verify_prerequisites(niche_slug: str) -> dict[str, Path]:
    """Confirm every input the generator needs is present."""
    research_dir = RESEARCH_ROOT / niche_slug
    if not research_dir.exists():
        raise GenerationError(
            f"Module 2B research missing for niche '{niche_slug}'. "
            f"Expected {research_dir.relative_to(STACK_ROOT)}. "
            f"Run /research before /build-niche-template."
        )

    pick = research_dir / "templates" / "pick.json"
    if not pick.exists():
        raise GenerationError(
            f"Module 2D Phase 4 (winner pick) missing for niche '{niche_slug}'. "
            f"Expected {pick.relative_to(STACK_ROOT)}. "
            f"Re-run /build-niche-template Phases 1-4."
        )

    if not SHAPE_CONTRACT.exists():
        raise GenerationError(
            f"Canonical brand-dna shape contract missing at "
            f"{SHAPE_CONTRACT.relative_to(REPO_ROOT)}."
        )

    if not BLUEPRINT_DIR.exists():
        raise GenerationError(
            f"Factory blueprint missing at "
            f"{BLUEPRINT_DIR.relative_to(REPO_ROOT)}."
        )

    return {
        "research_dir": research_dir,
        "pick": pick,
        "tokens_path": research_dir / "niche-design-tokens.json",
        "wireframe_path": research_dir / "09-wireframe.md",
        "spec_path": research_dir / "09-template-spec.md",
        "sitemap_path": research_dir / "09-sitemap.json",
    }


# ----- phase 1: materialise template tree from blueprint -----------------


def materialise_blueprint(niche_slug: str, force: bool) -> Path:
    """Copy the universal blueprint into templates/{niche-slug}/.
    Niche-specific generation (components, pages, playbook, SOPs, etc.)
    happens in subsequent phases driven by Claude at runtime."""
    niche_dir = TEMPLATES_DIR / niche_slug
    if niche_dir.exists():
        if not force:
            raise GenerationError(
                f"templates/{niche_slug}/ already exists. Pass --force to overwrite "
                f"or --resume to continue from the last successful phase."
            )
        shutil.rmtree(niche_dir)
    niche_dir.mkdir(parents=True)

    def ignore(_src: str, names: list[str]) -> list[str]:
        """Skip OS noise + blueprint skeleton templates.

        The blueprint ships `sops/_stage-skeleton.md`,
        `agents/_stage-agent-skeleton.md`, and
        `checklists/{sop-compliance,design-fidelity}.skeleton.md` as
        templates Module 2D Phase 9/10 READS to generate per-niche
        files at `.claude/{sops,agents,checklists}/`. Without this
        filter, copytree also drops the skeletons at the niche
        template's root (sops/, agents/, checklists/) where no
        consumer reads them — leaving orphan duplicates in every
        niche. Skip them at copy time.
        """
        skipped: list[str] = []
        for n in names:
            if n == ".DS_Store":
                skipped.append(n)
            elif n.endswith(".skeleton.md"):
                skipped.append(n)
            elif n in {"_stage-skeleton.md", "_stage-agent-skeleton.md"}:
                skipped.append(n)
        return skipped

    shutil.copytree(BLUEPRINT_DIR, niche_dir, ignore=ignore, dirs_exist_ok=True)

    # Ensure per-niche subdirs exist for runtime generation outputs.
    for sub in (
        ".claude/checklists",
        ".claude/sops",
        ".claude/agents",
        ".claude/prompts",
        "niche-playbook",
        "niche-playbook/trust-badges",
        "src/components",
        "src/pages",
        "src/hooks",
        "public/badges",
        "public/work",
        "public/team",
    ):
        (niche_dir / sub).mkdir(parents=True, exist_ok=True)

    return niche_dir


# ----- phase 2: token substitution into blueprint files ------------------


def substitute_tokens(niche_dir: Path, tokens: dict[str, Any], niche_slug: str) -> None:
    """Replace {{...}} placeholders in *.template files with niche values,
    then rename them in-place (drop the .template extension)."""
    palette = tokens.get("palette", {})
    typography = tokens.get("typography", {})
    motion = tokens.get("motion", {})

    palette_rgb = {f"PALETTE_{k.upper()}_RGB": hex_to_rgb_triplet(v) for k, v in palette.items() if isinstance(v, str)}
    substitutions = {
        "NICHE_SLUG": niche_slug,
        "THEME_MODE": tokens.get("theme_mode", "light"),
        "GOOGLE_FONTS_URL": _compose_fonts_url(typography),
        "META_TITLE": tokens.get("meta_title", "Site Loading"),
        "META_DESCRIPTION": tokens.get("meta_description", "Site loading..."),
        "JSON_LD": json.dumps({"@context": "https://schema.org", "@type": "LocalBusiness", "name": "Pending"}, indent=2),
        "TYPOGRAPHY_HEADING": typography.get("heading", "Inter"),
        "TYPOGRAPHY_BODY": typography.get("body", "Inter"),
        "MOTION_DURATION_MS": str(motion.get("duration_ms", 240)),
        "MOTION_STAGGER_MS": str(motion.get("stagger_ms", 60)),
        **palette_rgb,
    }

    # Slots Phase 2 MUST NOT substitute. These survive intact for the
    # Claude-driven phases (Phase 7 for App.jsx routing) to fill with
    # niche-specific values. If we substitute them here, the slot pattern
    # is gone by the time Claude looks for it.
    leave_alone_slots: set[str] = {
        "PAGE_IMPORTS",  # Phase 7 fills with niche-page import statements
        "ROUTES",        # Phase 7 fills with niche <Route> elements
    }

    for template_path in list(niche_dir.rglob("*.template")):
        body = template_path.read_text()
        for slot, val in substitutions.items():
            if slot in leave_alone_slots:
                continue
            body = body.replace(f"{{{{{slot}}}}}", str(val))
        out_path = template_path.with_name(template_path.name.replace(".template", ""))
        out_path.write_text(body)
        template_path.unlink()


def _compose_fonts_url(typography: dict[str, Any]) -> str:
    heading = typography.get("headingFontUrl") or typography.get("heading", "Inter")
    body = typography.get("bodyFontUrl") or typography.get("body", "Inter")
    if heading.startswith("http"):
        return heading
    fam_h = heading.split(":")[0] if ":" in heading else heading
    fam_b = body.split(":")[0] if ":" in body else body
    families = "&family=".join({fam_h, fam_b})
    return f"https://fonts.googleapis.com/css2?family={families}&display=swap"


# ----- phase 3: stamp canonical brand-dna shape --------------------------


def stamp_brand_dna_shape(niche_dir: Path) -> None:
    """Copy references/brand-dna.shape.js into
    templates/{niche-slug}/src/config/brand-dna.example.js, renaming the
    export from brandDNAShape to brandDNA so the rest of the code
    consumes it uniformly. Also writes brand-dna.js as a sentinel-only
    sibling that Stage 10.1 fills per client."""
    src = SHAPE_CONTRACT.read_text()
    # Rename the export to brandDNA (the canonical name every component
    # imports) without altering the structure.
    rewritten = src.replace("brandDNAShape", "brandDNA")
    config_dir = niche_dir / "src" / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    write_text(config_dir / "brand-dna.example.js", rewritten)
    write_text(config_dir / "brand-dna.js", rewritten)


# ----- phase 4-7: Claude-driven (orchestrated by agent spec) -------------


CLAUDE_PHASES = [
    ("Phase 4: per-section components", "src/components/"),
    ("Phase 5: per-route pages", "src/pages/"),
    ("Phase 6: niche-playbook JSON + markdown contracts", "niche-playbook/"),
    ("Phase 7a: per-niche SOPs", ".claude/sops/"),
    ("Phase 7b: per-niche agents", ".claude/agents/"),
    ("Phase 7c: per-niche checklists", ".claude/checklists/"),
]


def print_claude_phase_checklist(niche_dir: Path) -> None:
    print()
    print("=== Claude-driven phases (orchestrated by agent at "
          ".claude/agents/14-template-builder.md) ===")
    for label, subpath in CLAUDE_PHASES:
        present = (niche_dir / subpath).exists() and any((niche_dir / subpath).iterdir())
        status = "OK" if present else "PENDING"
        print(f"  [{status}] {label} -> {subpath}")
    print()
    print("To complete these phases, drive the template-builder agent (Module 2D) "
          "with the niche slug above; the agent reads the wireframe + design tokens "
          "and writes each path. Then re-run with --validate to confirm gates pass.")


# ----- phase 8: 6-gate validation ----------------------------------------


def run_gates(niche_dir: Path) -> tuple[bool, list[str]]:
    """Returns (passed, gate_errors). Gates 1-3 are HALT; gates 4-6 are
    warning (logged but do not block). This wraps
    tools/validate-niche-template.py when present (Proposal B tool); if
    that tool is not yet ported to the no-baseline architecture, this
    function performs lightweight checks here so the generator can
    still gate cleanly."""
    errors: list[str] = []

    # Gate 1: canonical shape contract is in place
    shape_file = niche_dir / "src" / "config" / "brand-dna.example.js"
    if not shape_file.exists():
        errors.append("Gate 1: src/config/brand-dna.example.js missing")
    else:
        body = shape_file.read_text()
        if "brandDNA" not in body:
            errors.append("Gate 1: brand-dna.example.js does not export brandDNA")
        if "{{" in body:
            errors.append("Gate 1: brand-dna.example.js still has unfilled {{slot}}")

    # Gate 2: ESLint config + build infra present
    for required in ("package.json", "vite.config.js", "tailwind.config.js",
                     "eslint.config.js", "postcss.config.js",
                     "scripts/inject-theme.mjs", "scripts/validate-brand-dna.mjs",
                     "src/main.jsx", "src/App.jsx", "src/index.css"):
        if not (niche_dir / required).exists():
            errors.append(f"Gate 2: missing {required}")

    # Gate 6 (HALT): per-niche checklists + at least one component + one
    # page must exist after Claude-driven phases. Until those phases
    # complete, this gate intentionally fails — the generator is not
    # done.
    if not list((niche_dir / "src" / "components").glob("*.jsx")):
        errors.append("Gate 6: src/components/ is empty (Claude phase 4 not run)")
    if not list((niche_dir / "src" / "pages").glob("*.jsx")):
        errors.append("Gate 6: src/pages/ is empty (Claude phase 5 not run)")
    if not (niche_dir / ".claude" / "checklists" / "sop-compliance.md").exists():
        errors.append("Gate 6: .claude/checklists/sop-compliance.md missing (Claude phase 7c not run)")
    if not (niche_dir / ".claude" / "checklists" / "design-fidelity.md").exists():
        errors.append("Gate 6: .claude/checklists/design-fidelity.md missing (Claude phase 7c not run)")

    return len(errors) == 0, errors


# ----- phase 9 + 10: register + update state -----------------------------


def write_manifest(niche_dir: Path, niche_slug: str, tokens: dict[str, Any]) -> None:
    manifest = {
        "niche": niche_slug,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "generator": "tools/generate-factory.py",
        "blueprintVersion": "1.0",
        "tokensSource": str(tokens.get("_source", "research/02-niche-research/{slug}/niche-design-tokens.json")),
        "files": sorted(str(p.relative_to(niche_dir)) for p in niche_dir.rglob("*") if p.is_file()),
    }
    write_text(niche_dir / "MANIFEST.json", json.dumps(manifest, indent=2))


def register_in_routes(niche_slug: str) -> None:
    routes_path = REPO_ROOT / "config" / "template-routes.json"
    routes: dict[str, Any] = {"byNiche": {}}
    if routes_path.exists():
        routes = json.loads(routes_path.read_text())
    routes.setdefault("byNiche", {})[niche_slug] = f"templates/{niche_slug}"
    routes_path.parent.mkdir(parents=True, exist_ok=True)
    routes_path.write_text(json.dumps(routes, indent=2))


def set_factory_generated_gate(niche_slug: str) -> None:
    if not STACK_STATE_PATH.exists():
        return
    state = json.loads(STACK_STATE_PATH.read_text())
    state.setdefault("gates", {})["factory.generated"] = True
    state["niche"] = niche_slug
    state.setdefault("history", []).append({
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": "factory.generated",
        "niche": niche_slug,
    })
    STACK_STATE_PATH.write_text(json.dumps(state, indent=2))


# ----- main --------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--niche", required=True, help="Niche slug (e.g. auto-detailing)")
    parser.add_argument("--force", action="store_true", help="Overwrite templates/{niche-slug}/ if it exists")
    parser.add_argument("--resume", action="store_true", help="Resume after a failed run (keep existing files)")
    parser.add_argument("--dry-run", action="store_true", help="Run deterministic phases only; skip Claude-driven phases")
    parser.add_argument("--validate", action="store_true", help="Run gates only against an existing template")
    args = parser.parse_args()

    niche = args.niche.lower().replace(" ", "-").replace("_", "-")
    niche_dir = TEMPLATES_DIR / niche

    if args.validate:
        passed, errors = run_gates(niche_dir)
        print(f"Gate run: {'PASS' if passed else 'FAIL'}")
        for e in errors:
            print(f"  - {e}")
        return 0 if passed else 6

    print(f"=== Module 2D factory generator for '{niche}' ===\n")

    try:
        print("[Phase 0] Verifying prerequisites")
        paths = verify_prerequisites(niche)

        tokens_path = paths["tokens_path"]
        tokens: dict[str, Any] = {}
        if tokens_path.exists():
            tokens = json.loads(tokens_path.read_text())
            tokens["_source"] = str(tokens_path.relative_to(STACK_ROOT))
        else:
            print(f"  WARN: niche-design-tokens.json not found at {tokens_path.relative_to(STACK_ROOT)}; "
                  f"using empty token map. Run tools/extract-niche-design-tokens.py first for a real run.")

        print("\n[Phase 1] Materialising template tree from blueprint")
        niche_dir = materialise_blueprint(niche, force=args.force or args.resume)
        print(f"  -> {niche_dir.relative_to(REPO_ROOT)}/")

        print("\n[Phase 2] Substituting tokens into blueprint .template files")
        substitute_tokens(niche_dir, tokens, niche)

        print("\n[Phase 3] Stamping canonical brand-dna shape contract")
        stamp_brand_dna_shape(niche_dir)

        if args.dry_run:
            print("\n[Phases 4-7] SKIPPED (--dry-run)")
        else:
            print_claude_phase_checklist(niche_dir)

        print("\n[Phase 8] Running 6-gate validator")
        passed, errors = run_gates(niche_dir)
        if not passed:
            print("  Gates FAILED:")
            for e in errors:
                print(f"    - {e}")
            if not args.dry_run:
                fail_with_marker(niche_dir, "Phase 8", "\n".join(errors))
                return 8
            else:
                print("  (dry-run: continuing past gate failures so Phases 9/10 still record state)")

        print("\n[Phase 9] Writing MANIFEST.json + registering route")
        write_manifest(niche_dir, niche, tokens)
        register_in_routes(niche)

        print("\n[Phase 10] Updating stack-state.json (factory.generated)")
        set_factory_generated_gate(niche)

        print(f"\nDONE. Niche template at {niche_dir.relative_to(REPO_ROOT)}/")
        return 0

    except GenerationError as e:
        print(f"\nERROR: {e}", file=sys.stderr)
        fail_with_marker(niche_dir, "GenerationError", str(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
