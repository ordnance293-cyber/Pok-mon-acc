# Smart Hundo high/medium comparison

Real-image latency and accuracy acceptance is pending. Automated mocks do not establish either.

## Setup

1. Use the same foreground browser, device, network conditions, original image files, and account form state.
2. Open the existing application with `?hundo_test=1` and confirm **百神推理測試** appears.
3. Do not use screenshots re-encoded by messaging software. Do not include account identifiers in the report.
4. For the seven-card image, alternate three `high` and three `medium` runs. Also run both efforts on the three-card regression image.
5. Start each run with one click on the existing **AI自動掃描** button. Do not dismiss a missing-field alert until the hundo status has updated.

## Record every run

Record reference ID, effort, `hundo_completion.complete_visible_elapsed_ms`, final count, expanded Pokémon count, final list, review/blocking reasons, structural retry, logical card attempts, transport request counters, and form-verifier activity. Report each run plus median and range; retain slow and incorrect runs.

Compare every visible card against the original: species, multiplicity, form, shiny/shadow/purified state, and background. For the seven-card reference, independently inspect CP2631 Kyurem as White versus Black rather than treating an earlier generated list as truth. A grouped `*2` entry represents two Pokémon.

Acceptance requires both `hundo_completion.within_60s === true` and human-confirmed correct, complete image content. Do not promote `medium` or claim acceptance based on instrumentation, mock tests, one passing run, or an average below 60 seconds.
