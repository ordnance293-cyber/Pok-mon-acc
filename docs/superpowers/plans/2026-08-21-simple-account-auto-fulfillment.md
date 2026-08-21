# Simple-Account Auto-Fulfillment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an isolated, idempotent 簡帳自動出貨 workflow backed by a separate Apps Script project and spreadsheet, while preserving every existing high-budget, Firebase, synchronization, cleanup, restore, repaint, and AI behavior.

**Architecture:** Keep the fulfillment domain in a deterministic CommonJS/browser-compatible logic module with explicit spreadsheet, lock, clock, persistence, and logger adapters. Keep `Code.gs` as a thin Apps Script web-app adapter that validates before file access, serializes one-row reservations under a script lock, and returns safe JSON. Add a browser helper module for request IDs, payloads, pending recovery, and response classification; integrate it into `index.html` with a third page, separate settings, and the existing credential modal.

**Tech Stack:** Plain browser JavaScript, CommonJS-compatible JavaScript modules, Google Apps Script services (`ContentService`, `SpreadsheetApp`, `LockService`, `PropertiesService`), Node built-in `assert` tests, Python static regression checks, and GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-21-simple-account-auto-fulfillment-design.md`

## Global Constraints

- Use only the exact product-to-sheet mapping `1百神`, `2百神`, `3百神`, `無極汰那`, `Mega烈空坐`.
- Reject `全部價格`, `高預算帳號`, and every arbitrary browser-supplied sheet name before spreadsheet access.
- Validate JSON, action, request ID `^[A-Za-z0-9_-]{20,100}$`, product, script properties, secret, and browser spreadsheet ID before opening a spreadsheet.
- Always open the server-configured `SIMPLE_ACCOUNT_SPREADSHEET_ID`; never open an unchecked browser-supplied ID.
- Row 1 is never selected or recolored; scan row 2 downward, using account column B and password column C.
- A row is eligible only when trimmed B and C values are non-empty and both backgrounds normalize case-insensitively to exactly `#ffffff`.
- Select the first eligible row from top to bottom and fulfill exactly one account per request.
- Reserve before yellow formatting; paint columns A through `sheet.getMaxColumns()` `#ffff00`; flush every mutation before releasing the script lock.
- Use `LockService.getScriptLock()` and `tryLock(10000)`; lock timeout returns `BUSY` with zero spreadsheet or audit writes.
- Maintain hidden `簡帳出貨紀錄` with exact headers `request_id,state,requested_at,completed_at,product,source_sheet,source_row,account`; never store passwords.
- Replays use the original request's row and re-read B/C; identity mismatch returns `REPLAY_UNAVAILABLE` without selecting a replacement.
- Browser pending records contain only request ID, product, and created timestamp; unknown outcomes preserve the same request ID.
- Browser requests use POST, `text/plain;charset=UTF-8`, `cache: "no-store"`, readable JSON, and never put the secret in a query string or log credentials.
- Keep the existing high-budget settings, localStorage keys, Firebase model, Google Sheet sync, SOLD cleanup, restore/repaint, AI scanning, and semicolon modal parsing unchanged.
- Use synthetic account/password values only in tests, examples, logs, and documentation.
- Do not access or mutate a production spreadsheet, Firebase project, or live Apps Script deployment.
- Do not add batch selling, pricing, stock dashboards, returns, restocking, or unrelated behavior.
- Every implementation task follows red-green-refactor, has a focused commit, and runs its smallest covering tests before the next task.

---

### Task 1: Define deterministic fulfillment-domain contracts

**Files:**
- Create: `apps-script/simple-account-fulfillment/fulfillment-logic.js`
- Create: `tests/simple-account-fulfillment.test.js`

**Interfaces:**
- Produce `FulfillmentLogic.PRODUCT_SHEET_MAP`, `ALLOWED_PRODUCTS`, `REQUEST_ID_PATTERN`, `AUDIT_SHEET_NAME`, and `AUDIT_HEADERS`.
- Produce `validateRequest(request, config)` returning either `{ ok: true, product, sheetName }` or `{ ok: false, code, message }`.
- Produce `normalizeColor(value)`, `isEligibleCredentialRow(row)`, and `selectFirstEligibleRow(rows, reservedRows)`; row records use `{ rowNumber, account, password, accountBackground, passwordBackground }`.
- Produce `buildAuditRecord({ requestId, state, requestedAt, completedAt, product, sourceSheet, sourceRow, account })`, which never includes a password.
- Produce `createTransactionService(adapters)`; adapters expose `readAuditRecords()`, `appendAuditRecord(record)`, `updateAuditRecord(rowNumber, values)`, `readProductRows(sheetName)`, `paintSourceRow(sheetName, rowNumber, width)`, `flush()`, `now()`, and safe `log(metadata)`.
- Consume no Google global and perform no file access.

