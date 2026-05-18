# AI-vocab Blocklist (Foundation)

Universal blocklist of vocabulary that signals AI-generated copy. Loaded by
`tools/copy-lint.py` and by the copy-deck-agent (Stage 6) + brand-resonance-
agent (Stage 7.5) as a hard fail.

The niche playbook (`templates/{niche-slug}/niche-playbook/copywriting.md`) may
add niche-specific bans on top of this universal list, but never remove from it.

Source: synthesised from `research/_framework/web-design-research-2026-05.md`
(section 2 anti-patterns) plus the documented AI-writing tells cited there
(oliviacal.com, productiveshop.com, michaelkristof.substack.com, etc.).

## How to use

The copy-deck agent and the copy-lint tool scan generated copy against the
patterns below. Any case-insensitive hit is a hard fail at Stage 10b QA. The
fix is to rewrite the offending sentence in plain language with a specific
claim or concrete detail.

## Banned words (single tokens)

These words almost never make copy better. Each one has a plain-language
substitute that improves the sentence by replacing it.

```
realm
tapestry
beacon
symphony
testament
delve
moreover
furthermore
indeed
elevate
empower
underscore
pivotal
seamless
robust
synergize
synergy
leverage
optimize
optimise
ecosystem
ideate
unparalleled
unprecedented
groundbreaking
revolutionary
cutting-edge
state-of-the-art
world-class
best-in-class
next-generation
top-tier
premier
boutique
passionate
committed
dedicated
```

## Banned phrases (multi-word)

Stock AI sentence-starter patterns. None of these survive a copy-lint pass.

```
in the realm of
rich tapestry of
stands as a testament to
serves as a beacon of
in today's fast-paced (world|business|landscape|environment)
in this ever-evolving
gone are the days
let's dive in
let's explore
in summary
in conclusion
it is important to note
it is worth (noting|mentioning)
needless to say
last but not least
without further ado
we pride ourselves on
we strive to
committed to excellence
second to none
trusted partner
your trusted partner
solutions provider
end-to-end solutions
from start to finish
game-changer
game-changing
move the needle
unlock potential
unlock the power of
empower(s|ed) you to
take it to the next level
push the envelope
think outside the box
hit the ground running
when it comes to
at the end of the day
that being said
having said that
```

## Banned AI typographic patterns

Beyond the words themselves, AI-generated copy has structural tells. The
copywriting SOP enforces these gates:

- Negation pivot: "It's not just X, it's Y." Replace with a direct positive
  claim ("It's Y.").
- Triadic auto-pilot: every list is exactly 3 items. Vary count: use 2, 4, 1.
- Hollow confidence: superlatives without a number ("exceptional service",
  "outstanding results"). Back with a fact or cut.
- Interchangeable copy: swap the client's name for a competitor's. If
  nothing becomes false, rewrite.
- Uniform paragraph length: every paragraph 3–4 sentences. Insert a
  4-word sentence. Vary rhythm on purpose.
- Em-dashes (any kind) anywhere. Zero tolerance. Replace with periods, commas,
  or colons.

## Acceptable exceptions

A word from the list is acceptable when it appears:

1. In direct quoted speech (a real customer review using a banned token verbatim).
2. As the proper name of a product, certification, or organisation
   (where a banned token appears inside a real proper noun).
3. In a heading where it's clearly ironic / self-aware.

The agent flags but does not fail in these cases. Human review confirms.

## Adding to the list

Patterns get added when:
- A real client copy review surfaces an AI tell that wasn't caught
- A new model release introduces a new vocabulary pattern
- A niche playbook's resonance research finds a niche-specific AI fingerprint

Open a PR with the pattern, source citation, and 1-2 examples of the
substitute pattern.
