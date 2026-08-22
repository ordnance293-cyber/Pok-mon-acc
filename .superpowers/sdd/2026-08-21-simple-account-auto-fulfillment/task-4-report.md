# Task 4 report: shared credential modal

## Scope

- Added `window.showCredentialModal(account, password)` to populate the existing account and password fields, then reveal the existing credential modal.
- Kept `window.showCopyModal(accountId)` as the high-budget entry point. It retains its semicolon parsing, trimmed account/password values, and `（無密碼）` fallback, then delegates to the shared helper.
- Added deterministic source-level assertions for the helper, high-budget parser/delegation, separate field copy controls, handover message, and absence of combined-copy controls.

## Verification

- `python tests/verify_regressions.py`: passed 42 static source regression checks. The suite reported its pre-existing Node-dependent checks as blocked because Node.js is unavailable.
- `git diff --check`: passed.
- `node tests/simple-account-fulfillment-ui.test.js`: not run; `node` is not installed in this local environment. The intended red state and post-change green state therefore require CI or another Node-enabled environment.

## Concerns

- No live services, account credentials, passwords, Firebase, spreadsheet, or Apps Script deployments were accessed.
- The test uses synthetic source-level fixtures only.
