# Simple-Account Auto-Fulfillment Design

Date: 2026-08-21

## 1. Goal

Add a separate **簡帳自動出貨** flow to the existing Pokémon inventory website. The operator chooses one product, presses **售出**, and receives exactly one account and one password from a second Google Spreadsheet. The selected source row is then painted yellow so it cannot be sold again.

The existing high-budget account inventory, Firebase records, current Google Sheet synchronization, SOLD cleanup, repaint, restore, and copy behavior must remain unchanged.

## 2. Confirmed business rules

### 2.1 Separate spreadsheet

The simple-account stock is stored in a different Google Spreadsheet from the spreadsheet already used by the current inventory system.

The website therefore needs an independent simple-account connection configuration:

- `簡帳試算表 ID`
- `簡帳出貨 Apps Script 網址`
- `簡帳出貨密鑰`

These settings are stored locally in the operator's browser and do not replace or modify the existing `Google 試算表 ID`, `Apps Script 同步網址`, or `OpenAI API Key` settings.

### 2.2 Allowed products and exact sheet names

Only the following five products can be fulfilled:

| Website product | Exact Google Sheet tab |
| --- | --- |
| `1百神` | `1百神` |
| `2百神` | `2百神` |
| `3百神` | `3百神` |
| `無極汰那` | `無極汰那` |
| `Mega烈空坐` | `Mega烈空坐` |

The tabs `全部價格` and `高預算帳號` are explicitly outside this change and must never be addressed by the fulfillment endpoint.

The server uses a fixed allowlist. It must not accept an arbitrary tab name supplied by the browser.

### 2.3 Sheet layout

All five product tabs use the same layout:

- Row 1 is the header and is never selected or recolored.
- Data begins at row 2.
- Column B contains the account.
- Column C contains the password.
- A white credential row is available stock.
- A yellow row is sold stock.

Availability is determined from the credential cells: both B and C must have a white background and both displayed values must be non-empty. Any row with a missing account, missing password, or any non-white credential background is skipped.

### 2.4 Selection order

For the selected product tab, scan from row 2 downward and take the first eligible white row. Never choose randomly and never skip a valid earlier row.

One button press fulfills exactly one account.

### 2.5 Successful sale

A successful sale performs all of the following:

1. Reserves one eligible row under an Apps Script lock.
2. Reads the account from column B and password from column C.
3. Paints the complete source row yellow, from column A through the sheet's current maximum column.
4. Flushes the spreadsheet mutation before releasing the lock.
5. Returns the same account and password to the website.
6. Opens the existing account/password modal.

The modal must keep the current high-budget sale behavior:

- Account and password appear in separate fields.
- Each field has its own copy button.
- The existing handover instructions remain available.
- No combined “copy account + password” button is added.

## 3. Scope boundaries

### In scope

- A separate simple-account fulfillment page in the current website.
- Five fixed product sale buttons.
- Independent simple-account settings.
- A separate Apps Script web-app implementation for the second spreadsheet.
- First-white-row selection, whole-row yellow formatting, locking, authentication, idempotency, recovery, and audit logging.
- Reuse of the existing account/password modal through a shared credential-display helper.
- Automated tests, CI coverage, deployment instructions, and a real-browser/manual acceptance checklist.

### Out of scope

- Importing the `高預算帳號` spreadsheet tab.
- Reading or using `全部價格`.
- Changing the current Firebase inventory data model.
- Changing current high-budget add/edit/sell/restore/delete/repaint behavior.
- Stock-count dashboards, pricing calculations, batch sales, returns, or automatic restocking.
- Selling more than one account per request.

## 4. Architecture

Use an independent fulfillment path rather than extending the existing high-budget Apps Script behavior.

### 4.1 Browser side

The existing static website gains a third page, `簡帳自動出貨`. It contains:

- A clearly labeled simple-account connection panel.
- Five product cards or buttons.
- One irreversible-sale confirmation before sending a request.
- A status area for processing, success, out-of-stock, busy, authentication, configuration, and unknown-result states.
- A pending-request recovery control when the previous network result is unknown.

The current page 1 and page 2 flows remain intact. Navigation may add a button to open the third page, but must not rename or restructure the existing inventory pages.

