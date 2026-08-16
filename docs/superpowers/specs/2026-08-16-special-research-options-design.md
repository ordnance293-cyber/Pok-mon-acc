# Special Research Option Expansion Design

## Goal

Extend the existing **特殊調查** checkbox list in `index.html` from 11 options to 15 options by adding:

- `chk_sp_12`: 捷拉奧拉
- `chk_sp_13`: 色違蒂安希
- `chk_sp_14`: 蒂安希
- `chk_sp_15`: 色違凱路迪歐

The change must preserve all existing behavior and remain backward-compatible with previously saved inventory records.

## Scope

This is a focused UI/data-model extension only. Do not refactor unrelated inventory, Firebase, Google Sheets, Smart Hundo, Mega/fusion, pricing, status, or account-management behavior.

## Current Architecture

The Special Research feature is implemented directly in `index.html`:

1. Checkbox inputs are named `chk_sp_1` through `chk_sp_11`.
2. Save logic copies those checkbox states into the inventory record with a numeric loop.
3. Edit/load logic restores each checkbox from the stored field, with a text-based fallback for old records.
4. `AI_PROTECTED_INPUT_IDS` includes the Special Research checkbox IDs so automated form filling does not overwrite them.
5. `generateText()` loops across the Special Research checkbox IDs and produces the `🔥...特殊調查🔥` text segment.

## Design

### UI

Add four checkboxes to the existing **特殊調查** block using the current label/input styling and grid layout:

- `chk_sp_12`, value/label `捷拉奧拉`
- `chk_sp_13`, value/label `色違蒂安希`
- `chk_sp_14`, value/label `蒂安希`
- `chk_sp_15`, value/label `色違凱路迪歐`

No visual redesign is required.

### Persistence

Expand the existing save loop from `1..11` to `1..15`. The new values are stored as four additional boolean fields on each inventory item. Existing records without those fields remain valid.

### Edit / Backward Compatibility

Add restore logic for `chk_sp_12` through `chk_sp_15` using the same pattern as the existing checkboxes:

- Prefer the stored boolean field when present.
- Otherwise infer the value from decoded `fullText` for legacy records.

The text fallback must avoid false matches where one new name is a substring of another. In particular:

- `色違蒂安希` and `蒂安希` must be distinguished so a legacy record containing only `色違蒂安希` does not automatically select both checkboxes.
- `色違凱路迪歐` and `凱路迪歐` must be distinguished so a legacy record containing only `色違凱路迪歐` does not automatically select the normal `凱路迪歐` checkbox.

Existing special cases such as `凱路迪歐,瑪夏多` must continue to work unchanged.

### AI Protection

Expand the Special Research range in `AI_PROTECTED_INPUT_IDS` from 11 to 15 so all four new inputs receive the same protection as existing Special Research fields.

### Generated Text

Expand the Special Research loop in `generateText()` from `1..11` to `1..15`. Selected new options must be emitted in the same comma-separated `🔥...特殊調查🔥` segment as the existing options.

## Data Flow

1. User checks one or more Special Research boxes.
2. Save logic stores `chk_sp_1` through `chk_sp_15` as booleans in the inventory record.
3. `generateText()` includes selected checkbox values in the generated account text.
4. When editing an existing record, explicit stored booleans are restored first; legacy text inference is used only when a stored field is absent.

## Error Handling

No new network or persistence error path is introduced. The new fields use the same existing Firebase save/update path. Missing fields on legacy records are treated as backward-compatible absence rather than errors.

## Testing

Verify at minimum:

1. Each of the four new checkboxes renders in **特殊調查**.
2. Each new checkbox saves and reloads correctly after editing an inventory item.
3. All four can be selected simultaneously and appear in generated text.
4. Existing 11 Special Research options still save, reload, and generate text unchanged.
5. A legacy `fullText` containing `色違蒂安希` restores only `色違蒂安希`, not normal `蒂安希`.
6. A legacy `fullText` containing normal `蒂安希` restores only normal `蒂安希`.
7. A legacy `fullText` containing `色違凱路迪歐` restores only `色違凱路迪歐`, not normal `凱路迪歐`.
8. Existing `凱路迪歐` and `凱路迪歐,瑪夏多` fallback behavior remains correct.
9. `AI_PROTECTED_INPUT_IDS` contains `chk_sp_1` through `chk_sp_15`.
10. No unrelated UI or inventory behavior changes.

## Implementation Boundary

Expected implementation should remain limited to the Special Research handling in `index.html` plus focused tests if the repository already has an appropriate test pattern. No schema migration is required.