- [ ] **Step 1: Write the failing domain tests**

Add tests for the exact allowlist and mapping, rejection of `全部價格`, `高預算帳號`, arbitrary products, request ID validation, row 1 exclusion, first complete white row selection, yellow/partial/non-white/blank rows being skipped, `OUT_OF_STOCK`, one-row-per-request, reserved-row exclusion, replay identity checks, reservation recovery, and password absence from audit records.

~~~javascript
const assert = require('node:assert/strict');
const Logic = require('../apps-script/simple-account-fulfillment/fulfillment-logic.js');

assert.deepEqual(Logic.PRODUCT_SHEET_MAP, {
  '1百神': '1百神',
  '2百神': '2百神',
  '3百神': '3百神',
  '無極汰那': '無極汰那',
  'Mega烈空坐': 'Mega烈空坐'
});
assert.equal(Logic.selectFirstEligibleRow([
  { rowNumber: 1, account: 'header', password: 'header', accountBackground: '#ffffff', passwordBackground: '#ffffff' },
  { rowNumber: 2, account: 'sold', password: 'sold', accountBackground: '#ffff00', passwordBackground: '#ffff00' },
  { rowNumber: 4, account: 'first', password: 'pw-first', accountBackground: '#FFFFFF', passwordBackground: '#ffffff' }
], new Set()).rowNumber, 4);
assert.equal(Logic.buildAuditRecord({
  requestId: 'request-id-1234567890',
  state: 'RESERVED',
  requestedAt: 1,
  completedAt: '',
  product: '3百神',
  sourceSheet: '3百神',
  sourceRow: 4,
  account: 'synthetic-account'
}).password, undefined);
~~~

- [ ] **Step 2: Run the new test to verify the intended red state**

Run `node tests/simple-account-fulfillment.test.js`. Expected in CI before implementation: failure because the new module and contracts do not exist. Local execution is unavailable because Node.js is not installed; record that limitation without claiming a pass.

- [ ] **Step 3: Implement the minimum pure domain contracts**

Implement exact constants, trim-based row eligibility, case-insensitive color normalization, deterministic top-to-bottom selection beginning at row 2, and audit record construction without password fields. Make CommonJS exports available and attach `window.SimpleAccountFulfillmentLogic` only when a browser global exists.

- [ ] **Step 4: Run the focused test and inspect the result**

Run `node tests/simple-account-fulfillment.test.js` in CI or a Node-enabled environment. Expected result after implementation: pass for all domain-selection assertions. Run `git diff --check` locally.

- [ ] **Step 5: Commit the focused domain change**

~~~powershell
git add apps-script/simple-account-fulfillment/fulfillment-logic.js tests/simple-account-fulfillment.test.js
git commit -m "test: define simple-account fulfillment transaction behavior"
~~~

### Task 2: Implement transaction, replay, recovery, and Apps Script adapters

**Files:**
- Modify: `apps-script/simple-account-fulfillment/fulfillment-logic.js`
- Create: `apps-script/simple-account-fulfillment/Code.gs`
- Modify: `tests/simple-account-fulfillment.test.js`

**Interfaces:**
- `createTransactionService(adapters).fulfill(request, config)` validates before calling `openSpreadsheet`, handles replay and older RESERVED recovery, and returns the specified success/failure object.
- Apps Script adapters expose `openSpreadsheetById(id)`, `getAuditSheet()`, `getProductSheet(sheetName)`, `getRows(sheet)`, `appendAudit(record)`, `updateAudit(record)`, `paintFullRow(sheet, rowNumber)`, `flush()`, `now()`, and `logSafe(metadata)`.
- `Code.gs.doPost(event)` parses `event.postData.contents`, calls the pure service, and returns `ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON)`.
- `Code.gs` contains only web-app wiring, property reads, lock acquisition/finally release, Spreadsheet/Range conversion, and safe error mapping; business selection rules remain in `fulfillment-logic.js`.

- [ ] **Step 1: Add failing fake-adapter transaction tests**

