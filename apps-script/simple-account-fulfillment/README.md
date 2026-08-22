# 簡帳自動出貨 Apps Script

This directory is a separate Apps Script web-app project for the five-product
簡帳自動出貨 workflow. It must not be copied into, or deployed from, the
existing high-budget account Apps Script project.

## Separate project setup

1. Create a completely separate Google Apps Script project for simple-account
   fulfillment.
2. Copy only `Code.gs` and `fulfillment-logic.js` from this directory into the
   new project. Do not copy the existing high-budget `doPost` implementation
   into this project, and do not add this handler to the high-budget project.
3. In **Project Settings → Script Properties**, set:

   | Property | Value |
   | --- | --- |
   | `SIMPLE_ACCOUNT_SPREADSHEET_ID` | The ID of the separate test/stock spreadsheet |
   | `SIMPLE_ACCOUNT_FULFILLMENT_SECRET` | A long random shared secret |

   Use a long random secret, keep it in the project’s secret-management
   process, and never commit it. The browser must be configured with the same
   values through the simple-account settings panel, but the secret is never
   included in a URL or logged.

4. Authorize the project to access the separate stock spreadsheet. Use a
   duplicate/test spreadsheet while validating the workflow; do not use the
   production inventory spreadsheet for automated tests.
5. Deploy the project as a web app:

   - **Execute as:** Me (the script owner)
   - **Who has access:** Anyone

6. Save the new deployment URL in the website field **簡帳出貨 Apps Script
   網址**. Save the same configured spreadsheet ID and shared secret in the
   website’s **簡帳連線設定** panel. Use the real GitHub Pages origin during
   browser acceptance; unit tests do not prove that readable cross-origin JSON
   works in the deployed browser.

After changing either Apps Script file, create/select a new deployment version
and update the website URL if the deployment URL changes. Saving the source
file alone does not update an existing web-app deployment.

## Spreadsheet contract

The configured spreadsheet must contain these exact source tabs:

- `1百神`
- `2百神`
- `3百神`
- `無極汰那`
- `Mega烈空坐`

Row 1 is a header and is never selected. Starting at row 2, account is column B
and password is column C. A row is available only when both displayed values
are non-empty after trimming and both B/C backgrounds are exactly white
(`#ffffff`, case-insensitive). The first eligible row is selected and the
complete row width is painted `#ffff00`.

The service creates and hides `簡帳出貨紀錄` when it is missing. Its columns
are exactly `request_id`, `state`, `requested_at`, `completed_at`, `product`,
`source_sheet`, `source_row`, and `account`. It stores no password. The audit
row is reserved and flushed before the source row is painted, so an interrupted
transaction can be recovered safely. A script lock protects the transaction;
lock timeout returns `BUSY` without spreadsheet writes.

## Safe recovery

The browser keeps only a non-secret pending request ID, product, and timestamp.
If the network result is unknown, select **重新查詢上次出貨**. The same request
ID is replayed, so the service returns the original row rather than consuming
the next account. Do not create a new request ID until the pending result has
been confirmed.

For `REPLAY_UNAVAILABLE`, the browser first shows a prominent instruction to
inspect `簡帳出貨紀錄` and the referenced source tab and row; it then clears
browser pending state. The operator must complete that manual review before
taking any further fulfillment action. The service does not silently issue a
replacement account. `INTERNAL_ERROR`, network failure, invalid JSON,
unreadable responses, and HTML responses keep the pending ID because the
server may already have reserved or painted a row.

## Acceptance boundary

This documentation describes deployment only; it does not claim that a live
deployment or spreadsheet has been tested. Before enabling the workflow,
follow `docs/manual-tests/simple-account-auto-fulfillment.md` against a
duplicate/test spreadsheet and a test deployment. Confirm that the actual
GitHub Pages origin can read the JSON response in the target browser.
