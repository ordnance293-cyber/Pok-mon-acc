# Simple-Account Auto-Fulfillment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate, idempotent simple-account fulfillment flow that issues exactly one allowlisted account from a second Google Spreadsheet while leaving all existing high-budget inventory behavior unchanged.

**Architecture:** The browser receives one isolated helper module that injects and owns the third `簡帳自動出貨` page, independent browser settings, pending-request recovery, and the shared credential-modal adapter. A separate Apps Script deployment uses a thin `Code.gs` adapter around pure fulfillment logic: validate first, take a ScriptLock, reserve in a hidden password-free audit sheet, flush, paint the entire source row yellow, flush, complete the reservation, flush, and replay the same request without consuming another row. Existing Firebase, current Google Sheet reconciliation, SOLD cleanup, restore, repaint, OpenAI scanning, `全部價格`, `高預算帳號`, and high-budget sale behavior remain untouched.

**Tech Stack:** Static HTML/JavaScript, CommonJS-compatible pure JavaScript, Google Apps Script, Node.js `assert` tests in GitHub Actions, Python static regression checks.

**Spec:** `docs/superpowers/specs/2026-08-21-simple-account-auto-fulfillment-design.md`

## Global Constraints

- Continue only on branch `feat/simple-account-auto-fulfillment` and existing PR #55.
- Preserve the existing linked worktree and do not create, reset, rebase, amend, force-push, or discard Git state.
- Do not install Node.js. Local Node execution is optional because Node is unavailable; never claim an unexecuted Node test passed.
- Use only synthetic credentials in tests, examples, documentation, and fixtures.
- Do not access a real spreadsheet, Firebase project, live Apps Script deployment, production secret, or real credential during implementation.
- Fulfillment products are exactly `1百神`, `2百神`, `3百神`, `無極汰那`, and `Mega烈空坐`.
- Row 1 is always a header. Data starts at row 2. Account is column B and password is column C.
- A source row is eligible only when B and C are both non-empty after trimming and both credential-cell backgrounds are case-insensitive `#ffffff`.
- Select exactly the first eligible row from top to bottom, issue exactly one account, and paint the entire selected row `#ffff00`.
- The endpoint must never accept arbitrary sheet names and must never access `全部價格` or `高預算帳號`.
- The audit sheet is hidden, named `簡帳出貨紀錄`, and must never contain a password.
- A reservation record must be persisted and flushed before yellow formatting.
- A mutated transaction must call `SpreadsheetApp.flush()` before releasing the ScriptLock in `finally`.
- Replaying the same request ID must return the original row and never consume a second row.
- Unknown browser outcomes preserve the pending request ID; confirmed no-delivery outcomes clear it.
- Reuse the existing account/password modal with separate copy buttons. Do not add a combined-copy control.
- Keep PR #55 in draft and do not merge it.

---

## File Responsibility Map

- Create `simple-account-fulfillment-helpers.js`: browser-only page injection, independent settings storage, request ID/pending-state ownership, fetch/replay state machine, button state, safe status messages, and shared modal delegation.
- Modify `index.html`: load the new helper script only. The helper wraps the existing `showCopyModal` at DOM ready so the large existing module and all high-budget logic remain stable.
- Create `apps-script/simple-account-fulfillment/fulfillment-logic.js`: environment-independent validation, allowlist, row eligibility, first-row selection, audit record shape, replay validation, recovery planning, and safe response helpers.
- Create `apps-script/simple-account-fulfillment/Code.gs`: Apps Script adapter for properties, request parsing, ScriptLock, spreadsheet/audit adapters, flush ordering, row painting, replay/recovery, and `ContentService` JSON.
- Create `apps-script/simple-account-fulfillment/README.md`: separate-project deployment, Script Properties, permissions, copy steps, test-spreadsheet acceptance, rollback, and security notes.
- Create `tests/simple-account-fulfillment.test.js`: deterministic pure-logic and fake Apps Script transaction tests.
- Create `tests/simple-account-fulfillment-ui.test.js`: static/browser-helper contract tests, pending-state rules, modal preservation, and exact-page controls.
- Modify `.github/workflows/sold-reconcile-ci.yml`: run both new Node test files without changing existing jobs.
- Modify `tests/verify_regressions.py`: add static locks for the new helper, separate Apps Script deployment, allowlist, lock/flush/finally ordering, password-free audit, and preservation of existing high-budget modal/settings behavior; include new Node tests in the optional Node block.