Extend `tests/simple-account-fulfillment.test.js` with deterministic fake Properties, Spreadsheet, Sheet, Range, Lock, Clock, and Logger adapters. Assert validation performs zero spreadsheet reads, wrong secret and spreadsheet mismatch perform zero file access, missing sheets return `SHEET_NOT_FOUND`, lock timeout performs zero writes, reservation append precedes paint, full row width is painted yellow, flush precedes lock release, replay reads B/C from the original row, same request replays the same row, a different request cannot consume RESERVED stock, valid RESERVED recovery completes, broken identity returns `REPLAY_UNAVAILABLE`, unexpected errors return only `INTERNAL_ERROR`, and no secret/password appears in response or logger metadata.

- [ ] **Step 2: Run the adapter test to verify the intended red state**

Run `node tests/simple-account-fulfillment.test.js`. Expected in CI before the adapter implementation: failures for missing transaction methods and Apps Script source contracts. Local Node execution remains unavailable and must be recorded as not run.

- [ ] **Step 3: Implement pure transaction sequencing**

Implement the exact order: validate; find same request; recover older RESERVED records; read the allowlisted product sheet; exclude unresolved reservations; select one first eligible row; append RESERVED audit record; flush; paint full row; flush; update COMPLETED with completion time; flush; return account/password. Keep broken reservations excluded, fail closed on replay identity mismatch, and never issue a replacement row.

- [ ] **Step 4: Implement the thin Apps Script web-app adapter**

Read `SIMPLE_ACCOUNT_SPREADSHEET_ID` and `SIMPLE_ACCOUNT_FULFILLMENT_SECRET` from Script Properties. Validate all request/configuration values before opening the server-configured spreadsheet. Create `簡帳出貨紀錄` with the exact eight-column header and hide it when missing. Acquire `LockService.getScriptLock()` with `tryLock(10000)`; return `BUSY` without writes on timeout; release in `finally`. Use safe generic messages for exceptions, omit account/password/secret from logs, and never return stack traces or internal exception text.

- [ ] **Step 5: Run focused tests and static source assertions**

Run `node tests/simple-account-fulfillment.test.js` in CI, and locally run `python tests/verify_regressions.py` plus `git diff --check`. Expected CI result: all transaction and adapter tests pass; expected local result: static checks pass while Node-dependent checks are reported blocked.

- [ ] **Step 6: Commit the Apps Script service**

~~~powershell
git add apps-script/simple-account-fulfillment/Code.gs apps-script/simple-account-fulfillment/fulfillment-logic.js tests/simple-account-fulfillment.test.js
git commit -m "feat: add simple-account Apps Script fulfillment service"
~~~

### Task 3: Define browser request, pending, replay, and response helpers

**Files:**
- Create: `simple-account-fulfillment-helpers.js`
- Modify: `tests/simple-account-fulfillment.test.js`

**Interfaces:**
- Export `SimpleAccountFulfillmentHelpers.PRODUCTS`, `REQUEST_ID_PATTERN`, `createRequestId(cryptoLike)`, `buildRequestPayload(settings, product, requestId)`, `createPendingState(product, requestId, createdAt)`, `parsePendingState(raw)`, `classifyResponse(response)`, `classifyNetworkFailure(error)`, `shouldClearPending(code)`, `pendingBlocksProduct(pending, product)`, and `safeUserMessage(result)`.
- Browser global is `window.SimpleAccountFulfillmentHelpers`; CommonJS export is available for Node tests.
- Pending state serializes only `{ requestId, product, createdAt }`; request IDs use `crypto.randomUUID()` when available and a secure `crypto.getRandomValues()` fallback, then satisfy `^[A-Za-z0-9_-]{20,100}$`.
- `buildRequestPayload` returns the exact POST JSON object with `action: "fulfillSimpleAccount"`, configured spreadsheet ID, product, secret, and request ID; no URL construction includes the secret.

- [ ] **Step 1: Add failing browser-helper tests**

Test exact request ID format and uniqueness, UUID and secure fallback generation, exact payload construction, no secret/account/password in pending state, retry reuse of the same ID, different-product blocking, clear rules for `INVALID_REQUEST`, `UNAUTHORIZED`, `CONFIG_MISMATCH`, `SHEET_NOT_FOUND`, `OUT_OF_STOCK`, `BUSY`, and `REPLAY_UNAVAILABLE`, and keep rules for `INTERNAL_ERROR`, network errors, invalid JSON, HTML, and unreadable responses.

