# Smart Hundo original-image scan — manual acceptance

## Evidence boundary

Automated browser coverage uses mocked OpenAI responses and synthetic images. It verifies routing, payload shape, ordering, audit shaping, and error handling, but it does **not** prove a real screenshot result or a real API-key request. The following 16 steps are manual acceptance work and are not recorded as executed by the mocks. Use a disposable test account and do not place an API key, Authorization value, complete data URL, account identifier, or screenshot containing personal information in this document or a ticket.

| # | Manual step | Required evidence / pass condition |
| --- | --- | --- |
| 1 | Open the deployed app in a clean browser profile. | The settings inputs for Google Sheet ID, GAS URL, and OpenAI API key are present; no real key is entered in a captured screenshot. |
| 2 | Enter a valid test API key and save settings. Reload once. | The key is restored for the test session, and devtools storage shows the expected setting key without exposing its value. |
| 3 | Prepare a mixed set of screenshots in a deliberately random order: profile/resources/category images plus one or more `傳說的寶可夢,幻,究極異獸&4*` screens. | Record only the order by neutral labels (for example `A profile, B hundo, C resources`), not screenshots containing sensitive details. |
| 4 | Upload the complete random-order set and start AI automatic scan. | The UI disables the action while work is in progress and restores it after completion or a handled error. |
| 5 | Watch classification progress in the status area and Network panel. | Every uploaded image receives a classification request before extraction starts; hundo routing is based on the classifier result, not its upload position. |
| 6 | Inspect one classifier request. | Redact `Authorization` completely and replace image data with `data:image/...,[redacted]`; confirm model `gpt-4.1-mini` and normal image detail `auto`. |
| 7 | Inspect one ordinary extraction request. | Its image is a resized JPEG payload and its image detail is `auto`; redact the data URL and Authorization. |
| 8 | Inspect one smart-hundo extraction request. | It uses the original uploaded image (not the resized JPEG), requests high detail, and uses the structured smart-hundo schema; redact the data URL and Authorization. |
| 9 | Verify the request sequence for multiple hundo images. | Classification finishes for all uploaded images before their routed extraction requests; every matching hundo image gets its own smart request. |
| 10 | Inspect the smart-hundo structured response in a redacted Network capture. | Each card has position, visible label, official name, recognition status/confidence, and independent shiny/purified/shadow state and confidence fields. |
| 11 | Compare the structured cards with the source screenshot. | Recognized cards are correct; partial/uncertain cards are visibly reported for manual review rather than silently becoming Pokémon-list entries. |
| 12 | Check state interpretation on a screenshot that includes a shiny, purified, or shadow marker. | The three states are independently represented; a `purified` finding is an audit/card fact and is not added as a textual prefix to the saved Pokémon list. |
| 13 | Inspect `window.lastSmartHundoScanResult` in devtools after a scan. | It contains card/audit summaries and failed indexes only—no API key, Authorization value, image data URL, uploaded file, or resized data URL. |
| 14 | Confirm form output after a successful mixed scan. | Normal fields merge as before; the hundo count and Pokémon list come from smart results, and conflicting counts are not summed. |
| 15 | Edit the generated form values, then save manually. | The normal save confirmation and copywriting remain unchanged; a smart-scan audit is not automatically persisted merely because scanning completed. |
| 16 | Verify persistence in Firebase and the GAS request for the manual save. | Firebase inventory and GAS `action: add` data contain the existing account fields/full text only—no `purified` card field and no `lastSmartHundoScanResult`; redact IDs, URLs, Authorization, and account data in any retained evidence. |

## Automated evidence available now

`python tests/run_browser_tests.py` exercises the same routing and safety contracts with mocked OpenAI responses. `python tests/verify_regressions.py` locks unchanged save/copy source spans and checks production model/settings, routing, and persistence boundaries. Neither command is a substitute for steps 1–16 with a real key and real screenshots.
