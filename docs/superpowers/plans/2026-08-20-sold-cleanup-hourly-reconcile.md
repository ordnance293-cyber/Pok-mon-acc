# Pokémon SOLD Cleanup and Hourly Reconcile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate SOLD retention from soldAt-based 30-day cleanup to idempotent deleteAt-based 14-day cleanup and add an isolated, lock-protected hourly Google Apps Script reconciliation path without changing the unknown production doPost contract.

**Architecture:** Reuse the integrated `sold-account-cleanup.js` planner and its initial Firebase single-batch caller, replacing only its retention field and classification rules. Keep the current frontend 10-request manual repaint fallback. Add a pure Apps Script-compatible reconciliation module plus an Apps Script adapter that reads Firebase once, batches Sheet/Firebase operations, and delegates exact SOLD formatting through an explicit adapter boundary.

**Tech Stack:** Vanilla browser JavaScript, Firebase Realtime Database Web SDK, Firebase Realtime Database REST API from Google Apps Script, Google Apps Script `SpreadsheetApp`, `ScriptApp`, `LockService`, Node `assert` tests, and Python source-regression checks.

**Spec:** `docs/superpowers/specs/2026-08-20-sold-cleanup-hourly-reconcile-design.md`

## Global Constraints

- Retention is exactly `14 * 24 * 60 * 60 * 1000` milliseconds.
- Legacy SOLD records with missing or invalid `deleteAt` receive `now + retention` and are never deleted in that same run.
- Valid `soldAt` is preserved; valid `deleteAt` is never moved forward.
- ACTIVE records are never deleted because of stale timer fields.
- Sale transitions write `status`, `soldAt`, and `deleteAt`; restore clears `soldAt` and `deleteAt` with `null`.
- Repaint never modifies `soldAt` or `deleteAt`.
- Expired Firebase records use one multi-location `null` update, and the existing Sheet delete action remains intact.
- Do not modify Smart Hundo, trainer-team, copy, edit, sorting, or unrelated inventory behavior.
- Do not overwrite or guess the external production `doPost()` or SOLD formatter.
- Apps Script configuration uses Script Properties and never hardcodes private credentials.
- Browser and Node tests must report environmental blocking separately from passing tests.

---

### Task 1: Add failing deleteAt planner and Apps Script logic tests

**Files:**
- Modify: `tests/sold-account-cleanup.test.js`
- Create: `tests/apps-script-sold-reconcile.test.js`
- Create: `apps-script/sold-reconcile-logic.js` only after the tests have been run red

**Interfaces:**
- `sold-account-cleanup.test.js` consumes `planSoldAccountCleanup(items, now)` and expects `{ expired, needsDeleteAt }`.
- `apps-script-sold-reconcile.test.js` consumes `SoldReconcileLogic.planInventoryReconciliation`, `buildFirebaseInventoryUpdates`, `mapAccountIdsToSheetRows`, and `planHourlyTriggerInstallation`.

- [ ] **Step 1: Replace the historical 30-day assertions with failing 14-day tests.**

Add cases for the exact retention constant, legacy missing/invalid `deleteAt`, old `soldAt` grace-period behavior, preserved valid `deleteAt`, expiration boundary, ACTIVE protection, and disjoint migration/deletion lists. Add source assertions for the frontend sale, restore, repaint, multi-location update, existing Sheet delete action, and preserved 10-request fallback.

- [ ] **Step 2: Add failing pure Apps Script logic tests.**

Cover sold filtering, malformed timestamps, duplicate account IDs, Firebase update paths, idempotent second-run planning, row mapping, and a trigger plan that deletes all existing handler triggers before creating one hourly trigger.

- [ ] **Step 3: Run the focused tests and record the expected red result.**

Run:

```powershell
node tests/sold-account-cleanup.test.js
node tests/apps-script-sold-reconcile.test.js
```

Expected in this environment: the commands are BLOCKED because Node.js is not installed. In a Node-enabled environment they must fail on the old 30-day/soldAt implementation before production code is changed.

### Task 2: Migrate the shared cleanup helper

