# Third-Party Software

This repository bundles four design + UI/UX skills as Claude Code plugins under their original open-source licenses. Each plugin sits in its own directory with the original `LICENSE` file intact.

## Bundled plugins

| Plugin | License | Path | Original source |
|---|---|---|---|
| **impeccable** | Apache 2.0 | `website-factory/.claude/skills/impeccable/` | Paul Bakaus (2025–2026); extends Anthropic's frontend-design skill |
| **taste** | MIT | `website-factory/.claude/skills/taste/` | Leonxlnx (2026) |
| **ui-ux-pro-max** | MIT (root) + Apache 2.0 (`ui-styling/` subfolder) | `website-factory/.claude/skills/ui-ux-pro-max/` | Next Level Builder (2024) |
| **frontend-design** | Apache 2.0 | `website-factory/.claude/skills/frontend-design/` | Anthropic |

## Where to find each license

Each plugin directory contains its full license text:

- `website-factory/.claude/skills/impeccable/LICENSE` — Apache 2.0
- `website-factory/.claude/skills/impeccable/NOTICE.md` — attribution to Paul Bakaus, Anthropic, ehmo
- `website-factory/.claude/skills/taste/LICENSE` — MIT
- `website-factory/.claude/skills/ui-ux-pro-max/ui-ux-pro-max-skill-main/LICENSE` — MIT
- `website-factory/.claude/skills/ui-ux-pro-max/ui-ux-pro-max-skill-main/.claude/skills/ui-styling/LICENSE.txt` — Apache 2.0
- `website-factory/.claude/skills/frontend-design/frontend-design/LICENSE` — Apache 2.0

## Redistribution

This stack is bundled and redistributed under each plugin's original license. No plugin code has been modified. All original copyright, attribution, and license notices are preserved. If you fork or redistribute this repo, keep these LICENSE and NOTICE files alongside the plugin code.

## Stack code

The remainder of this repository (the AIW 2.0 Stack itself — agents, commands, SOPs, tools, templates, schemas, and content engine) is separate from the bundled plugins and carries its own licensing. The plugins above are the only third-party software bundled here.
