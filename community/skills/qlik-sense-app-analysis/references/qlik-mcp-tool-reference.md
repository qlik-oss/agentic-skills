# Qlik MCP Tool Reference

Full catalogue of Qlik MCP server tools by category, condensed from the [Qlik
Cloud help documentation](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikMCP/Qlik-MCP-server-tools.htm) and the live tool schemas. Read this when the
[tool categories overview in `SKILL.md`](../SKILL.md#tool-categories-then-governance--check-before-you-create)
isn't enough detail, or when you need an example prompt pattern for a
category you haven't used yet.

**This catalogue can drift from the live tool surface.** Tool names,
parameters, and availability can change as the Qlik MCP server evolves —
confirm exact names and parameters via tool-search or the [Qlik Cloud help
documentation](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikMCP/Qlik-MCP-server-tools.htm)
before relying on this file for anything critical.

Tool availability also depends on the user's role permissions, space
access, and tenant licensing — a tool may return "no access" even if it's
listed here.

## Table of contents

- [App Discovery & Metadata](#app-discovery--metadata)
- [Datasets & Data Quality](#datasets--data-quality)
- [Data Exploration & Analysis](#data-exploration--analysis)
- [Master Items (Dimensions & Measures)](#master-items-dimensions--measures)
- [Selections & Filtering](#selections--filtering)
- [Bookmarks](#bookmarks)
- [Visualization & Sheets](#visualization--sheets)
- [Data Products](#data-products)
- [Business Glossary](#business-glossary)
- [Lineage](#lineage)
- [Knowledge Bases](#knowledge-bases)

---

## App Discovery & Metadata

Find the right app and understand its structure before building anything.

- `qlik_search` — search apps, datasets, data products, glossaries,
  knowledge bases, and spaces by name or content. Use `'*'` or an empty
  string to list recently used resources. Supports `resourceType` and
  `spaceId` filters.
- `qlik_describe_app` — comprehensive app metadata: fields, owner,
  publishing status.
- `qlik_get_fields` — every field available as a dimension in the app.
- `qlik_list_sheets` — every sheet (dashboard) in the app.
- `qlik_get_sheet_details` — a sheet's charts and their types.

**Example prompt:** *"I need to analyze customer churn."* → `qlik_search`
for churn-related apps → `qlik_describe_app` on the best match to confirm
owner/status → `qlik_get_fields` to find candidate dimensions/measures →
`qlik_list_sheets` to see what dashboards already exist → for a promising
sheet, `qlik_get_sheet_details` to see what's already built and what gaps
remain.

## Datasets & Data Quality

Understand, validate, and govern a dataset before reporting on it.

- `qlik_get_dataset` — metadata including trust score.
- `qlik_get_dataset_schema` — column definitions.
- `qlik_get_dataset_profile` — statistics and distributions.
- `qlik_get_dataset_sample` — first 10 rows, for a quick sanity check.
- `qlik_get_dataset_freshness` — last-updated timestamp.
- `qlik_get_dataset_trust_score` — trust score.
- `qlik_get_dataset_memberships` — which data products the dataset belongs
  to.
- `qlik_update_dataset_metadata` — update name/description/tags.
- `qlik_update_dataset_quality` — request a quality computation.
- `qlik_get_dataset_quality_computation_status` — poll a quality
  computation job.

**Example prompt:** *"Assess the readiness of our Customer Orders dataset
for a new dashboard."* → metadata + trust score → confirm freshness → list
data product memberships → schema + 10-row sample to sanity-check key
fields → profile to spot missing values/outliers → if quality metrics look
stale, trigger a computation and poll until it completes → update the
description with usage guidance.

## Data Exploration & Analysis

Ad hoc investigation without permanently building new visualizations.

- `qlik_create_data_object` — temporary calculation object for ad hoc
  queries. **Qlik performs all calculations** — never sum/average/aggregate
  returned data yourself; call again with a new expression for a different
  cut. Always apply filters to limit data size.
- `qlik_get_field_values` — distinct values for a field. Use before
  filtering to confirm values exist. For high-cardinality fields, use
  `qlik_search_field_values` instead.
- `qlik_search_field_values` — search for specific values across fields;
  the case-insensitive, best way to verify a value exists before using it
  in set analysis or a selection (years, dates, currency codes, product
  names especially).
- `qlik_get_chart_data` — paginated data from an existing chart, with
  current selections applied.
- `qlik_get_chart_info` — a chart's metadata (dimensions, measures, row
  count) without pulling its data.

**Example prompt:** *"Help me investigate why North region revenue dropped
last month."* → check the existing "Revenue by Region" chart's metadata,
then pull its last-two-months data → before selecting, confirm whether
"North", "NORTH", or "Northern" is the value actually used → build a
temporary data object comparing month-over-month revenue/margin by region.

## Master Items (Dimensions & Measures)

Standardize and reuse business logic across charts.

- `qlik_list_dimensions` / `qlik_list_measures` — inventory existing
  library items before creating new ones.
- `qlik_create_dimension` / `qlik_create_measure` — create a governed,
  reusable dimension or measure.
- `qlik_update_dimension` / `qlik_update_measure` — charts using the item
  reflect the change immediately.
- `qlik_delete_dimension` / `qlik_delete_measure` — charts using it may
  break; check usage first if possible.

Only master items created via MCP tools can be updated or deleted via MCP
tools.

**Example prompt:** *"Standardize metrics in our Sales Performance app."*
→ list existing dimensions/measures first → create a "Customer Segment"
dimension and a "Gross Margin %" measure → report back the exact master
item names to reference in future charts.

## Selections & Filtering

Control the interactive filter state of the app — this state is stateful
and persists across tool calls until cleared.

- `qlik_select_values` — apply filters; supports exact values and pattern
  matching (`>2020`, `Elect*c`, etc.). Verify values exist first — a
  selection on a non-existent value fails silently.
- `qlik_clear_selections` — clear all selections, or just one field.
- `qlik_get_current_selections` — inspect what's currently active.

Use selections when filtering the whole app/session for several subsequent
operations. Use set analysis in an expression instead when you need a
one-off filter for a single calculation — it avoids leaving state behind.

## Bookmarks

- `qlik_list_bookmarks` — list bookmarks.
- `qlik_create_bookmark` — save the current selections.
- `qlik_select_bookmark` — apply a bookmark's selections.
- `qlik_delete_bookmark` — remove a bookmark (only if it was created via
  MCP tools).

## Visualization & Sheets

Assemble dashboards.

- `qlik_create_sheet` — new empty sheet. Only create one if the user has
  explicitly asked for it.
- `qlik_add_chart` — add a bar/line/pie/scatter/KPI/table/treemap/pivot/
  heatmap/combo chart. Prefer `libraryId` (master items) over raw
  fields/expressions. Test date/value existence before writing expressions
  with ranges or filters.
- `qlik_add_filter` — add a filter panel so users can interactively slice
  the sheet.

**Example prompt:** *"Create a sheet called 'Sales Overview' with a
Revenue/Orders KPI, a Revenue-by-Month line chart, a Revenue-by-Region bar
chart, and a Year/Region/Category filter panel."*

## Data Products

Manage a data product's full lifecycle as a governed, shareable package of
datasets.

- `qlik_create_data_product` — create.
- `qlik_get_data_product` / `qlik_get_data_product_documentation` —
  metadata and markdown documentation.
- `qlik_update_data_product` — update name/description/datasets.
- `qlik_update_data_product_space` — move to a different space.
- `qlik_update_activate_data_product` / `qlik_update_deactivate_data_product`
  — control availability.
- `qlik_delete_data_product` — retire it entirely.

**Example prompt:** *"Create a 'Sales Analytics – Curated' data product
with Orders, Customers, and Products datasets, document it, then activate
it in our Shared 'Analytics' space."*

## Business Glossary

Set up and maintain a governed glossary end-to-end.

- `qlik_create_glossary` — create a glossary.
- `qlik_create_glossary_category` / `qlik_get_glossary_categories` —
  organize with categories.
- `qlik_create_glossary_term` / `qlik_search_glossary_terms` /
  `qlik_get_glossary_term` / `qlik_update_glossary_term` /
  `qlik_delete_glossary_term` — manage terms.
- `qlik_update_term_status` — move a term through `draft → verified →
  deprecated`. Only a steward can verify a term; once verified, only a
  steward can modify it. Status names are case-sensitive.
- `qlik_create_glossary_term_links` / `qlik_get_glossary_term_links` —
  link terms to apps, datasets, fields, and master items so definitions are
  discoverable from the data itself.
- `qlik_get_full_glossary_export` — the entire glossary in one call; costly,
  use sparingly.

**Example prompt:** *"Build a governed glossary for our Sales domain with
Revenue, Customers, and Pipeline categories, define ARR and Customer Churn,
tag them, set to draft, and link each to the relevant dataset fields and
KPI master items."*

## Lineage

- `qlik_get_lineage` — upstream lineage for a dataset or app. Each call
  returns **one step back only** — call it recursively on the returned
  nodes to walk the full chain.

**Example prompt:** *"Show me the full upstream lineage for the Customer
Orders dataset, walking back to the original source systems."*

## Knowledge Bases

- `qlik_search_knowledgebase_chunks` — semantic/hybrid search over an
  indexed knowledge base's content. Discover knowledge base IDs first via
  `qlik_search(resourceType="knowledgebase")`. Start with a small `topN`.
