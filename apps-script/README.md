# Hourly SOLD reconciliation adapter

This directory is an additive Google Apps Script integration. The repository
does not contain the production `doPost()` implementation or its exact SOLD
Sheet formatter, so these files do not replace `doPost()` and do not guess
which columns or colors the production formatter uses.

## Files

- `sold-reconcile-logic.js` — pure, deterministic inventory, transaction,
  trigger, and row-map logic.
- `hourly-sold-reconcile.gs` — Firebase REST, complete-snapshot conditional
  writes, Sheet deletion, locking, logging, and trigger installation.

The Apps Script project must also provide this adapter function using the exact
existing SOLD formatter implementation:

```javascript
function applyExistingSoldFormattingBatch(sheet, rowsByAccountId, soldItems, config) {
  // Paste or delegate to the formatter currently used by production doPost({action:'sold'}).
  // Use direct Spreadsheet service calls and batched range writes.
  // Return { repainted: <number> } when complete.
}
```

Do not implement this function by guessing column positions, colors, or text
formats. The handler reads the complete Firebase inventory once with an ETag,
plans against that exact snapshot, and conditionally PUTs the complete
resulting inventory back with `If-Match`. It never sends a partial inventory
object. A 412 conflict causes a fresh GET, fresh ETag, fresh plan, and bounded
retry; Sheet state is untouched until the Firebase PUT succeeds. Sheet
deletions are persisted in a `SOLD_SHEET_DELETE_QUEUE` Script Property so a
Sheet failure does not lose the account mapping after Firebase deletion. A
queued UID that is present again in a later Firebase snapshot is treated as
restored or reused and is not deleted from the Sheet. Remaining SOLD repaint
stays explicitly blocked until the real formatter is inserted.

## Script Properties

Configure these in the Apps Script project settings before installing the
trigger:

| Property | Required | Meaning |
| --- | --- | --- |
| `FIREBASE_DATABASE_URL` | yes | Realtime Database URL |
| `FIREBASE_AUTH_TOKEN` | yes | Server-authorized Firebase credential accepted by the REST API; never use the frontend API key |
| `SPREADSHEET_ID` | for Sheet work | Google Spreadsheet ID |
| `SHEET_NAME` | for Sheet work | Exact tab name |
| `ACCOUNT_ID_COLUMN` | for Sheet work | One-based data-column number containing the account ID; row 1 is treated as the header |
| `TIMEZONE` | optional | Defaults to `Asia/Taipei` |
| `SOLD_FORMATTER_READY` | required for trigger/work | Must be the exact string `true` only after the production formatter adapter is integrated and manually tested |

The Firebase read sends `X-Firebase-ETag: true`. Every migration/deletion
write is a complete-inventory `PUT` with `If-Match`; a missing ETag or stale
412 response fails closed. A 412 is retried from a new complete snapshot up to
three total attempts. After exhaustion the run aborts without Sheet side
effects and the next hourly trigger retries. The queue contains only UID and
account-ID mapping data and never passwords.

`SOLD_FORMATTER_READY` is a fail-closed gate. Missing, empty, or any value
other than the exact string `true` prevents both trigger installation and
hourly Firebase/Sheet work. The handler also requires the
`applyExistingSoldFormattingBatch(...)` function to exist. Set the property to
`true` only after the real production SOLD formatter has been integrated and
manually tested.

Do not commit any token or private ID to this repository. Do not weaken Firebase
Realtime Database rules. If a server-authorized Firebase credential cannot be
issued, configure that credential through the project's secret-management
process before running the handler.

## Deployment

1. Open the existing production Apps Script project that serves the configured
   frontend `gasUrl`.
2. Add both source files from this directory as script files.
3. Add `applyExistingSoldFormattingBatch(...)` by copying or delegating to the
   exact formatter already used by production `doPost({ action: 'sold' })`.
4. Set the Script Properties above, but leave `SOLD_FORMATTER_READY` unset until
   the formatter adapter has been integrated and manually tested. The Firebase
   credential must be server-side; the browser Firebase `apiKey` is not enough.
5. Save and authorize the Apps Script project for Firebase URL fetches,
   Spreadsheet access, trigger creation, and lock usage.
6. After the formatter test succeeds, set `SOLD_FORMATTER_READY` to the exact
   string `true`.
7. In the Apps Script editor, run `installHourlySoldReconcileTrigger()` once.
   It removes every existing trigger whose handler is `hourlySoldReconcile` and
   creates exactly one time-based `.everyHours(1)` trigger. It does not alter
   other handlers or the existing `doPost()`.
8. Inspect the project trigger list and confirm exactly one
   `hourlySoldReconcile` trigger exists.
9. Run `hourlySoldReconcile()` manually once. Confirm the execution log contains
   aggregate counts such as `soldFound`, `legacyDeleteAtInitialized`,
   `expiredDeleted`, `sheetRepainted`, `firebaseAttempts`,
   `firebaseConflicts`, `firebaseRetries`, `errors`, and `durationMs`. Confirm
   no password, token, or full account credential is logged.
10. Verify one legacy SOLD Firebase record receives `deleteAt = manualRunNow +
    14 days`, one expired SOLD record is removed from Firebase and its Sheet
    row, and one retained SOLD row is repainted by the copied production
    formatter.
11. Allow the hourly trigger to run and verify the next execution is safe to
    repeat. A lock-held execution should exit without mutation.

Until these steps are completed, the hourly feature is not production-active.
The browser's existing 10-at-a-time manual `action: 'sold'` fallback remains
available and unchanged.