---

### Task 1: Add deterministic server-domain tests first

**Files:**
- Create: `tests/simple-account-fulfillment.test.js`
- Test target: `apps-script/simple-account-fulfillment/fulfillment-logic.js`
- Test target: `apps-script/simple-account-fulfillment/Code.gs`

**Interfaces:**
- Consumes: no production implementation yet.
- Produces: executable expectations for `SimpleAccountFulfillmentLogic`, including `PRODUCT_TO_SHEET`, `AUDIT_HEADERS`, `validateFulfillmentRequest`, `isEligibleCredentialRow`, `findFirstEligibleRow`, `buildReservedAuditRecord`, `validateReplayIdentity`, `buildSuccessResponse`, and `buildFailureResponse`.

- [ ] **Step 1: Write the pure allowlist and validation tests**

Use synthetic values only. Assert the exact map:

```js
assert.deepEqual(logic.PRODUCT_TO_SHEET, {
  '1百神': '1百神',
  '2百神': '2百神',
  '3百神': '3百神',
  '無極汰那': '無極汰那',
  'Mega烈空坐': 'Mega烈空坐'
});
assert.equal(logic.PRODUCT_TO_SHEET['全部價格'], undefined);
assert.equal(logic.PRODUCT_TO_SHEET['高預算帳號'], undefined);
assert.equal(logic.PRODUCT_TO_SHEET['任意工作表'], undefined);
```

Cover exact action, request-ID regex, product allowlist, spreadsheet-ID equality, and shared-secret equality. Assert validation rejects before any fake spreadsheet-open callback is invoked.

- [ ] **Step 2: Write row-selection tests**

Use row objects with explicit `rowNumber`, `account`, `password`, `accountBackground`, and `passwordBackground`. Assert:

```js
const rows = [
  { rowNumber: 1, account: 'header-account', password: 'header-password', accountBackground: '#ffffff', passwordBackground: '#ffffff' },
  { rowNumber: 2, account: 'synthetic-yellow', password: 'pw-yellow', accountBackground: '#ffff00', passwordBackground: '#ffff00' },
  { rowNumber: 3, account: 'synthetic-partial', password: 'pw-partial', accountBackground: '#ffffff', passwordBackground: '#ffff00' },
  { rowNumber: 4, account: '', password: 'pw-incomplete', accountBackground: '#ffffff', passwordBackground: '#ffffff' },
  { rowNumber: 5, account: 'synthetic-first-white', password: 'pw-first-white', accountBackground: '#FFFFFF', passwordBackground: '#ffffff' },
  { rowNumber: 6, account: 'synthetic-second-white', password: 'pw-second-white', accountBackground: '#ffffff', passwordBackground: '#ffffff' }
];
assert.equal(logic.findFirstEligibleRow(rows, new Set()).rowNumber, 5);
```

Assert row 1 is never selected, non-white and incomplete rows are skipped, unresolved reserved keys are excluded, no eligible row returns `null`, and exactly one row is returned.

- [ ] **Step 3: Write audit and replay tests**

Assert `AUDIT_HEADERS` is exactly:

```js
[
  'request_id', 'state', 'requested_at', 'completed_at',
  'product', 'source_sheet', 'source_row', 'account'
]
```

Assert a reserved audit record has no `password` property and no ninth value. Assert replay validates request ID, product, exact source sheet, source row, and account. A changed/missing/deleted source row returns `REPLAY_UNAVAILABLE` and never invokes new-row selection.

- [ ] **Step 4: Write fake transaction ordering tests**

Load `Code.gs` into a VM/fake adapter and record events. Assert:

```js
assert.deepEqual(events, [
  'lock.try:10000',
  'audit.append:RESERVED',
  'spreadsheet.flush',
  'row.paint:#ffff00',
  'spreadsheet.flush',
  'audit.update:COMPLETED',
  'spreadsheet.flush',
  'lock.release'
]);
```

