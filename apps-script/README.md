# Hourly SOLD reconciliation adapter

This directory is an additive Google Apps Script integration. The repository
does not contain the production `doPost()` implementation or its exact SOLD
Sheet formatter, so these files do not replace `doPost()` and do not guess
which columns or colors the production formatter uses.

## Files

- `sold-reconcile-logic.js` — pure, deterministic inventory/trigger/row-map
  logic. Copy it into the existing Apps Script project as a script file.
- `hourly-sold-reconcile.gs` — Firebase REST, Sheet deletion, locking, logging,
  and trigger installation. Copy it into the same project.

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
formats. The handler reads Firebase once with an ETag, conditionally applies
the Firebase migration/deletion patch, then removes Sheet rows directly. Sheet
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
| `FIREBASE_DATABASE_URL` | yes | Realtime Database URL, for example `https://your-project-default-rtdb.firebaseio.com` |
| `FIREBASE_AUTH_TOKEN` | yes | Server-authorized Firebase credential accepted by the Realtime Database REST API; never use the frontend API key |
| `SPREADSHEET_ID` | for Sheet work | Google Spreadsheet ID |
| `SHEET_NAME` | for Sheet work | Exact tab name |
| `ACCOUNT_ID_COLUMN` | for Sheet work | One-based data-column number containing the account ID; row 1 is treated as the header |
| `TIMEZONE` | optional | Defaults to `Asia/Taipei` |

The Firebase read sends `X-Firebase-ETag: true`; every migration/deletion PATCH
sends `If-Match` and aborts safely when the ETag is missing or stale. This
prevents a restore that happened before the server write from being overwritten
by an old snapshot. The queue contains only UID/account-ID mapping data and
never passwords.

Do not commit any token or private ID to this repository. Do not weaken Firebase
Realtime Database rules. If a server-authorized Firebase credential cannot be
issued, configure that credential through the project’s secret-management
process before running the handler.

## Deployment

1. Open the existing production Apps Script project that serves the configured
   frontend `gasUrl`.
2. Add both source files from this directory as script files.
3. Add `applyExistingSoldFormattingBatch(...)` by copying or delegating to the
   exact formatter already used by production `doPost({ action: 'sold' })`.
4. Set the Script Properties above. The Firebase token must be a server-side
   credential; the browser Firebase `apiKey` is not sufficient.
5. Save and authorize the Apps Script project for Firebase URL fetches,
   Spreadsheet access, trigger creation, and lock usage.
6. In the Apps Script editor, run `installHourlySoldReconcileTrigger()` once.
   It removes every existing trigger whose handler is `hourlySoldReconcile` and
   creates exactly one time-based `.everyHours(1)` trigger. It does not alter
   other handlers or the existing `doPost()`.
7. Inspect the project’s trigger list and confirm exactly one
   `hourlySoldReconcile` trigger exists.
8. Run `hourlySoldReconcile()` manually once. Confirm the execution log contains
   only aggregate counts (`soldFound`, `legacyDeleteAtInitialized`,
   `expiredDeleted`, `sheetRepainted`, `errors`, and `durationMs`). Confirm no
   password, token, or full account credential is logged.
9. Verify one legacy SOLD Firebase record receives `deleteAt = manualRunNow +
   14 days`, one expired SOLD record is removed from Firebase and its Sheet row,
   and one retained SOLD row is repainted by the copied production formatter.
10. Allow the hourly trigger to run and verify the next execution is safe to
    repeat. A lock-held execution should exit without mutation.

Until steps 1–9 are completed, the hourly feature is not production-active.
The browser’s existing 10-at-a-time manual `action: 'sold'` fallback remains
available and unchanged.
