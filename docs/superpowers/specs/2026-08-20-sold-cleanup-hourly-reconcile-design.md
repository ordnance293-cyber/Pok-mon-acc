# Pokémon SOLD Cleanup and Hourly Reconcile Design

## Context

The checked-out branch was clean and strictly behind `origin/main`. A rebase
could not create metadata because this linked worktree stores Git administration
outside the writable sandbox, so the branch was safely fast-forwarded with
`git merge --ff-only origin/main`. This integrated the existing
`sold-account-cleanup.js`, `tests/sold-account-cleanup.test.js`, frontend
single-batch cleanup, and Sheet deletion path before this change.

The repository and all reachable Git history contain no production Google Apps
Script `doPost()` source or exact SOLD formatter. The frontend confirms the
published request contract (`sold`, `restore`, `delete`, and `syncExactOrder`),
but its server implementation is external to this repository. The new hourly
integration therefore remains additive and does not replace or guess the
existing `doPost()` behavior.

## Data contract

`SOLD_ACCOUNT_RETENTION_MS` is exactly `14 * 24 * 60 * 60 * 1000`.

The cleanup planner treats a record as eligible only when `status === 'sold'`.
For an eligible record, a finite positive `deleteAt` is authoritative:

- `deleteAt <= now` means expired and eligible for deletion.
- `deleteAt > now` means retained.
- Missing, zero, non-numeric, infinite, or otherwise invalid `deleteAt` means
  legacy migration. The planner schedules `deleteAt = now + retention` and
  never expires that record in the same run.

`soldAt` remains a display/history field. Migration never overwrites it and
never uses it to expire a legacy record. ACTIVE records are ignored regardless
of stale timer fields.

Sale transitions write `status: 'sold'`, a fresh `soldAt`, and a fresh
`deleteAt`. Repainting an already-SOLD record does not write Firebase timer
fields. Restore writes `status: 'active'`, `soldAt: null`, and `deleteAt:
null`; an edit from SOLD to ACTIVE follows the same clearing rule.

## Components and data flow

### `sold-account-cleanup.js`

The existing helper remains the single browser cleanup planner and changes from
`needsSoldAt` to `needsDeleteAt`. It returns `{ expired, needsDeleteAt }`, uses
deterministic timestamp validation, and contains no timers or Firebase calls.

### `index.html`

The initial Firebase listener keeps its one-shot cleanup behavior. It builds one
multi-location update from the planner:

```js
updates[`${item.uid}/deleteAt`] = now + SOLD_ACCOUNT_RETENTION_MS;
updates[item.uid] = null;
```

Planner classification guarantees the same UID cannot receive both operations.
Expired records continue through the existing `action: 'delete'` Sheet
integration after the Firebase update. The existing 10-at-a-time manual
`action: 'sold'` loop remains unchanged because the deployed server endpoint is
unknown and cannot safely be extended by guessing.

### `apps-script/`

The isolated Apps Script adapter consists of:

- a pure `SoldReconcileLogic` module for inventory classification, Firebase
  update construction, duplicate account-ID mapping, and trigger planning;
- an Apps Script handler with `hourlySoldReconcile()`, an idempotent
  `installHourlySoldReconcileTrigger()`, and duplicate-trigger cleanup;
- a deployment README with Script Properties, secure Firebase authentication,
  installation, verification, and the exact formatter integration boundary.

The handler obtains one Firebase inventory snapshot with an ETag, computes
migration and expiration, conditionally applies the Firebase multi-location
patch, then removes expired Sheet rows through direct Spreadsheet service calls.
Sheet deletions are persisted in a Script Properties retry queue. A queued UID
that is present again in a later Firebase snapshot is treated as restored or
reused and is not deleted from the Sheet. The handler then calls a required
`applySoldFormattingBatch(...)` adapter for remaining SOLD rows. The formatter
adapter deliberately has no guessed column or color behavior. The existing
production SOLD formatter must be inserted or delegated there before claiming
exact Sheet repaint compatibility.

All Firebase server requests require Script Properties, including a database URL
and server-authorized token. The frontend Firebase API key is never used as a
server credential. No Firebase rules are changed.

`LockService.getScriptLock().tryLock(...)` prevents overlapping runs. Trigger
installation removes all existing triggers for the named hourly handler and
creates exactly one `.timeBased().everyHours(1)` trigger using the configured
timezone, making repeated installation idempotent.

## Failure and idempotence behavior

- Migration updates are monotonic: valid `deleteAt` values are not moved.
- A legacy record is migrated, not deleted, in its first classification run.
- Timestamp validation accepts only finite positive numbers or non-empty numeric
  strings; booleans and arrays fail safe into migration.
- Sheet deletion is retried safely; missing rows are treated as already deleted.
- Firebase deletion uses `null` paths in one ETag-guarded patch. A stale ETag
  aborts the mutation safely, and the next hourly run retries it.
- Sheet deletion failures remain in a Script Properties queue; a restored or
  reused UID removes its stale queue entry without deleting its current row.
- Repaint failures are logged as counts and safe error summaries without
  credentials; the next hourly execution retries them.
- A lock conflict exits without mutation.
- Duplicate account IDs map to all matching Sheet rows, and malformed timestamps
  fail safe into migration or retention rather than deletion.

## Verification and deployment boundary

JavaScript unit tests remain in the repository for Node-enabled CI. This
environment has no Node executable, so the Python regression verifier will
report Node checks as BLOCKED rather than silently passing them. The existing
browser harness remains unchanged and its Edge GPU failure is reported as an
environmental BLOCKED result.

The hourly code is not production-active until it is copied into the existing
Apps Script project, configured with Script Properties, authorized, installed,
and manually verified. Because the production `doPost()` and SOLD formatter are
not in the repository, exact Sheet repaint deployment requires that one explicit
formatter adapter integration step.