Also assert lock-busy performs zero spreadsheet/audit writes, validation failure performs zero file access, one request paints one row, full width uses `sheet.getMaxColumns()`, replay returns the same B/C values, an unresolved reservation excludes the row from another request, and release occurs in `finally` after thrown mutation errors.

- [ ] **Step 5: Record local execution status accurately**

Run only when Node is available:

```bash
node tests/simple-account-fulfillment.test.js
```

When Node is unavailable, record `BLOCKED: Node.js executable is unavailable`; do not claim RED or GREEN locally. GitHub Actions will execute the test.

- [ ] **Step 6: Commit the test-first server contract**

```bash
git add tests/simple-account-fulfillment.test.js
git commit -m "test: define simple-account fulfillment transaction contract"
```

---

### Task 2: Implement pure fulfillment logic

**Files:**
- Create: `apps-script/simple-account-fulfillment/fulfillment-logic.js`
- Test: `tests/simple-account-fulfillment.test.js`

**Interfaces:**
- Consumes: deterministic row/audit/request shapes from Task 1.
- Produces global/CommonJS namespace `SimpleAccountFulfillmentLogic` with frozen constants and pure functions.

- [ ] **Step 1: Define immutable constants**

Implement exact constants:

```js
const ACTION = 'fulfillSimpleAccount';
const AUDIT_SHEET_NAME = '簡帳出貨紀錄';
const AUDIT_HEADERS = Object.freeze([
  'request_id', 'state', 'requested_at', 'completed_at',
  'product', 'source_sheet', 'source_row', 'account'
]);
const PRODUCT_TO_SHEET = Object.freeze({
  '1百神': '1百神',
  '2百神': '2百神',
  '3百神': '3百神',
  '無極汰那': '無極汰那',
  'Mega烈空坐': 'Mega烈空坐'
});
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;
const WHITE = '#ffffff';
const YELLOW = '#ffff00';
```

Never expose an API that accepts a browser-supplied sheet name.

- [ ] **Step 2: Implement validation and safe errors**

`validateFulfillmentRequest(payload, config)` must return either normalized `{ requestId, spreadsheetId, product, sheetName }` or a stable failure with one of the approved codes. Check action/requestId/product before configuration. Compare `spreadsheetId` with the server property and compare `secret` without returning or logging either secret value.

- [ ] **Step 3: Implement row eligibility and selection**

Normalize backgrounds with `String(value || '').trim().toLowerCase()`. `isEligibleCredentialRow(row)` must require `rowNumber >= 2`, non-empty trimmed B/C values, and both B/C backgrounds equal `#ffffff`. `findFirstEligibleRow(rows, reservedRowKeys)` must scan in input order, skip reserved `sheetName:rowNumber` keys, and return one immutable normalized row or `null`.

- [ ] **Step 4: Implement audit/replay helpers**

`buildReservedAuditRecord` returns exactly eight values and never accepts/stores a password. `validateReplayIdentity` verifies product, exact allowlisted sheet name, row number, and trimmed account. `buildSuccessResponse` returns only the successful row credentials. `buildFailureResponse` returns stable safe messages and no stack, secret, or unrelated credentials.

- [ ] **Step 5: Export for Apps Script and Node**

Use an IIFE that assigns `globalThis.SimpleAccountFulfillmentLogic` and conditionally `module.exports`. Keep the file Apps-Script-compatible: no Node-only code in production logic.

- [ ] **Step 6: Run available focused verification**

Run the Node test only if Node exists. Otherwise inspect the exported names and continue to the available Python/static checks later.

- [ ] **Step 7: Commit pure logic**

```bash
git add apps-script/simple-account-fulfillment/fulfillment-logic.js tests/simple-account-fulfillment.test.js
git commit -m "feat: add deterministic simple-account fulfillment logic"
```

---

### Task 3: Implement the separate Apps Script transaction adapter

**Files:**
- Create: `apps-script/simple-account-fulfillment/Code.gs`
- Test: `tests/simple-account-fulfillment.test.js`