### 4.2 Apps Script side

The new fulfillment code is packaged under a separate repository directory and is intended for a separate Apps Script project/deployment. It must not share `doPost` routing, configuration, triggers, or Script Properties with the existing high-budget reconciliation deployment.

Suggested repository structure:

- `simple-account-fulfillment-helpers.js`
- `apps-script/simple-account-fulfillment/Code.gs`
- `apps-script/simple-account-fulfillment/fulfillment-logic.js`
- `apps-script/simple-account-fulfillment/README.md`
- `tests/simple-account-fulfillment.test.js`
- `tests/simple-account-fulfillment-ui.test.js`

`Code.gs` is a thin web-app and Spreadsheet adapter. Selection, validation, transaction-state transitions, and response shaping should live in isolated logic that can be exercised without Google services.

### 4.3 Configuration

The browser stores:

- `simpleAccountSpreadsheetId`
- `simpleAccountGasUrl`
- `simpleAccountFulfillmentSecret`

The Apps Script project stores:

- `SIMPLE_ACCOUNT_SPREADSHEET_ID`
- `SIMPLE_ACCOUNT_FULFILLMENT_SECRET`

The request spreadsheet ID must exactly match the server-side allowlisted spreadsheet ID. The server always opens the allowlisted ID; it never uses an unchecked arbitrary ID to access a file.

The web app is deployed as the script owner so it can read and format the spreadsheet. Deployment access and the shared secret are documented in the deployment README. The secret is sent only in the POST body, is never placed in a URL, and is never logged or returned.

## 5. Request and response contract

### 5.1 Request

The website sends one JSON request containing:

```json
{
  "action": "fulfillSimpleAccount",
  "requestId": "browser-generated-unique-id",
  "spreadsheetId": "configured-simple-account-sheet-id",
  "product": "3百神",
  "secret": "configured-shared-secret"
}
```

Requirements:

- `action` must exactly equal `fulfillSimpleAccount`.
- `requestId` must be a bounded, valid unique identifier.
- `product` must be one of the five allowlisted values.
- `spreadsheetId` must match the Apps Script property.
- `secret` must match the Apps Script property.
- Invalid requests fail before opening or mutating a spreadsheet.

The browser uses a POST format that the Apps Script web app can parse without placing credentials in query parameters. The release acceptance test must prove that the deployed GitHub Pages origin can read the returned JSON in a real browser; this is not assumed from unit tests.

### 5.2 Success response

```json
{
  "ok": true,
  "requestId": "browser-generated-unique-id",
  "product": "3百神",
  "sheetName": "3百神",
  "rowNumber": 43,
  "account": "example-account",
  "password": "example-password",
  "replayed": false
}
```

A repeated request with the same `requestId` returns the same account and password and sets `replayed` to `true`. It must not consume another row.

### 5.3 Failure response

Failures use a stable code and a user-safe message:

```json
{
  "ok": false,
  "code": "OUT_OF_STOCK",
  "message": "3百神目前已無可出售庫存"
}
```

Required error codes:

- `INVALID_REQUEST`
- `UNAUTHORIZED`
- `CONFIG_MISMATCH`
- `SHEET_NOT_FOUND`
- `OUT_OF_STOCK`
- `BUSY`
- `REPLAY_UNAVAILABLE`
- `INTERNAL_ERROR`

Responses must not contain stack traces, secrets, or credentials from any row other than the successfully reserved row.

## 6. Concurrency and idempotency

### 6.1 Script lock

Every transaction that reads reservation state, chooses a source row, writes the audit record, or paints the row runs while holding one Apps Script script lock.

If the lock cannot be acquired within the configured short timeout, return `BUSY` without changing the spreadsheet.

Call `SpreadsheetApp.flush()` before releasing the lock so pending formatting and audit writes are committed while exclusive access is still held.

### 6.2 Audit sheet

The fulfillment spreadsheet contains a hidden system tab named `簡帳出貨紀錄`. It is created automatically if missing and has one header row with these columns:

1. `request_id`
2. `state`
3. `requested_at`
4. `completed_at`
5. `product`
6. `source_sheet`
7. `source_row`
8. `account`

The audit sheet never stores the password.

Transaction states are:

