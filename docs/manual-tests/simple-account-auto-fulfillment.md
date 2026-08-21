# 簡帳自動出貨手動驗收

Run this checklist only against a duplicate/test spreadsheet and a separate
test Apps Script web-app deployment. Use synthetic account/password pairs such
as `synthetic-account-01` and `synthetic-password-01`; never paste real
credentials into screenshots, logs, fixtures, or this repository.

## Deployment and browser origin

- [ ] A completely separate Apps Script project was created; the existing
      high-budget deployment was not modified.
- [ ] The test project contains only the simple-account `Code.gs` and
      `fulfillment-logic.js` files.
- [ ] `SIMPLE_ACCOUNT_SPREADSHEET_ID` and
      `SIMPLE_ACCOUNT_FULFILLMENT_SECRET` are configured only in the test
      project’s Script Properties, using synthetic/test values.
- [ ] The test project is deployed as a web app executing as the owner with
      access set to Anyone.
- [ ] The website’s **簡帳試算表 ID**, **簡帳出貨 Apps Script 網址**, and
      **簡帳出貨密鑰** fields contain the matching test values, and the secret
      field is masked.
- [ ] The real GitHub Pages origin was opened in the actual target browser;
      the page could read the Apps Script JSON response (not an opaque
      `no-cors` response).

## Spreadsheet preparation

- [ ] The test spreadsheet has the exact tabs `1百神`, `2百神`, `3百神`,
      `無極汰那`, and `Mega烈空坐`.
- [ ] Every tab has a header in row 1 and synthetic account/password values in
      columns B/C.
- [ ] `簡帳出貨紀錄` was created automatically, hidden after creation, and has
      the exact eight columns: `request_id`, `state`, `requested_at`,
      `completed_at`, `product`, `source_sheet`, `source_row`, `account`.
- [ ] The audit sheet contains no password values.

## Five products and row selection

For each control, prepare at least three rows: an earlier yellow row, an
earlier incomplete or partially colored row, and a later complete white row.

- [ ] Page 1 and Page 2 both expose **⚡ 簡帳自動出貨**.
- [ ] Page 3 is named **簡帳自動出貨** and exposes **⬅️ 返回建檔區**.
- [ ] Exactly five sale controls are present: `1百神`, `2百神`, `3百神`,
      `無極汰那`, and `Mega烈空坐`.
- [ ] `全部價格` and `高預算帳號` are not simple-account sale controls.
- [ ] Each click asks `確定要售出「<product>」並取得 1 組帳號嗎？`.
- [ ] For every product, the earlier yellow row is skipped.
- [ ] For every product, the first complete white row is selected from top to
      bottom.
- [ ] A row with a blank account, blank password, non-white B/C, or only one
      white B/C cell is skipped.
- [ ] Row 1 is never selected or recolored.
- [ ] Exactly one account and password are returned per click.
- [ ] The complete selected row from column A through the current maximum
      column becomes `#ffff00`.
- [ ] The returned account and password appear in separate modal fields with
      separate copy buttons; no combined-copy button exists.
- [ ] A second sale for the same product selects the next eligible row.

## Stock, concurrency, and replay

- [ ] After all eligible rows for a product are sold, the next request shows
      the out-of-stock result and does not paint another row.
- [ ] Two simultaneous requests cannot receive the same row; one request
      receives `BUSY` or the next available row according to lock timing.
- [ ] Interrupt the browser/network after dispatching a request. The page
      shows **上次出貨結果尚未確認** and keeps the non-secret pending request
      ID.
- [ ] **重新查詢上次出貨** reuses that exact request ID and returns the same
      source row, not the next row.
- [ ] A different product is blocked while an unresolved pending request
      exists.
- [ ] A confirmed `OUT_OF_STOCK`, `BUSY`, `INVALID_REQUEST`, `UNAUTHORIZED`,
      `CONFIG_MISMATCH`, or `SHEET_NOT_FOUND` result clears pending state.
- [ ] A `REPLAY_UNAVAILABLE` result prominently instructs the operator to
      inspect `簡帳出貨紀錄` and the referenced source row, then clears browser
      pending state; no replacement account is silently issued and no further
      fulfillment action is taken before that manual review.
- [ ] A network failure, HTML response, invalid JSON, unreadable response, or
      `INTERNAL_ERROR` keeps the pending request for replay.

## Regression protection

- [ ] The existing high-budget flow still parses its semicolon-delimited value
      into separate account and password fields.
- [ ] Existing account-copy, password-copy, and handover-message copy buttons
      still work.
- [ ] `全部價格` remains untouched.
- [ ] `高預算帳號` sale/add/edit/sell/restore/delete behavior remains
      unchanged.
- [ ] Firebase inventory behavior remains unchanged.
- [ ] Existing Google Sheet synchronization, SOLD cleanup, restore, repaint,
      and AI image scanning remain unchanged.
- [ ] No real account, password, spreadsheet ID, Apps Script URL, or secret
      appears in repository files, test output, screenshots, or commits.

Do not mark this checklist complete from mocked unit tests alone. A deployment
acceptance is complete only after the duplicate/test spreadsheet and test web
app have been exercised from the actual deployed GitHub Pages origin.