**Files:**
- Modify: `sold-account-cleanup.js`
- Test: `tests/sold-account-cleanup.test.js`

**Interfaces:**
- Produces `SOLD_ACCOUNT_RETENTION_MS`, `validTimestamp`, and `planSoldAccountCleanup(items, now)` for both browser and Node callers.

- [ ] **Step 1: Implement the minimum deleteAt planner.**

Keep the existing UMD wrapper and timestamp validation. For each item with a UID and `status === 'sold'`, put invalid/missing `deleteAt` in `needsDeleteAt`, valid `deleteAt <= now` in `expired`, and valid future `deleteAt` in neither list. Ignore all other records. Return exactly `{ expired, needsDeleteAt }`.

- [ ] **Step 2: Run the focused helper test.**

Run `node tests/sold-account-cleanup.test.js`. Expected: PASS in a Node-enabled environment; BLOCKED here until a Node runtime exists.

- [ ] **Step 3: Refactor only after green.**

Retain the existing deterministic API and remove all soldAt-based expiration logic. Do not add timers or Firebase calls.

### Task 3: Update the frontend sale, restore, cleanup, and fallback paths

**Files:**
- Modify: `index.html`
- Test: `tests/sold-account-cleanup.test.js`
- Test: `tests/verify_regressions.py`

**Interfaces:**
- `index.html` consumes `window.SoldAccountCleanup.SOLD_ACCOUNT_RETENTION_MS` and `planSoldAccountCleanup`.
- Existing external request bodies for `sold`, `restore`, `delete`, and `syncExactOrder` remain unchanged.

- [ ] **Step 1: Change the initial cleanup batch.**

Use `needsDeleteAt` and write `updates[\`${item.uid}/deleteAt\`] = now + window.SoldAccountCleanup.SOLD_ACCOUNT_RETENTION_MS`. Keep `updates[item.uid] = null` for expired records, call one `update(inventoryRef, updates)`, and keep `syncDeletedAccountToSheets` in its existing batched deletion path. Ensure the planner makes migration and deletion mutually exclusive.

- [ ] **Step 2: Add sale and restore timer fields.**

When an ACTIVE record is sold, use one `now` and write `{ status: 'sold', soldAt: now, deleteAt: now + retention }`. Keep valid SOLD history when an already-SOLD item is repainted or edited. Restore writes `{ status: 'active', soldAt: null, deleteAt: null }`. Editing from SOLD to ACTIVE clears both fields; editing an already-SOLD record does not extend them.

- [ ] **Step 3: Verify the manual fallback remains unchanged.**

Keep `window.bulkMarkAsSold`, the confirmation/completion UI, `const BATCH = 10`, and the existing `action: 'sold'` request body. Do not introduce an unverified bulk action name.

- [ ] **Step 4: Run the source checks.**

Run `python tests/verify_regressions.py`. It must report all static checks and the new SOLD source checks; Node execution is reported BLOCKED if unavailable.

### Task 4: Add Apps Script pure logic and hourly adapter

**Files:**
- Create: `apps-script/sold-reconcile-logic.js`
- Create: `apps-script/hourly-sold-reconcile.gs`
- Create: `apps-script/README.md`
- Test: `tests/apps-script-sold-reconcile.test.js`

**Interfaces:**
- `SoldReconcileLogic.planInventoryReconciliation(items, now)` returns `sold`, `expired`, `needsDeleteAt`, `retained`, and `duplicateAccountIds`.
- `SoldReconcileLogic.buildFirebaseInventoryUpdates(plan, now)` returns relative `inventory` PATCH paths, with no UID in both migration and deletion paths.
- `SoldReconcileLogic.mapAccountIdsToSheetRows(rows, accountIdColumn)` maps every duplicate account ID to all matching data rows.
- `hourlySoldReconcile()` is the time-driven handler.
- `installHourlySoldReconcileTrigger()` removes existing handler triggers and creates exactly one `.everyHours(1)` trigger using `TIMEZONE` or `Asia/Taipei`.
- `applySoldFormattingBatch(sheet, rowsByAccountId, soldItems, config)` is the explicit formatter adapter and must fail clearly until the production formatter is supplied.

