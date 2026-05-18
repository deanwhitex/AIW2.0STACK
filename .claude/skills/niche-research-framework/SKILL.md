---
name: niche-research-framework
description: Use when any research-stage agent needs to reference the Student Research System framework. Wraps the framework doc into a queryable phase API so agents don't re-read the whole file.
---

# Niche Research Framework

The canonical framework lives at `research/_framework/Student_Research_System.md`. This skill exposes specific sections by name rather than asking agents to grep the whole file each time.

## When to use this skill

- Module 1 interviewer needs the 7 section anchor questions.
- Module 2A scorer needs the 7-factor matrix definitions and scoring rules.
- Module 3 offer architect needs the positioning sentence template and stage check table.
- Module 5 and 7 brief writers need the output schemas.

## Anchor references (line numbers in framework)

| What | File | Lines |
|---|---|---|
| Module 1 interview prompts (all 7 sections) | Student_Research_System.md | 56 to 91 |
| Student Profile output template | Student_Research_System.md | 96 to 132 |
| Module 2A scoring matrix | Student_Research_System.md | 142 to 151 |
| Module 2A decision rule | Student_Research_System.md | 152 to 157 |
| Module 2A research checklist | Student_Research_System.md | 158 to 166 |
| Niche Decision output template | Student_Research_System.md | 170 to 196 |
| Module 3 positioning sentence formula | Student_Research_System.md | 207 |
| Module 3 stage check table | Student_Research_System.md | 218 to 223 |
| Module 3 cold DM template | Student_Research_System.md | 227 to 241 |
| Offer Pack output template | Student_Research_System.md | 249 to 277 |
| Module 4 system prompt | Student_Research_System.md | 285 to 297 |
| Module 4 structure confirmation template | Student_Research_System.md | 301 to 318 |
| Module 5 system prompt | Student_Research_System.md | 327 to 336 |
| Website Factory Brief default template | Student_Research_System.md | 342 to 430 |
| Module 6 system prompt | Student_Research_System.md | 440 to 451 |
| Module 6 structure confirmation template | Student_Research_System.md | 455 to 469 |
| Module 7 system prompt | Student_Research_System.md | 478 to 485 |
| Content Engine Brief default template | Student_Research_System.md | 491 to 580 |
| Appendix A Website_Factory_Structure template | Student_Research_System.md | 588 to 627 |
| Appendix A Content_Engine_Structure template | Student_Research_System.md | 631 to 670 |
| Appendix C source mapping | Student_Research_System.md | bottom of file |

## How to query

When an agent needs a specific section, read just those lines:

```bash
sed -n '{start},{end}p' research/_framework/Student_Research_System.md
```

For example, the offer architect agent grabs the positioning formula:
```bash
sed -n '207p' research/_framework/Student_Research_System.md
```

## Three-actor reminder (always relevant)

Every reference to "customer" in the framework needs to be disambiguated against the three-actor model:

| Framework reference | Actual actor |
|---|---|
| "the customer" in Module 1 to 2 context | usually the student's eventual client (niche business) |
| "the end customer" or "their customer" | the niche business's customer (homeowner, patient, etc.) |
| "the operator" or "the student" | the AIW grad running the stack |

If a framework passage is ambiguous, default to optimizing for the **end customer**. That is what the website converts.

## Note on Appendix B

Appendix B (Universal CRO SOPs) was moved out of the framework during stack bootstrap. It now lives at `website-factory/references/cro-sops/universal-cro-sops.md`. Any framework reference to Appendix B points there.
