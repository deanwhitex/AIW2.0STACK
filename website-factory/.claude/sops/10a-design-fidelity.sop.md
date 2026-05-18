# 10a - Design Fidelity QA SOP

Implements: Stage 10a.

## Procedure

1. `npm run dev` in build folder. Wait for localhost:5173.
2. Loop (cap 5):
   - Playwright headless at 1440×900
   - Per section (14): screenshot built, crop mockup, compute SSIM + ΔE
   - Pass thresholds: SSIM ≥0.90, ΔE ≤3 at 5 sample pixels
3. If all pass: status passed.
4. If any fail:
   - Identify cause (color, padding, font weight, image proportion)
   - Edit source
   - Increment loop, re-run
5. If loop cap hit: halt with MANUAL-INTERVENTION-NEEDED.md listing per-section deltas.

## Pass gate
- Every section SSIM ≥0.90 + ΔE ≤3
- OR `/override-fidelity` invoked