- `RESERVED`
- `COMPLETED`

### 6.3 New request sequence

Under the lock:

1. Validate request, configuration, and allowlist.
2. Search the audit sheet for the same request ID.
3. Recover any earlier reserved transaction as described below.
4. Read the selected product tab from row 2 downward.
5. Exclude rows already referenced by an unresolved reservation.
6. Choose the first eligible white row.
7. Append a `RESERVED` audit record containing request ID, product, sheet, source row, and account.
8. Flush the reservation.
9. Paint the entire source row `#ffff00`.
10. Flush the formatting.
11. Mark the audit record `COMPLETED` and set `completed_at`.
12. Flush again, then return the credentials.

The reservation is written before the irreversible yellow formatting. This prevents a network or execution interruption from causing a retry to consume the next row.

### 6.4 Replay and recovery

For an existing request ID:

- Verify that product, source sheet, source row, and account still agree with the source data.
- Re-read the password from column C; the audit sheet does not store it.
- If the record is `RESERVED`, ensure the source row is yellow, flush, and promote it to `COMPLETED`.
- Return the same source account and password.
- Never scan for or consume another row.

At the start of later transactions, recover outstanding `RESERVED` records whose source account still matches. This keeps a reserved row from remaining visually white after an interrupted execution. A reserved source row is never available to a different request.

If the source row was deleted, moved, emptied, or changed so the original request cannot be proved, fail closed with `REPLAY_UNAVAILABLE`; do not choose a replacement row.

## 7. Browser request recovery

Before sending a new fulfillment request, the browser saves only this non-secret pending state:

```json
{
  "requestId": "...",
  "product": "3百神",
  "createdAt": 1787313600000
}
```

It does not store the account, password, or shared secret in the pending record.

Rules:

- Retries reuse the same request ID.
- Clear pending state only after a successful credential response or a confirmed terminal server rejection.
- A network error or unreadable response leaves the request pending.
- When pending state exists, the page displays `上次出貨結果尚未確認` and offers `重新查詢上次出貨`.
- Until the pending request is resolved, starting a different product sale is blocked. This prevents an unknown first result followed by an accidental second sale.

The fetch request uses `cache: "no-store"`, disables all simple-account sale buttons while in flight, and never logs the secret, account, or password.

## 8. User interface behavior

### 8.1 Settings panel

The simple-account page contains a separate `簡帳連線設定` panel with persistent visible labels and explanations:

- `簡帳試算表 ID` — which separate stock spreadsheet is used.
- `簡帳出貨 Apps Script 網址` — the independent web-app endpoint.
- `簡帳出貨密鑰` — authorizes fulfillment and is shown as a password input.

The save control clearly states that it saves the simple-account settings. Existing top-header settings and their storage keys remain unchanged.

### 8.2 Product controls

Display exactly five sale controls, using the exact product names. Each sale requires a confirmation such as:

`確定要售出「3百神」並取得 1 組帳號嗎？`

While processing:

- Disable all five sale buttons.
- Show `出貨中` on the selected product.
- Do not allow a second request from the same page.

### 8.3 Credential modal

Refactor the current modal entry point into a shared helper that accepts separate account and password values. The current high-budget `showCopyModal(accountId)` keeps parsing its existing semicolon format and delegates to that helper. The simple-account flow calls the helper with the two server response fields directly.

This refactor must preserve every existing high-budget modal behavior and must not introduce a combined-copy action.

## 9. Error handling

- Missing browser configuration: do not send a request; identify the missing setting.
- User cancels confirmation: no request and no mutation.
- `OUT_OF_STOCK`: show the selected product is out of stock; do not open the credential modal.
- Incomplete white row: skip it and continue scanning.
- Partially colored or non-white credential row: skip it.
- Missing allowlisted tab: return `SHEET_NOT_FOUND`; do not use another tab.
- Lock timeout: return `BUSY`; do not reserve or color anything.
- Authentication or spreadsheet mismatch: return a generic configuration/authentication message and expose no row data.
- Known server failure before reservation: clear pending state.
- Network or unknown response after dispatch: keep pending state and guide the operator to replay the same request.
- Unexpected server exception: return `INTERNAL_ERROR`; do not include exception details in the HTTP response.

