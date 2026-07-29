# Smart Hundo All-Family Conditional Form Verifier Plan

1. Add RED tests proving resolved supported forms remain unchanged and unresolved forms alone become candidates.
2. Define explicit controlled visual evidence for all 23 forms in all 10 supported families, including strict Zamazenta, Zacian, Galarian-bird, Zygarde and Kyurem rules.
3. Use original-image bounding boxes to crop unresolved candidates and batch at most six per contact sheet.
4. Send exactly one logical Stage 2 request per sheet; remove Stage 2 structural retry while retaining common transport retry behavior.
5. Merge form audit fields, effective form and canonical name only. Fail uncertain, low-confidence, mismatched or obscured verdicts closed without standard/base fallback.
6. Shape safe diagnostics for all families, candidate forms and controlled evidence without images or data URLs.
7. Verify CP3282 standard and unresolved Zamazenta behavior, Crowned Shield naming, form-only preservation, diagnostics and `ceil(unresolved_candidates / 6)` requests.
8. Run static, Node and browser suites. Keep real-image acceptance **NOT RUN** unless supplied real images are actually exercised.

Do not change Stage 1 GPT-5.4-mini routing, full-image recognition, counts, ordinary scans, Firebase/GAS, account cleanup, state recognition, display equivalence, grouping or overlap. Do not merge or auto-merge PR #45.