**Interfaces:**
- Consumes: `SimpleAccountFulfillmentLogic` from Task 2.
- Produces Apps Script entrypoint `doPost(e)` and internal transaction helpers using Script Properties, ScriptLock, SpreadsheetApp, and ContentService.

- [ ] **Step 1: Add a thin `doPost` boundary**

Parse only `e.postData.contents`. Return `INVALID_REQUEST` for missing/invalid JSON. Read `SIMPLE_ACCOUNT_SPREADSHEET_ID` and `SIMPLE_ACCOUNT_FULFILLMENT_SECRET` from Script Properties. Call pure validation before `SpreadsheetApp.openById` or any mutation.

- [ ] **Step 2: Acquire and release ScriptLock safely**

Use:

```js
var lock = LockService.getScriptLock();
if (!lock.tryLock(10000)) return jsonOutput_(failure_('BUSY'));
var mutated = false;
try {
  // transaction
} finally {
  if (mutated) SpreadsheetApp.flush();
  lock.releaseLock();
}
```

The transaction itself performs explicit flushes after reservation, formatting, and completion. The `finally` flush is the last defense before lock release when any mutation occurred.

- [ ] **Step 3: Create and hide the audit sheet**

Create `簡帳出貨紀錄` only if missing, write one header row, freeze row 1 if supported, and call `hideSheet()`. Validate an existing header before use; malformed audit structure fails closed with `INTERNAL_ERROR`. Never append password data.

- [ ] **Step 4: Implement replay before new selection**

Search audit rows for exact request ID. For a match, verify product/sheet/row/account against the source row, re-read B/C, and never scan for another row. If state is `RESERVED`, ensure the entire source row is yellow, flush, mark `COMPLETED`, and flush. Return `replayed: true`. If identity cannot be proved, return `REPLAY_UNAVAILABLE`.

- [ ] **Step 5: Recover unresolved reservations**

Before selecting new stock, collect all `RESERVED` records. Their row keys remain unavailable regardless of visual color. Where identity still matches, paint the full row yellow, flush, mark completed, and flush. Where identity cannot be proved, leave the reservation unresolved and excluded; do not select a replacement.

- [ ] **Step 6: Implement first-white-row fulfillment**

Resolve the sheet only from `PRODUCT_TO_SHEET[product]`. Read rows 2 through `getLastRow()`, using displayed values from B/C and backgrounds from B/C. Select the first complete white unreserved row. Append `RESERVED` first, set `mutated = true`, flush, paint `getRange(rowNumber, 1, 1, sheet.getMaxColumns())` yellow, flush, update audit state/completed time, flush, then return exactly one credential pair.

- [ ] **Step 7: Contain errors and logs**

Catch unexpected errors outside the lock boundary and return `INTERNAL_ERROR` without stack details. Any `console`/`Logger` event may contain only event type, request ID, product, state, and row number; never log secret, account, or password.

- [ ] **Step 8: Verify fake adapter ordering and commit**

Run Node focused tests in CI/local only if available, then commit:

```bash
git add apps-script/simple-account-fulfillment/Code.gs tests/simple-account-fulfillment.test.js
git commit -m "feat: add locked simple-account Apps Script fulfillment"
```

---

### Task 4: Add browser-helper tests first

**Files:**
- Create: `tests/simple-account-fulfillment-ui.test.js`
- Test target: `simple-account-fulfillment-helpers.js`
- Test target: `index.html`

**Interfaces:**
- Consumes: approved UI/storage/error contract.
- Produces static and VM-based expectations for the browser helper.

- [ ] **Step 1: Test exact independent settings**

Assert the helper/page contains IDs and storage keys:

```js
simpleAccountSpreadsheetId
simpleAccountGasUrl
simpleAccountFulfillmentSecret
```

Assert visible labels `簡帳試算表 ID`, `簡帳出貨 Apps Script 網址`, `簡帳出貨密鑰`, and save label `💾 儲存簡帳設定`. Assert current `googleSheetId`, `gasUrl`, `openaiApiKey`, and their storage keys remain unchanged in `index.html`.

- [ ] **Step 2: Test exact page/product/navigation structure**