- [ ] **Step 2: Run the helper tests to verify red**

Run `node tests/simple-account-fulfillment.test.js`. Expected in CI before implementation: missing helper export failures. Local Node execution remains explicitly not run.

- [ ] **Step 3: Implement the minimal helper state machine**

Implement deterministic validation and safe-message mapping. Treat successful responses as deliverable only after the caller confirms modal fields are populated. Treat `REPLAY_UNAVAILABLE` as clear-after-prominent-manual-inspection instruction; keep pending for every unknown outcome.

- [ ] **Step 4: Run focused helper assertions and review serialization**

Run the focused Node test in CI and locally inspect the pending JSON shape with static assertions. Verify source contains no logging of secret/account/password.

- [ ] **Step 5: Commit the browser helper**

~~~powershell
git add simple-account-fulfillment-helpers.js tests/simple-account-fulfillment.test.js
git commit -m "test: define simple-account browser recovery behavior"
~~~

### Task 4: Refactor the shared credential modal without changing high-budget behavior

**Files:**
- Modify: `index.html`
- Modify: `tests/simple-account-fulfillment-ui.test.js`

**Interfaces:**
- Add `window.showCredentialModal(account, password)` that writes `modalAccount`, `modalPassword`, and reveals `copyModal`.
- Preserve `window.showCopyModal(accountId)`; it splits the current semicolon-delimited high-budget value and delegates to `showCredentialModal`.
- Preserve `copyModalField`, `copyModalMessage`, the two field-specific buttons, and existing handover instructions.

- [ ] **Step 1: Add failing modal/UI assertions**

Create `tests/simple-account-fulfillment-ui.test.js` with source-level assertions that the shared helper exists, high-budget semicolon parsing remains, account/password fields and separate copy handlers remain, and no combined-copy control or combined credential string is introduced.

- [ ] **Step 2: Run the UI test to verify red**

Run `node tests/simple-account-fulfillment-ui.test.js`. Expected in CI before the refactor: failure because `showCredentialModal` is absent. Local Node execution is not available.

- [ ] **Step 3: Implement the smallest modal refactor**

Extract field assignment and modal reveal into `showCredentialModal`, preserve the exact high-budget parsing fallback `（無密碼）`, and make simple-account code call only the shared helper with separate response fields.

- [ ] **Step 4: Run UI/static assertions**

Run the focused UI test in CI, inspect the relevant `index.html` region, and run `python tests/verify_regressions.py` locally to ensure protected high-budget spans still pass.

- [ ] **Step 5: Commit the modal refactor**

~~~powershell
git add index.html tests/simple-account-fulfillment-ui.test.js
git commit -m "feat: share account credential modal rendering"
~~~

### Task 5: Add the third page, separate settings, product controls, and fetch orchestration

**Files:**
- Modify: `index.html`
- Modify: `tests/simple-account-fulfillment-ui.test.js`

**Interfaces:**
- Add a third page element with stable ID `simpleAccountPage`; `window.togglePage(3)` hides pages 1 and 2 and shows it; page 3 returns with `window.togglePage(1)`.
- Add independent inputs/labels for `simpleAccountSpreadsheetId`, `simpleAccountGasUrl`, and password-type `simpleAccountFulfillmentSecret`, plus `💾 儲存簡帳設定`.
- Add `window.saveSimpleAccountSettings()`, `window.fulfillSimpleAccount(product)`, and `window.retrySimpleAccountFulfillment()` using the helper module.
- Product controls are exactly five buttons with `data-simple-account-product` values and exact text: `1百神`, `2百神`, `3百神`, `無極汰那`, `Mega烈空坐`. No `全部價格` or `高預算帳號` sale control appears.
- New settings use only `simpleAccountSpreadsheetId`, `simpleAccountGasUrl`, and `simpleAccountFulfillmentSecret`; existing `googleSheetId`, `gasUrl`, `OPENAI_API_KEY`, and `geminiApiKey` behavior remains unchanged.
- Fetch uses `POST`, `Content-Type: text/plain;charset=UTF-8`, `cache: "no-store"`, and a JSON body. It saves pending state before dispatch, disables all five buttons, marks selected button `出貨中`, and prevents concurrent/different-product requests.

- [ ] **Step 1: Add failing UI contract tests**

