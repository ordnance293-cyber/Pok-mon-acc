# Task 3 report: simple-account browser recovery helpers

## Scope

Implemented only the pure browser/CommonJS helper module and its deterministic additions to `tests/simple-account-fulfillment.test.js`. No server, Apps Script, `index.html`, network, DOM, Google, Firebase, or deployment behavior was changed.

## Implementation

- Added `simple-account-fulfillment-helpers.js` with the exact five-product allowlist, request-ID validation, secure UUID/getRandomValues generation, payload construction, pending-state parsing, response/network classification, pending-clear rules, product blocking, safe Chinese messages, and `PENDING_STORAGE_KEY` (`simpleAccountPendingFulfillment`).
- Attached the helper as both `window.SimpleAccountFulfillmentHelpers` when a browser global is present and a CommonJS module export for CI tests.
- Pending data is reconstructed from only `requestId`, `product`, and `createdAt`; unexpected fields are not retained.
- Request payload construction contains no URL behavior, query parameters, logging, or credential persistence.

## Tests added

The deterministic test additions use synthetic values only and cover:

- exact products and request-ID pattern;
- UUID and `getRandomValues` fallback IDs plus distinct generated values;
- exact payload shape and invalid product/request-ID rejection;
- pending-state serialization exclusion, malformed-state rejection, retry request-ID reuse, and different-product blocking;
- clear/keep behavior for all specified result codes, successful delivery shape, replay/manual-inspection state, malformed/HTML/unreadable responses, and network failures;
- Chinese safe-message redaction for synthetic secrets, credentials, and exception text.

## Verification and limitation

- `git -c safe.directory=<worktree> diff --check` completed successfully (exit code 0). Git emitted only an LF-to-CRLF working-copy warning for the existing test file.
- `node tests/simple-account-fulfillment.test.js` was not run: `node` is unavailable in this local environment. Consequently, the required red/green test executions remain for CI or another Node-enabled environment, and no local passing-test claim is made.

## Concerns

- The helper is intentionally not integrated into `index.html`; that is Task 5.
- `REPLAY_UNAVAILABLE` remains pending until a caller has shown the required audit/source-row instruction. The helper exposes this as `requiresManualInspection: true` and does not clear it automatically.