Server logs may contain event type, request ID, product, state, and row number. They must never contain the shared secret or password. Account values should be omitted from console logs even though the hidden audit sheet stores the account for recovery.

## 10. Testing strategy

Implementation follows red-green-refactor.

### 10.1 Pure logic tests

Test at minimum:

- Exact product allowlist and tab mapping.
- Rejection of `全部價格`, `高預算帳號`, and arbitrary names.
- Row 1 is always skipped.
- First eligible row is chosen from top to bottom.
- Yellow, partially colored, non-white, blank-account, and blank-password rows are skipped.
- `OUT_OF_STOCK` when no eligible row remains.
- One request selects one row only.
- Same request ID replays the same row.
- A different request cannot select a reserved row.
- Reserved transaction recovery reaches `COMPLETED` without selecting another row.
- Replay fails closed when source identity no longer matches.
- Password is absent from the audit-record shape.

### 10.2 Apps Script adapter tests

Use deterministic fake Spreadsheet and lock adapters to verify:

- Validation happens before file access.
- Lock-busy path performs zero writes.
- Reservation is written before yellow formatting.
- The full row width is painted `#ffff00`.
- Flush occurs before lock release.
- Errors never leak secret/password data.
- Existing request replay reads B/C from the original row.

### 10.3 Browser/static tests

Verify:

- Three independent settings exist with persistent labels.
- Exactly five product controls exist with exact names.
- Existing settings IDs and localStorage keys remain unchanged.
- The modal still has separate account/password copy controls and no combined copy control.
- Pending state reuses the same request ID and blocks another product.
- Terminal responses clear pending state; network ambiguity preserves it.
- Existing high-budget modal parsing still works.

### 10.4 Regression and CI

CI runs the new Node tests alongside all existing cleanup, Apps Script reconciliation, settings-label, browser/static, and Python regression checks, followed by `git diff --check`.

No implementation is ready to merge while any existing or new regression test fails.

## 11. Manual acceptance

Use a test copy of the real simple-account spreadsheet and a deployed test Apps Script web app.

Required manual checks:

1. Configure the second spreadsheet ID, test web-app URL, and secret in the website.
2. For each of the five tabs, make rows 2 and 3 yellow and row 4 white with valid B/C credentials.
3. Sell that product once.
4. Confirm row 4, not any earlier yellow row, is returned.
5. Confirm the full row 4 becomes yellow.
6. Confirm the modal shows separate account/password fields and separate copy buttons.
7. Confirm a second sale returns the next white row.
8. Confirm no stock produces the correct message and no mutation.
9. Confirm an incomplete white row is skipped.
10. Trigger two near-simultaneous requests from two tabs/devices and confirm they cannot receive the same source row.
11. Simulate a network interruption and confirm replaying the pending request returns the same account rather than consuming another row.
12. Confirm `全部價格`, `高預算帳號`, the existing high-budget inventory, Firebase, restore, repaint, cleanup, and current credential modal continue to behave as before.
13. Confirm the deployed GitHub Pages origin can read the Apps Script JSON response in the actual target browser.

## 12. Deployment and operational notes

The repository implementation supplies a dedicated README with exact copy/deploy steps. Deployment is not complete until:

- A separate Apps Script project contains the new fulfillment files.
- The script properties contain the allowlisted spreadsheet ID and fulfillment secret.
- The script is authorized to access the second spreadsheet.
- A new web-app deployment URL is saved in the website's simple-account settings.
- The real-browser response smoke test passes.
- The hidden `簡帳出貨紀錄` sheet is created successfully on first use.

Changing Apps Script code requires creating a new deployment version or updating the deployment before production use.

## 13. Success criteria

The change is successful only when all of the following are true:

- The operator can choose one of the five exact products and receive exactly one account.
- Selection starts at row 2 and always uses the first complete white B/C row.
- The selected full row becomes yellow before credentials are treated as delivered.
- Concurrent or repeated requests cannot issue the same row twice or consume extra rows.
- Unknown network outcomes can be replayed using the same request ID.
- Account and password are shown separately in the existing modal.
- Passwords are never stored in the audit sheet or logs.
- Existing high-budget behavior and its current spreadsheet/Firebase integration remain unchanged.
