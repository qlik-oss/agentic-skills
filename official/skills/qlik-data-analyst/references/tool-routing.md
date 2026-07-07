# Tool Routing (fixed 60-tool Qlik MCP server)

The server exposes 60 tools — more than the model reliably selects among. Keep to
the default analysis subset; reach into the on-request groups only when the user's
task names that work. This cuts wrong-tool picks and keeps results small.

## Default analysis subset — use these first

| Task | Tool |
| --- | --- |
| Find / open an app | `qlik_search` |
| Orient once (fields, owner, status) | `qlik_describe_app`, `qlik_get_fields` |
| Set / inspect / clear selection | `qlik_select_values`, `qlik_get_current_selections`, `qlik_clear_selections` |
| Verify a value exists before filtering | `qlik_search_field_values` |
| Distinct values of a field | `qlik_get_field_values` (pass a limit) |
| Run an analytical query | `qlik_create_data_object` (heavy — one per question) |
| Read an existing chart's data | `qlik_get_chart_data` |
| Inventory library items | `qlik_list_measures`, `qlik_list_dimensions` |

## Deterministic app resolution (always do this first)

1. Use `qlik_search` with the app name (and `spaceId` when known).
2. If multiple app candidates are returned, pick exact app-name + exact space-name match.
3. Confirm chosen app name + `appId` in the response before any analysis call.
4. Reuse the same `appId` for all subsequent calls.

If user input is ambiguous across apps/spaces, ask a clarification question instead of guessing.

## On-request groups — only when the user asks for that work

| Group | Tools (representative) | Trigger |
| --- | --- | --- |
| Glossary | `qlik_search_glossary_terms`, `qlik_get_glossary_term`, create/update/delete term, categories, links, `qlik_update_term_status` | Business-glossary work |
| Data products | `qlik_get_data_product`, `qlik_get_data_product_documentation`, create/update/activate/deactivate/delete, `qlik_update_data_product_space` | Data-product management |
| Dataset metadata / quality | `qlik_get_dataset`, `_schema`, `_profile`, `_sample`, `_freshness`, `_trust_score`, `_memberships`, `qlik_update_dataset_metadata`, `qlik_update_dataset_quality`, `_quality_computation_status` | Dataset inspection / governance |
| Master-item writes | create/update/delete `dimension` and `measure` | Building reusable items |
| Sheets / charts | `qlik_create_sheet`, `qlik_add_chart` (heavy), `qlik_add_filter`, `qlik_list_sheets`, `qlik_get_sheet_details` | Dashboard authoring |
| Bookmarks | `qlik_list_bookmarks`, create/select/delete bookmark | Saving/restoring selections |
| Lineage / knowledge base | `qlik_get_lineage`, `qlik_search_knowledgebase_chunks` | Provenance / doc search |

## Sibling disambiguation (don't guess)

- **Read one vs export all:** use `qlik_search_glossary_terms` / `qlik_get_glossary_term`
  for a term; use `qlik_get_full_glossary_export` only when the whole glossary is asked for.
- **Dataset read vs status:** `qlik_get_dataset*` read metadata; `qlik_update_dataset_quality`
  requests a computation; `qlik_get_dataset_quality_computation_status` polls it.
- **Data product state:** `qlik_update_activate_data_product` /
  `qlik_update_deactivate_data_product` change state; `qlik_update_data_product` edits
  properties; `qlik_update_data_product_space` moves it.

## Context hygiene (every call)

- Pass `limit`/`offset` on any list-style tool; default to a small page.
- Request the fewest fields; read names before pulling full definitions.
- Heavy tools (`qlik_create_data_object` 3,099 tok, `qlik_add_chart` 2,804): one per
  question; reuse the active selection instead of re-specifying it.
- After `qlik_select_values`, the selection persists — do not restate it in later calls.

## Failure handling (mandatory)

- On any tool error, stop and classify the error before retrying: schema, expression, invalid field/item, auth/permission, or runtime.
- Retry only with a materially different payload.
- Do not retry more than twice for the same tool/error class.
- If unresolved after two retries, report the blocker clearly and propose a supported fallback.
