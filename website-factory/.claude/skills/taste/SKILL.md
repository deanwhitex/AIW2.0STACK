---
name: taste
description: "Use for anti-slop frontend design: stronger layout variance, opinionated typography, motion direction, anti-AI-aesthetic guardrails. Pick the right sub-skill for the task at hand: redesign-skill for fixing existing UIs, brandkit for brand-board generation, imagegen-frontend-web for hero / landing comps, stitch-skill for Google Stitch DESIGN.md output. Not for backend-only or non-UI tasks."
license: MIT. Copyright (c) 2026 Leonxlnx. See LICENSE.
---

# Taste

This is a collection skill. The actual implementation lives in sub-skills
under `skills/`. This file is the top-level entry point so auto-discovery
picks up the collection; individual sub-skills each carry their own
SKILL.md frontmatter for direct invocation.

## When to use which sub-skill

| Sub-skill | When to use |
|---|---|
| **taste-skill** | Default all-rounder for premium frontend output without locking one narrow visual style. |
| **gpt-tasteskill** | Stricter variant for GPT/Codex: higher layout variance, stronger GSAP direction, aggressive anti-slop. |
| **image-to-code-skill** | Image-first pipeline: generate references, analyze them, then implement to match. |
| **redesign-skill** | Existing projects: audit the UI first, then fix layout, spacing, hierarchy, styling. |
| **soft-skill** | Polished, calm, expensive UI with softer contrast, whitespace, premium fonts, spring motion. |
| **output-skill** | When the model ships half-finished work: full output, no placeholder comments. |
| **minimalist-skill** | Editorial product UI (Notion / Linear vibes), restrained palette, crisp structure. |
| **brutalist-skill** | Hard mechanical language: Swiss type, sharp contrast, experimental layout. BETA. |
| **stitch-skill** | Google Stitch-compatible rules, including optional `DESIGN.md` export format. |
| **imagegen-frontend-web** | Website comps: hero, landing, multi-section with strong typography. Outputs IMAGES (no code). |
| **imagegen-frontend-mobile** | Mobile screens and flows: iOS / Android / cross-platform mockups. Outputs IMAGES (no code). |
| **brandkit** | Brand-kit boards: logo directions, palettes, type, identity applications. Outputs IMAGES. |

## Factory pipeline integration

| Pipeline stage | Sub-skill invoked |
|---|---|
| Module 2D Phase 5a (winner pick + design spec) | `image-to-code-skill` to analyse captured reference pool |
| Module 2D Phase 6 (component generation) | `taste-skill` for general distinctive output |
| Module 2D Phase 12 Gate 4 (taste audit) | `redesign-skill` to flag generic-AI patterns |
| Stage 9 hero image (08-hero-image.md) | `imagegen-frontend-web` for hero composition reference |
| Stage 10.3 uplift (11-uplift.md) | `taste-skill` for premium polish moves |

## How to invoke

Read `skills/<sub-skill-name>/SKILL.md` directly. Each sub-skill is a
standalone unit with its own frontmatter, allowed-tools list, and
instruction body.

Do NOT load every sub-skill at once. Pick the one that matches the task
based on the table above, then read only that file.

## Source

Upstream: https://github.com/Leonxlnx/taste-skill
Local README with full installation + examples: `README.md` (in this directory).
