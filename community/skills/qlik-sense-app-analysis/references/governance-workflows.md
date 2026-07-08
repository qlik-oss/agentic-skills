# Governance Workflows

Lifecycle rules for the objects this skill can create. These exist to
prevent a common failure pattern: an agent creates a plausible-looking
governed object (a master measure, a glossary term) that duplicates or
contradicts something that already exists, quietly degrading the exact
governance layer it was supposed to strengthen.

## Master items (dimensions & measures)

1. **List first** — `qlik_list_dimensions` / `qlik_list_measures`. Check
   whether an existing item already covers the calculation, even under a
   slightly different name.
2. **Create** with a clear, reusable name — this name is what every future
   chart will reference (`qlik_create_dimension` / `qlik_create_measure`).
3. **Update** affects every chart using the item immediately
   (`qlik_update_dimension` / `qlik_update_measure`) — treat this as a
   production change, not a draft edit. Remind user of the impact and get their go-ahead.
4. **Delete** may break charts still referencing the item
   (`qlik_delete_dimension` / `qlik_delete_measure`) — double confirm with user if deletion is required. Confirm nothing depends on it first.

**Edit boundary**: only master items *created via MCP tools* can be updated
or deleted via MCP tools. An item created through the Qlik Sense UI may not
be editable this way even if it appears in `qlik_list_dimensions`.

## Bookmarks

Bookmarks capture the current selection state for later reuse
(`qlik_create_bookmark` from the active selections, `qlik_select_bookmark`
to reapply them). Same edit boundary as master items: only bookmarks
created via MCP tools can be deleted via MCP tools
(`qlik_delete_bookmark`).

## Data products

A data product is a governed, documented, shareable package of datasets.
Typical lifecycle:

1. **Create** (`qlik_create_data_product`) — name + description; assign to
   a space or leave in the personal space.
2. **Populate** — add datasets via `qlik_update_data_product` (dataset
   patch operations: add/remove/replace).
3. **Document** — write the markdown readme via `qlik_update_data_product`;
   read it back anytime with `qlik_get_data_product_documentation`.
4. **Activate** in a target space (`qlik_update_activate_data_product`) to
   make it consumable, or move spaces first
   (`qlik_update_data_product_space`).
5. **Deactivate** (`qlik_update_deactivate_data_product`) when superseded,
   without losing the definition.
6. **Delete** (`qlik_delete_data_product`) only once retired and no longer
   referenced — this is a hard removal. Double confirm with user if deletion is required. Confirm nothing depends on the data product first.

## Business glossary terms

The glossary has a formal status lifecycle, and it's the one governance
object in this skill with an explicit human-in-the-loop gate:

```
draft ──(steward verifies)──> verified ──(steward only)──> deprecated
```

- **Anyone** (with permission) can create a term in `draft` status
  (`qlik_create_glossary_term`).
- **Only a steward** can move a term to `verified`
  (`qlik_update_term_status`). Status names are case-sensitive: `draft`,
  `verified`, `deprecated` — exactly as written.
- **Once verified, only a steward can modify the term at all** — not just
  the status. If you're not a steward and a term is verified, don't attempt
  to edit it; explain this to the user instead of retrying with different
  parameters.
- **Link terms to real data** with `qlik_create_glossary_term_links` —
  connecting a term to the app, dataset, field, or master item it defines
  makes the definition discoverable from the data itself, not just from a
  glossary search. This is what turns a glossary from documentation into an
  actual source of truth an agent can route to.
- Categories (`qlik_create_glossary_category`) are for organizing large
  glossaries — create them before terms if you're setting up a domain from
  scratch, so terms can be filed under them immediately.

## General principle

Every creation action in this skill should be reversible in spirit even
when it isn't reversible in practice: confirm with the user before creating
something persistent, and lean on `list_*` / `search_*` tools first so you
know whether you're creating something new or should be pointing at
something that already exists.