Assert exactly five product controls with exact names, page 1 and page 2 receive `⚡ 簡帳自動出貨`, page 3 has `⬅️ 返回建檔區`, and no product control contains `全部價格`, `高預算帳號`, or a free-form sheet-name input.

- [ ] **Step 3: Test modal compatibility**

Assert the helper exposes `showCredentialModal(account, password)`, and wraps `showCopyModal(accountId)` by preserving semicolon parsing before delegating. Assert `modalAccount` and `modalPassword` copy buttons remain separate and no combined-copy button/text is added.

- [ ] **Step 4: Test pending state transitions**

With fake `localStorage`, `fetch`, `confirm`, and DOM, assert pending state contains only request ID/product/createdAt. Retry reuses the same ID. While pending exists, another product is blocked. Success clears pending only after modal population. Confirmed no-delivery codes clear pending. `REPLAY_UNAVAILABLE` shows manual-inspection guidance then clears. `INTERNAL_ERROR`, network error, invalid JSON, HTML/unreadable response retain pending.

- [ ] **Step 5: Test request and privacy contract**

Assert fetch uses POST, `text/plain;charset=UTF-8`, `cache: 'no-store'`, and body fields action/requestId/spreadsheetId/product/secret. Assert helper source contains no credential/secret console logging and does not store account/password/secret in pending state.

- [ ] **Step 6: Record unavailable local Node execution accurately**

Run if available:

```bash
node tests/simple-account-fulfillment-ui.test.js
```

Otherwise mark it blocked and rely on CI.

- [ ] **Step 7: Commit test-first UI contract**

```bash
git add tests/simple-account-fulfillment-ui.test.js
git commit -m "test: define simple-account browser fulfillment contract"
```

---

### Task 5: Implement the isolated browser helper and third page

**Files:**
- Create: `simple-account-fulfillment-helpers.js`
- Modify: `index.html` (one new script tag only)
- Test: `tests/simple-account-fulfillment-ui.test.js`

**Interfaces:**
- Consumes: existing DOM/modal functions after the page module initializes.
- Produces `window.SimpleAccountFulfillment`, `window.showCredentialModal`, wrapped `window.showCopyModal`, page-3 DOM, settings persistence, sale/recovery handlers, and pending state machine.

- [ ] **Step 1: Load the helper independently**

Add exactly one regular script tag beside existing helper tags:

```html
<script src="simple-account-fulfillment-helpers.js"></script>
```

Do not edit Firebase, SOLD cleanup, restore, repaint, OpenAI, account-save, or inventory code.

- [ ] **Step 2: Inject page 3 and navigation on `DOMContentLoaded`**

Create `mainPage3` under the existing `<main>`. Add one navigation button to page 1 and one to page 2 without renaming/restructuring existing controls. Wrap `window.togglePage` so pages 1, 2, and 3 are mutually exclusive while retaining all existing page-1/page-2 behavior.

- [ ] **Step 3: Implement independent settings**

Render three fields and persist the exact keys. The secret input is type `password`. `saveSimpleAccountSettings` touches only the three simple-account keys and never modifies existing settings.

- [ ] **Step 4: Add five product controls and in-flight state**

Create exactly one control for each product. On sale, validate configuration, check/resolve pending state, ask the exact irreversible confirmation, generate or reuse a request ID, persist non-secret pending state before fetch, disable all product controls, and show `出貨中` on only the selected product.

- [ ] **Step 5: Implement request/recovery state machine**

Send JSON as text/plain with `cache: 'no-store'`. Treat unreadable/HTML/invalid JSON/network failures as unknown and retain pending state. Implement the approved clear/retain matrix for each server code. Recovery reuses the saved request ID and product. Block a different sale while pending is unresolved.

- [ ] **Step 6: Share the existing modal safely**

Implement:

```js
window.showCredentialModal = function(account, password) {
  document.getElementById('modalAccount').value = String(account || '').trim();
  document.getElementById('modalPassword').value = String(password || '').trim() || '（無密碼）';
  document.getElementById('copyModal').classList.remove('hidden');
};
```