Assert three labeled simple-account settings and exact storage keys, password input type, save label, third-page navigation from pages 1 and 2, return navigation, exact five product controls, confirmation text, pending status/recovery text, no forbidden sale controls, fetch method/header/cache, disabled-button behavior, and that success clears pending only after modal fields are populated.

- [ ] **Step 2: Run the UI test to verify red**

Run `node tests/simple-account-fulfillment-ui.test.js`. Expected in CI before page integration: failures for missing third page, settings, controls, and fetch contract. Local Node execution remains unavailable.

- [ ] **Step 3: Implement separate settings and navigation**

Add a simple-account settings panel inside page 3 with visible labels and explanations, load/save only the three new keys, add page 1/page 2 shortcut buttons, add the page 3 return button, and extend `togglePage` with a page 3 branch without changing existing page 1/page 2 behavior.

- [ ] **Step 4: Implement product confirmation and request orchestration**

On a confirmed sale, read the three simple-account settings, show a missing-setting message without fetching if incomplete, create or reuse pending state, call the configured URL with the exact request payload, classify JSON/error outcomes through helpers, populate `showCredentialModal(response.account, response.password)` before clearing pending on success, show manual audit/source-row instructions before clearing `REPLAY_UNAVAILABLE`, and retain pending for unknown outcomes. Never log request payloads or credentials.

- [ ] **Step 5: Run focused UI/static checks**

Run the focused UI test in CI. Locally run `python tests/verify_regressions.py` and `git diff --check`; inspect `index.html` for unchanged existing settings IDs and high-budget call paths.

- [ ] **Step 6: Commit the page integration**

~~~powershell
git add index.html simple-account-fulfillment-helpers.js tests/simple-account-fulfillment-ui.test.js
git commit -m "feat: add simple-account auto-fulfillment page"
~~~

### Task 6: Add deployment and manual acceptance documentation

**Files:**
- Create: `apps-script/simple-account-fulfillment/README.md`
- Create: `docs/manual-tests/simple-account-auto-fulfillment.md`

**Interfaces:**
- README documents a completely separate Apps Script project/deployment, exact source-file copy, Script Properties, long random secret handling, spreadsheet authorization, owner/Anyone web-app deployment, browser settings, hidden audit sheet, redeployment versioning, unknown-result recovery, and real GitHub Pages cross-origin browser verification.
- Manual checklist uses only a duplicate/test spreadsheet and test deployment, with synthetic examples and checkboxes for all five products, selection/formatting, modal behavior, out-of-stock/incomplete rows, concurrency, replay, forbidden tabs, and unchanged legacy systems.

- [ ] **Step 1: Write documentation contract checks**

Add static assertions to `tests/simple-account-fulfillment-ui.test.js` or a focused source check for exact property names, deployment mode, audit sheet name, no-password audit statement, unknown-result guidance, and the real-browser acceptance warning.

- [ ] **Step 2: Run documentation checks to verify red**

Run `node tests/simple-account-fulfillment-ui.test.js`. Expected in CI before the documentation files exist: missing-content failures. Local Node execution remains unavailable.

- [ ] **Step 3: Write the dedicated deployment README**

State the exact deployment and operation requirements: separate project; copy only these simple-account files; set `SIMPLE_ACCOUNT_SPREADSHEET_ID` and `SIMPLE_ACCOUNT_FULFILLMENT_SECRET`; use a long random secret; authorize the separate stock spreadsheet; deploy Execute as owner and Access Anyone; save the new URL and same ID/secret in browser settings; create/use `簡帳出貨紀錄`; deploy a new version after Apps Script changes; and recover unknown network results by replaying the pending request after checking the audit sheet/source row.

- [ ] **Step 4: Write the checkbox manual acceptance guide**

Cover all approved design acceptance cases, explicitly mark production/deployed acceptance as pending until performed against a duplicate/test spreadsheet and test deployment, and require the actual GitHub Pages origin in the target browser.

- [ ] **Step 5: Run static documentation review and commit**

Run `python tests/verify_regressions.py` and `git diff --check`, then commit:

~~~powershell
git add apps-script/simple-account-fulfillment/README.md docs/manual-tests/simple-account-auto-fulfillment.md tests/simple-account-fulfillment-ui.test.js
git commit -m "docs: add simple-account deployment and acceptance guides"
~~~

### Task 7: Integrate CI and run final local/static verification

**Files:**
- Modify: `.github/workflows/sold-reconcile-ci.yml`
- Modify: `tests/simple-account-fulfillment.test.js`
- Modify: `tests/simple-account-fulfillment-ui.test.js`

