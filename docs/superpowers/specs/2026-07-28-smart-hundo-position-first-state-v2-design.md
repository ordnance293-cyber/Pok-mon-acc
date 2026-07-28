# Smart Hundo Position-First State V2 Design

## Objective
Treat card-relative location as the primary state discriminator, close displayed form naming to the existing 23-name allowlist, fail unresolved display dimensions to a CP placeholder, and globally group identical resolved display names.

## State pipeline
Each evidence object is normalized through a dimension-specific position enum. Positive validation requires a clear, present icon in the dimension's fixed region before appearance is inspected. Exact clear all-none evidence is required for negatives. Raw/evidence conflict fails closed to `uncertain`.

| Dimension | Required region | Secondary evidence |
|---|---|---|
| Shiny | `cp_area` | dark blue/teal multiple four-point sparkles |
| Favorite | `upper_right` | filled yellow five-point star |
| Rocket | `lower_left` | cyan purification symbol or purple shadow aura |
| Background | `lower_right` | definitive commemorative/special badge; appearance is supporting evidence |

## Naming and list conversion
Supported-family forms map only through the frozen 23-name map. `not_applicable` uses normalized `base_species`; model `official_name` form suffixes have no authority. Species, supported form, Shiny, Rocket, or Background uncertainty produces `待確認（CPdigits）` (or `待確認`). Favorite and Lucky uncertainty do not block display. Resolved complete names are counted globally and emitted once at first occurrence as `name*N`; placeholders are never grouped.

## Safety and routing
The existing single full-original-image GPT-5.4 Mini card request, high detail, Structured Outputs, medium reasoning, structural retry, and GPT-4.1 Mini non-Smart routing are unchanged. Diagnostics remain allowlisted and never include payloads, credentials, authorization, or image data.