Capture the existing high-budget `showCopyModal`, replace it with a wrapper that preserves existing semicolon parsing and delegates to `showCredentialModal`. The simple-account success path passes response `account` and `password` separately. Clear pending only after this helper succeeds.

- [ ] **Step 7: Keep logs credential-free**

Do not log request body, shared secret, account, or password. Status/error UI uses stable user-safe messages.

- [ ] **Step 8: Commit browser implementation**

```bash
git add index.html simple-account-fulfillment-helpers.js tests/simple-account-fulfillment-ui.test.js
git commit -m "feat: add separate simple-account fulfillment page"
```

---

### Task 6: Add deployment and manual-acceptance documentation

**Files:**
- Create: `apps-script/simple-account-fulfillment/README.md`

**Interfaces:**
- Consumes: final browser and Apps Script contracts.
- Produces operator-safe deployment and acceptance instructions.

- [ ] **Step 1: Document a separate Apps Script project**

List exact files to copy, Script Properties names, execute-as-owner, access `Anyone`, authorization, deployment/version update, and the new URL placement in simple-account settings. Explicitly state not to paste these files into the existing high-budget reconciliation deployment.

- [ ] **Step 2: Document security and audit behavior**

State that the secret is POST-body-only, must not be shared/logged, audit stores account but never password, request IDs are idempotency keys, and the audit sheet is hidden but still operator-accessible.

- [ ] **Step 3: Include the complete duplicate/test-spreadsheet acceptance checklist**

Cover all five products, yellow rows before first white row, incomplete/partial-colored rows, whole-row yellow, no stock, concurrency, unknown-result replay, separate modal copy buttons, prohibited tabs, GitHub Pages-origin JSON readability, and regression checks for high-budget/Firebase/restore/repaint/cleanup.

- [ ] **Step 4: State production-readiness gate**

Document that CI is not enough. Production readiness requires a duplicate/test spreadsheet, test Apps Script deployment, real target browser, and successful manual checklist.

- [ ] **Step 5: Commit documentation**

```bash
git add apps-script/simple-account-fulfillment/README.md
git commit -m "docs: add simple-account fulfillment deployment guide"
```

---

### Task 7: Extend static regressions and GitHub Actions

**Files:**
- Modify: `tests/verify_regressions.py`
- Modify: `.github/workflows/sold-reconcile-ci.yml`
- Test: all existing and new test files

**Interfaces:**
- Consumes: implementation from Tasks 2–6.
- Produces static protection and CI execution for the new feature plus all existing regressions.

- [ ] **Step 1: Add static file constants and checks**

Add paths for the browser helper, fulfillment logic, Apps Script adapter, deployment README, and two Node test files. Check exact product list; row-2 start; B/C ownership; forbidden tabs; request-ID regex; audit headers/no password; ScriptLock `tryLock(10000)`; full-row `#ffff00`; reservation before formatting; flush before finally release; fixed property names; and separate Apps Script path.

- [ ] **Step 2: Protect existing behavior statically**

Require the original settings labels/IDs/storage keys, current modalAccount/modalPassword separate copy buttons, `showCopyModal` semicolon compatibility, current Firebase/sold/restore/repaint/OpenAI fragments, and absence of a combined-copy control.

- [ ] **Step 3: Add Node tests to optional local runner**

Extend `node_tests` with:

```python
("simple-account fulfillment tests", ROOT / "tests" / "simple-account-fulfillment.test.js"),
("simple-account fulfillment UI tests", ROOT / "tests" / "simple-account-fulfillment-ui.test.js"),
```

Node absence remains exit code 2 only after all Python static checks pass.

- [ ] **Step 4: Add CI steps without deleting existing steps**

Add:

```yaml
- name: Run simple-account fulfillment tests
  run: node tests/simple-account-fulfillment.test.js

- name: Run simple-account fulfillment UI tests
  run: node tests/simple-account-fulfillment-ui.test.js
```

Keep cleanup, Apps Script reconciliation, settings labels, Python regressions, and diff checks.

- [ ] **Step 5: Run available local checks once at integration boundary**

```bash
python tests/verify_regressions.py
git diff --check
git status --short
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
```