- [ ] **Step 1: Implement the pure logic after its tests are red.**

Use the same finite-positive timestamp rule and 14-day constant as the browser helper. Make legacy migration take precedence over expiration. Deduplicate Sheet row lookup without deduplicating Firebase UIDs. Return stable arrays for deterministic tests.

- [ ] **Step 2: Implement secure Firebase and Sheet adapters.**

Read `FIREBASE_DATABASE_URL`, `FIREBASE_AUTH_TOKEN`, `SPREADSHEET_ID`, `SHEET_NAME`, `ACCOUNT_ID_COLUMN`, and `TIMEZONE` from `PropertiesService`. Read Firebase once through `UrlFetchApp.fetch`; PATCH only relative inventory paths. Never log tokens, passwords, full account IDs, or raw inventory payloads.

- [ ] **Step 3: Implement safe operation ordering and logging.**

Acquire `LockService.getScriptLock()` with `tryLock`; return safely on contention. Delete expired Sheet rows bottom-up in grouped ranges, treating missing rows as already deleted. Apply the Firebase migration/deletion patch only for expired records whose Sheet deletion is safe. Repaint remaining SOLD rows through `applySoldFormattingBatch`; catch/log count-only errors so the next hourly trigger retries.

- [ ] **Step 4: Implement and test trigger installation.**

Use `ScriptApp.getProjectTriggers()`, remove every trigger whose handler is `hourlySoldReconcile`, and create one `ScriptApp.newTrigger('hourlySoldReconcile').timeBased().everyHours(1)` trigger. Keep `removeDuplicateHourlySoldReconcileTriggers` or equivalent internal cleanup available for inspection.

- [ ] **Step 5: Document the missing production formatter integration.**

Explain that the repository did not contain `doPost()` or exact SOLD formatting. Give exact Script Properties, copy/paste steps, formatter adapter insertion point, authorization, trigger installation, one manual run, duplicate-trigger verification, and Firebase/Sheet result checks. Explicitly state that the existing `doPost()` is not replaced.

### Task 5: Make the Python verifier environment-aware without weakening source locks

**Files:**
- Modify: `tests/verify_regressions.py`

**Interfaces:**
- The verifier keeps all existing source hashes and contracts, adds deleteAt/Apps Script security checks, and reports Node-dependent checks as `BLOCKED` when `shutil.which('node')` is empty.

- [ ] **Step 1: Add static assertions for the new production boundaries.**

Assert the 14-day constant, deleteAt migration/deletion fragments, sale/restore clearing, preserved manual fallback, Apps Script handler/trigger/lock/configuration names, absence of hardcoded Firebase server credentials, and the formatter adapter boundary.

- [ ] **Step 2: Run Node tests only when Node exists.**

Run both deterministic JS test files when available. When unavailable, print explicit BLOCKED lines and return a distinct blocked exit status after static checks; never print a PASS line for the missing runtime.

- [ ] **Step 3: Run the verifier and correct production/source checks, not tests.**

Use `python tests/verify_regressions.py` and preserve all unrelated Smart Hundo and trainer-team locks.

### Task 6: Full verification, diff review, and focused commits

**Files:**
- Review all modified and created files.

- [ ] **Step 1: Run every available required command.**

Run:

```powershell
python tests/verify_regressions.py
python tests/run_browser_tests.py
node tests/sold-account-cleanup.test.js
node tests/apps-script-sold-reconcile.test.js
```

Record exact PASS, FAIL, BLOCKED, and NOT RUN statuses. Do not reclassify the Edge GPU failure or missing Node runtime as passing.

- [ ] **Step 2: Inspect the final diff.**

Run `git diff --check`, `git diff --stat`, and `git diff -- index.html sold-account-cleanup.js tests/sold-account-cleanup.test.js apps-script tests/verify_regressions.py`. Confirm no Smart Hundo/trainer-team behavior or Firebase rules changed.

- [ ] **Step 3: Create focused commits.**

Commit the implementation and tests with a message such as `feat: add migration-safe sold retention and hourly reconcile adapter`. Do not claim production trigger installation; report the commit SHA and remaining manual deployment steps.
