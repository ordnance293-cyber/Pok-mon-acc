# Smart Hundo All-Family Conditional Form Verifier Design

## Scope

Stage 1 remains the GPT-5.4-mini full-image recognizer. Stage 2 is a conditional, form-only verifier for unresolved cards in exactly these families and forms:

- Articuno: `articuno_standard`, `articuno_galarian`
- Zapdos: `zapdos_standard`, `zapdos_galarian`
- Moltres: `moltres_standard`, `moltres_galarian`
- Zacian: `zacian_standard`, `zacian_crowned`
- Zamazenta: `zamazenta_standard`, `zamazenta_crowned`
- Dialga: `dialga_standard`, `dialga_origin`
- Palkia: `palkia_standard`, `palkia_origin`
- Zygarde: `zygarde_10`, `zygarde_50`, `zygarde_complete`
- Necrozma: `necrozma_base`, `necrozma_dusk_mane`, `necrozma_dawn_wings`
- Kyurem: `kyurem_base`, `kyurem_white`, `kyurem_black`

## Eligibility and preservation

A card is eligible only when its base species is listed above, species recognition and confidence pass the existing threshold, `effective_form_id === 'uncertain'`, its original-image bounding boxes are usable, and its identity is stable. A resolved Stage 1 form is returned byte-for-byte unchanged and consumes no tile or request.

Crops always come from the original image, never the resized classification JPEG. Stage 2 may merge only verification audit fields, `effective_form_id`, and `canonical_official_name`; CP, base species, identity/order, shiny, lucky, favorite, Rocket, background, grouping, overlap and persistence behavior are preserved.

## Visual evidence

Every one of the 23 form IDs has an explicit controlled body-plan, limb-layout, fusion-host, decisive-feature and human-readable visual rule in `smart-hundo-form-verifier.js`. The birds require silhouette/posture/wing/beak/leg structure rather than color. Zacian requires visible sword and armor for Crowned Sword. Zamazenta requires visible shield mane and chest armor for Crowned Shield; standard may be selected from armor absence only when head, neck and chest are clear. Zygarde uses complete 10%, 50% and Complete body architecture. Kyurem uses Reshiram/Zekrom fusion anatomy, never color alone.

Small, cropped, blocked or ambiguous decisive regions return `uncertain`; no standard/base fallback is allowed.

## Requests and diagnostics

Contact sheets contain at most six candidates. There is exactly one logical Stage 2 request per generated sheet and no Stage 2 structural retry:

- 0 candidates: 0 sheets, 0 requests
- 1–6: 1 sheet, 1 request
- 7–12: 2 sheets, 2 requests
- 13: 3 sheets, 3 requests

The common transport retry remains unchanged. Safe diagnostics cover all 10 families and all 23 form/evidence contracts, including candidate forms, sheet/tile identity, verdict and review reasons; images and data URLs are excluded.

## Acceptance

CP3282 standard Zamazenta is an automated mocked acceptance case: unresolved Stage 1 enters Stage 2, valid clear standard evidence produces `藏瑪然特`, while low confidence or obscured evidence remains `待確認（CP3282）`.

Real-image acceptance: **NOT RUN**.