Accept Python exit 2 only when output says all static checks passed and only Node-dependent checks are blocked. Any Python assertion failure is a blocker.

- [ ] **Step 6: Commit CI/static integration**

```bash
git add tests/verify_regressions.py .github/workflows/sold-reconcile-ci.yml
git commit -m "test: verify simple-account fulfillment in CI"
```

---

### Task 8: Perform focused final code review

**Files:**
- Review all changed files

**Interfaces:**
- Consumes: complete feature branch.
- Produces a written review result and any corrective commits.

- [ ] **Step 1: Review the fourteen required failure risks explicitly**

Verify, with exact source/test references:

1. Row 1 cannot be selected.
2. `全部價格` and `高預算帳號` cannot be accessed.
3. Arbitrary sheet names cannot be accepted.
4. One request cannot issue more than one account.
5. Replay returns the same row and cannot consume the next.
6. Reserved rows are unavailable to other requests.
7. `RESERVED` is written/flushed before yellow formatting.
8. Audit never stores password.
9. Entire selected row becomes `#ffff00`.
10. Lock release is in `finally`.
11. Flush happens before releasing a mutated transaction.
12. Unknown outcomes preserve the pending request ID.
13. Existing modal parsing and separate copy buttons remain unchanged.
14. No secrets, real accounts, or passwords appear in logs/committed files.

- [ ] **Step 2: Review high-budget isolation**

Compare `index.html` and existing Apps Script directories against `origin/main`. Confirm only the helper script include is added to `index.html`; Firebase inventory, existing sheet sync, SOLD cleanup, restore, repaint, OpenAI scanning, and high-budget account behavior are unchanged.

- [ ] **Step 3: Run final available checks once**

Repeat only:

```bash
python tests/verify_regressions.py
git diff --check
git status --short
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
```

Do not repeatedly run the entire regression suite after each minor review edit.

- [ ] **Step 4: Commit any review corrections separately**

```bash
git add <corrected-files>
git commit -m "fix: harden simple-account fulfillment review findings"
```

---

### Task 9: Push the existing branch and inspect CI

**Files:**
- No new files unless CI exposes a real defect.

**Interfaces:**
- Consumes: verified local branch.
- Produces updated existing draft PR #55 and GitHub Actions evidence.

- [ ] **Step 1: Push only the existing branch**

```bash
git push -u origin feat/simple-account-auto-fulfillment
```

Do not create another PR, branch, or worktree. Do not merge or enable auto-merge.

- [ ] **Step 2: Confirm PR #55 remains draft**

Verify head branch and draft status. Convert back to draft only if an external action unexpectedly changed it.

- [ ] **Step 3: Inspect GitHub Actions for the pushed head SHA**

Wait for the workflow associated with PR #55. Record workflow name, run ID/URL, head SHA, and each relevant job conclusion.

- [ ] **Step 4: Fix actual CI failures with focused diagnosis**

For a failure, inspect the exact log, reproduce statically/with the narrow test where possible, add or correct the failing test first, make the minimal fix, run available local checks, commit, push the same branch, and inspect the replacement run. Do not suppress or remove existing regressions to make CI green.

- [ ] **Step 5: Leave manual acceptance pending**

Do not access a real sheet or deployment. Record that test-spreadsheet, test Apps Script, real-browser/GitHub-Pages-origin response, and local Edge browser checks remain pending.

---

## Final Verification Record

The final report must distinguish:

- **Passed locally:** exact Python static result, `git diff --check`, worktree status, and reviewed diff commands.
- **Not run locally:** both new Node test files and any other Node tests, because Node is unavailable.
- **GitHub Actions:** exact workflow run and Node/Python/diff conclusions.
- **Browser tests:** blocked locally by unavailable Edge runtime; CI static tests are not a substitute for real-browser acceptance.
- **Manual deployment acceptance:** still pending on a duplicate/test spreadsheet and separate test Apps Script deployment.
- **PR state:** #55 remains draft and unmerged.
- **Worktree state:** existing worktree is preserved.

Do not claim production readiness until every manual acceptance item in the design and deployment README is completed against test infrastructure.