**Interfaces:**
- CI retains every existing test and adds `node tests/simple-account-fulfillment.test.js` and `node tests/simple-account-fulfillment-ui.test.js`, followed by `python tests/verify_regressions.py` and `git diff --check`.
- Tests use deterministic fake adapters and source-level checks; no test calls Google, Firebase, a production URL, or a live deployment.

- [ ] **Step 1: Add failing CI/source coverage assertions**

Add assertions for every final-risk item: row 1 exclusion, fixed allowlist, one-row transaction, replay row identity, reserved-row exclusion, reservation-before-paint ordering, password-free audit, full-row width, lock finally release, flush-before-release, pending retention/clear rules, modal compatibility, and sensitive-data omission.

- [ ] **Step 2: Run focused checks to verify red**

Run the two new Node tests in CI or a Node-enabled environment. Locally run `python tests/verify_regressions.py`; expected local output may list Node-dependent checks as blocked while all static checks pass.

- [ ] **Step 3: Add only the two new CI commands**

Insert the two new Node test steps alongside the existing cleanup, Apps Script reconciliation, settings-label, Python regression, and diff checks. Do not remove or weaken existing workflow steps.

- [ ] **Step 4: Run local static verification**

Run exactly:
~~~powershell
python tests/verify_regressions.py
git diff --check
git status --short
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
~~~
Record that Node tests are not run locally because Node.js is unavailable. Run `python tests/run_browser_tests.py` once if the local Edge runtime is available; if it exits before rendering with the known GPU startup failure, classify browser tests as blocked by local browser runtime and do not claim a pass.

- [ ] **Step 5: Commit CI integration**

~~~powershell
git add .github/workflows/sold-reconcile-ci.yml tests/simple-account-fulfillment.test.js tests/simple-account-fulfillment-ui.test.js
git commit -m "ci: run simple-account fulfillment regressions"
~~~

### Task 8: Final review, CI execution, and existing PR update

**Files:**
- Review all changed files against the approved design.
- No production deployment files or real credentials are permitted.

**Interfaces:**
- The final branch contains focused commits, required tests and docs, a clean worktree, and only the existing PR branch.

- [ ] **Step 1: Perform a line-by-line security and transaction review**

Check that no path can access row 1, `全部價格`, `高預算帳號`, or arbitrary tabs; no request can select two rows; replay never scans replacement stock; RESERVED rows remain excluded; reservation writes precede yellow paint; audit rows omit passwords; complete source width is painted; lock release is in `finally`; flush precedes release; unknown browser outcomes retain the original request ID; high-budget modal parsing/copy behavior is unchanged; and logs/responses/repository contain no secrets or credentials.

- [ ] **Step 2: Run final local checks that are available**

Run all deterministic static checks, `python tests/verify_regressions.py`, `git diff --check`, `git status --short`, the full diff/stat commands, and credential-leak checks:
~~~powershell
git grep -n -I -E "SIMPLE_ACCOUNT_FULFILLMENT_SECRET|simpleAccountFulfillmentSecret"
git grep -n -I -E "script\.google\.com/macros/s/|docs\.google\.com/spreadsheets/d/"
~~~
Do not claim local Node tests pass; report them as not run because Node.js is unavailable.

- [ ] **Step 3: Push only the existing feature branch**

~~~powershell
git push -u origin feat/simple-account-auto-fulfillment
~~~
Do not create a pull request, merge PR #55, force-push, amend, rebase, or reset.

- [ ] **Step 4: Inspect GitHub Actions and fix actual failures**

Inspect the workflow run for the pushed head. If CI fails, diagnose the actual failing test, add a failing regression before the fix, make the smallest fix, rerun the relevant CI-equivalent checks, commit a focused correction, and push normally. If CI passes, record the workflow URL, commit SHA, test commands, and exact results. Keep PR #55 draft.

- [ ] **Step 5: Preserve the worktree and write the final report**

Report worktree path, branch, starting/ending SHAs, plan path, files changed, browser and Apps Script behavior, every local/CI test outcome, local browser runtime status, real deployment acceptance status, remaining deployment/manual steps, PR #55 head/draft status, no-merge confirmation, no-credential confirmation, and preserved-worktree confirmation. Do not call the feature production-ready while duplicate/test-spreadsheet and real-browser acceptance remains pending.
