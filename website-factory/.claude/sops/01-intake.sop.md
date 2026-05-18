# 01 - Intake SOP

Implements: Stage 1.

## Procedure

1. Verify active client. If empty, halt with: "Run /new-client [slug] first."
2. Collect 4 fields:
   - company_name (string, ≥2 chars)
   - website (URL with scheme)
   - phone (10 digits after stripping)
   - email (valid format)
3. Normalize phone to `(XXX) XXX-XXXX`. Lowercase email. Add `https://` if missing.
4. Derive slug if not provided: lowercase company_name, replace non-alphanumeric with `-`, collapse repeats, trim ends.
5. Validate against `intake.schema.json`. Halt on failure.
6. Fetch website (HEAD or GET). Save raw HTML to `intake/WEBSITE-SNAPSHOT.html`. Mark `website_reachable` true/false.
7. Update pipeline-state, append build-log.

## Pass gate
- 4 fields validated
- Website snapshot saved (or marked unreachable)

## Common issues
- Phone with extension → strip extension to separate field
- Website behind Cloudflare → fall back to alternative scrape route, mark `meaningful: false` if needed
