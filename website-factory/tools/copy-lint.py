#!/usr/bin/env python3
"""
copy-lint.py

Scans generated client copy against the AI-vocab blocklist and the typographic
standards in `references/copy/`. Used by the copy-deck agent (Stage 6) and the
SOP QA agent (Stage 10b) as a hard fail gate.

Usage:
    tools/copy-lint.py --check <file>                # exit 1 on any hit
    tools/copy-lint.py --check <file> [<file> ...]   # check multiple files
    tools/copy-lint.py --check --include-niche <slug> <file>
                                                     # also load niche
                                                     # playbook's blocklist
                                                     # additions
    tools/copy-lint.py --fix <file>                  # rewrite straight quotes
                                                     # to curly in-place
                                                     # (does NOT fix vocab)

Exit codes:
    0  clean
    1  one or more findings
    2  tool error

Vocab and patterns live at:
    website-factory/references/copy/ai-vocab-blocklist.md
    website-factory/references/copy/typographic-standards.md

Niche playbook extension (when --include-niche provided):
    website-factory/templates/{niche-slug}/niche-playbook/copy-blocklist-additions.md
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

FACTORY_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_BLOCKLIST = FACTORY_ROOT / "references" / "copy" / "ai-vocab-blocklist.md"


def parse_blocklist(md_path: Path) -> tuple[list[str], list[str]]:
    """Extract banned single tokens and banned phrases from the blocklist markdown.

    The markdown uses fenced code blocks to list patterns. Single tokens are in
    the first fenced block under '## Banned words'. Multi-word phrases are in
    the second fenced block under '## Banned phrases'.
    """
    if not md_path.exists():
        raise FileNotFoundError(f"blocklist not found: {md_path}")
    content = md_path.read_text(encoding="utf-8")

    # Extract fenced code blocks under specific headings.
    sections = re.split(r"^## ", content, flags=re.MULTILINE)
    words: list[str] = []
    phrases: list[str] = []

    for sec in sections:
        title = sec.splitlines()[0].lower() if sec.strip() else ""
        m = re.search(r"```\n(.*?)```", sec, flags=re.DOTALL)
        if not m:
            continue
        block_lines = [l.strip() for l in m.group(1).splitlines() if l.strip()]
        if "banned words" in title:
            words.extend(block_lines)
        elif "banned phrases" in title:
            phrases.extend(block_lines)

    return words, phrases


def is_in_quoted_review(text: str, pos: int) -> bool:
    """Heuristic: a hit inside a curly-quoted block is a quoted review."""
    before = text[:pos]
    open_q = max(before.rfind("“"), before.rfind('"'))
    close_q = max(before.rfind("”"), before.rfind('"'))
    return open_q > close_q


def mask_code_blocks(text: str) -> str:
    """Replace content inside fenced code blocks (```...```) and inline code
    spans (`...`) with spaces, preserving line numbers and offsets. This stops
    the scanner flagging --flag args, regex examples, code fragments that are
    not delivered copy."""
    out = list(text)

    # Fenced code blocks (``` ... ```)
    in_fence = False
    i = 0
    while i < len(out) - 2:
        if out[i] == "`" and out[i + 1] == "`" and out[i + 2] == "`":
            in_fence = not in_fence
            i += 3
            continue
        if in_fence and out[i] != "\n":
            out[i] = " "
        i += 1

    # Inline code spans (`...`) — single backticks. Skip remaining backticks
    # since fenced regions are already neutralised above.
    text2 = "".join(out)
    result = []
    in_inline = False
    i = 0
    while i < len(text2):
        ch = text2[i]
        if ch == "`":
            in_inline = not in_inline
            result.append("`")
        elif in_inline and ch != "\n":
            result.append(" ")
        else:
            result.append(ch)
        i += 1
    return "".join(result)


def scan(file_path: Path, words: list[str], phrases: list[str]) -> list[dict]:
    """Return a list of finding dicts: { line, col, kind, pattern, snippet }."""
    raw_text = file_path.read_text(encoding="utf-8")
    # Mask code blocks + inline code spans (positions/lines preserved). Hits
    # inside code are not delivered copy.
    text = mask_code_blocks(raw_text)
    findings: list[dict] = []

    # Compile patterns: word boundaries for single tokens, plain regex for phrases.
    for w in words:
        pat = re.compile(rf"\b{re.escape(w)}\b", flags=re.IGNORECASE)
        for m in pat.finditer(text):
            if is_in_quoted_review(text, m.start()):
                continue
            line_no = text.count("\n", 0, m.start()) + 1
            findings.append({
                "kind": "vocab-word",
                "pattern": w,
                "line": line_no,
                "snippet": text[max(0, m.start() - 30):m.end() + 30].replace("\n", " "),
            })

    for p in phrases:
        pat = re.compile(re.escape(p), flags=re.IGNORECASE)
        for m in pat.finditer(text):
            if is_in_quoted_review(text, m.start()):
                continue
            line_no = text.count("\n", 0, m.start()) + 1
            findings.append({
                "kind": "vocab-phrase",
                "pattern": p,
                "line": line_no,
                "snippet": text[max(0, m.start() - 30):m.end() + 30].replace("\n", " "),
            })

    # Em-dash audit (universal hard fail).
    for m in re.finditer(r"—", text):
        line_no = text.count("\n", 0, m.start()) + 1
        findings.append({
            "kind": "em-dash",
            "pattern": "—",
            "line": line_no,
            "snippet": text[max(0, m.start() - 30):m.end() + 30].replace("\n", " "),
        })
    for m in re.finditer(r"(?<![\d-])--(?![\d-])", text):
        # Skip front-matter triple-dash lines `---`, common in YAML/markdown headers.
        # The check above ignores `---` already via word-boundary, but a defensive
        # extra check: skip if line is only dashes.
        line_start = text.rfind("\n", 0, m.start()) + 1
        line_end = text.find("\n", m.start())
        line = text[line_start: line_end if line_end >= 0 else len(text)]
        if line.strip() in ("---", "----"):
            continue
        line_no = text.count("\n", 0, m.start()) + 1
        findings.append({
            "kind": "em-dash-ascii",
            "pattern": "--",
            "line": line_no,
            "snippet": text[max(0, m.start() - 30):m.end() + 30].replace("\n", " "),
        })

    # Straight-quote audit (warn unless --fix). Use the unmasked raw text so
    # we count real visible glyphs; code spans are still excluded by counting
    # post-mask if straight quotes inside code blocks should be ignored. Keep
    # raw count here — operator can decide.
    straight_double = raw_text.count('"')
    straight_single_apostrophe = len(re.findall(r"\w'\w", raw_text))
    if straight_double > 0:
        findings.append({
            "kind": "straight-quotes-double",
            "pattern": '"',
            "line": 0,
            "snippet": f"{straight_double} straight double-quote chars in file",
        })
    if straight_single_apostrophe > 0:
        findings.append({
            "kind": "straight-quotes-apostrophe",
            "pattern": "'",
            "line": 0,
            "snippet": f"{straight_single_apostrophe} straight apostrophes in file",
        })

    return findings


def fix_quotes(file_path: Path) -> int:
    """Rewrite straight quotes to curly in-place. Returns count of changes."""
    text = file_path.read_text(encoding="utf-8")
    original = text

    # Apostrophe inside a word: \w'\w → \w’\w
    text = re.sub(r"(\w)'(\w)", r"\1’\2", text)

    # Paired double quotes: "..." → ..."
    text = re.sub(r'"([^"\n]+)"', r"“\1”", text)

    # Paired single quotes (word-boundary): '...' → '‘...’'
    text = re.sub(r"(?<!\w)'([^'\n]+)'(?!\w)", r"‘\1’", text)

    # Three ASCII dots → ellipsis
    text = re.sub(r"\.{3}", "…", text)

    if text != original:
        file_path.write_text(text, encoding="utf-8")
    return abs(len(text) - len(original))


def main() -> int:
    parser = argparse.ArgumentParser(description="Copy lint: AI vocab + typographic standards.")
    parser.add_argument("files", nargs="+", help="files to scan")
    parser.add_argument("--check", action="store_true", help="check mode (default)")
    parser.add_argument("--fix", action="store_true", help="rewrite straight quotes in-place")
    parser.add_argument("--include-niche", default=None, help="niche slug for playbook additions")
    parser.add_argument("--blocklist", default=str(DEFAULT_BLOCKLIST), help="path to blocklist md")
    parser.add_argument("--strict-quotes", action="store_true", help="fail on straight quotes (default: warn only)")
    args = parser.parse_args()

    if args.fix:
        total = 0
        for f in args.files:
            n = fix_quotes(Path(f))
            print(f"fixed {f}: {n} bytes adjusted")
            total += n
        return 0

    blocklist_path = Path(args.blocklist)
    try:
        words, phrases = parse_blocklist(blocklist_path)
    except FileNotFoundError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    # Niche playbook additions
    if args.include_niche:
        addl = FACTORY_ROOT / "templates" / args.include_niche / "niche-playbook" / "copy-blocklist-additions.md"
        if addl.exists():
            try:
                w2, p2 = parse_blocklist(addl)
                words.extend(w2)
                phrases.extend(p2)
            except Exception as e:
                print(f"warning: could not load niche additions: {e}", file=sys.stderr)
        else:
            print(f"note: no niche playbook additions at {addl}", file=sys.stderr)

    # Findings of these kinds are warnings unless --strict-quotes is set.
    SOFT_KINDS = {"straight-quotes-double", "straight-quotes-apostrophe"}

    hard_total = 0
    soft_total = 0
    for f in args.files:
        path = Path(f)
        if not path.exists():
            print(f"error: file not found: {f}", file=sys.stderr)
            return 2
        findings = scan(path, words, phrases)
        hard = [fnd for fnd in findings if fnd["kind"] not in SOFT_KINDS or args.strict_quotes]
        soft = [fnd for fnd in findings if fnd["kind"] in SOFT_KINDS and not args.strict_quotes]
        if hard or soft:
            print(f"\n== {f}: {len(hard)} hard finding(s), {len(soft)} soft warning(s) ==")
            for fnd in hard:
                loc = f":{fnd['line']}" if fnd["line"] else ""
                print(f"  [{fnd['kind']}]{loc}  {fnd['pattern']!r}  …{fnd['snippet'].strip()}…")
            for fnd in soft:
                loc = f":{fnd['line']}" if fnd["line"] else ""
                print(f"  WARN [{fnd['kind']}]{loc}  {fnd['pattern']!r}  {fnd['snippet'].strip()}")
        hard_total += len(hard)
        soft_total += len(soft)

    if hard_total > 0:
        msg = f"\ncopy-lint: FAIL  ({hard_total} hard finding{'s' if hard_total != 1 else ''}"
        if soft_total > 0:
            msg += f", {soft_total} soft warning{'s' if soft_total != 1 else ''}"
        msg += f" across {len(args.files)} file{'s' if len(args.files) != 1 else ''})"
        print(msg)
        return 1

    if soft_total > 0:
        print(f"copy-lint: PASS with {soft_total} soft warning{'s' if soft_total != 1 else ''}  ({len(args.files)} file{'s' if len(args.files) != 1 else ''})")
    else:
        print(f"copy-lint: PASS  ({len(args.files)} file{'s' if len(args.files) != 1 else ''}, 0 findings)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
