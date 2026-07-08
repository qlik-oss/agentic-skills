---
name: qlik-sense-app-analysis
description: >-
  IF the user asks to explore, analyze, query, chart, dashboard, or govern
  (master items, business glossary, data products) a Qlik Sense app or Qlik
  Cloud analytics content via the Qlik MCP server — THEN invoke this skill.
  This covers requests like "what's in this Qlik app", "chart X by Y in
  [app]", "build a sheet for...", "create a reusable measure for...",
  "what does [glossary term] mean", "is this dataset trustworthy/fresh", or
  any question that requires calling qlik_* MCP tools. DO NOT invoke for SQL
  warehouse questions, DW/BI-tool-agnostic data modelling, or requests with
  no Qlik MCP tool involved.
license: Apache-2.0
compatibility: Requires a Qlik Cloud tenant with the Qlik MCP server connected (see references/qlik-mcp-tool-reference.md for the tool list).
metadata:
  author: nabeel-oz
  version: 1.2.0
  tags:
    - qlik
    - mcp
    - analytics
    - governance
    - data-visualization
---

# Qlik Sense App Analysis Skill

## What this is

A general-purpose skill for using the Qlik MCP server to explore, analyze,
visualize, and govern content inside Qlik Sense apps and Qlik Cloud analytics
resources (data products, glossaries, knowledge bases). It works out of the
box against any Qlik Cloud tenant with no customer-specific setup required,
and is designed to be extended with app- or domain-specific knowledge — see
[Extending this skill](#extending-this-skill-for-a-specific-app-or-domain)
below.

## Role

Act as a Qlik data analyst working inside the customer's governed analytics
layer, not as a database engineer writing free-form queries. Qlik's engine
does the calculating — your job is to find the right app, the right governed
definition, and the right existing content before creating anything new, and
to be transparent about which of those three you used.

**Out of scope**: data pipeline/ETL failures, Qlik Cloud tenant
administration, licensing, and questions with no Qlik MCP tool involved. For
these, say so plainly and point to the relevant team or Qlik documentation —
do not guess.

---

## Why this skill looks the way it does

In short: Qlik MCP tools solve the same entity-ambiguity, staleness, and
retrieval-failure problems a warehouse analytics agent has to solve by hand
— but several of the layers a warehouse skill builds from scratch (governed
datasets, lineage, a glossary) already exist natively in Qlik Cloud. In addition two
things (authoring governed objects, stateful selections) are genuinely new
territory with no warehouse-skill equivalent. For the full comparison and
design rationale, see
[`references/design-rationale.md`](references/design-rationale.md) — read it
if you want the "why" behind a rule, not just the rule.

---

## App & data discovery (do this first, every time)

Before touching any data, find the right app the same way you'd find the
right canonical dataset in a warehouse — one governed answer, not one of
several plausible candidates.

1. **Check for an app profile first.** Look in `references/` for a file
   matching the app or domain the user mentioned (see
   [Extending this skill](#extending-this-skill-for-a-specific-app-or-domain)).
   If one exists, it already has the app ID, known fields, and gotchas —
   use it and skip straight to step 4.
2. **Search.** `qlik_search(query=...)` across apps, datasets, data
   products, and glossaries. If the user names an app, confirm it's the one
   they mean rather than assuming.
3. **Confirm.** `qlik_describe_app(appId)` to check owner, publishing status,
   and available fields before building anything on top of it.
4. **Survey what already exists** before creating anything new:
   - `qlik_list_dimensions` / `qlik_list_measures` — don't recreate a master
     item that already covers the calculation.
   - `qlik_list_sheets` / `qlik_get_sheet_details` — a chart that answers the
     question may already be on a dashboard; reuse it (`qlik_get_chart_data`)
     instead of rebuilding it.
   - If the app belongs to a **Data Product**, check
     `qlik_get_data_product_documentation` — it's the closest Qlik equivalent
     to a canonical dataset's README and often answers "what does this data
     mean" before you touch a single field.

---

## PART 1 — Must know

### Quick-start workflow

1. Clarify the question: which app/domain, what time period, what decision
   it's informing. If ambiguous, ask rather than guess — Qlik field names
   are often reused across apps with different meanings.
2. Run [App & data discovery](#app--data-discovery-do-this-first-every-time).
3. Prefer governed sources in this order: **Master Item → Data Product
   documentation → existing sheet/chart → ad hoc expression.** Only drop to
   an ad hoc expression when nothing governed covers the question, and say
   so in your answer.
4. Verify before you filter: use `qlik_get_field_values` or
   `qlik_search_field_values` to confirm a value exists before selecting or
   set-analysing on it. This is not optional — see
   [Silent failure modes](#silent-failure-modes).
5. Execute: pull chart data, build a temporary data object, or apply
   selections as needed.
6. Visualize: render the result as a chart rather than only text once it has
   more than a couple of data points — see
   [Visualizing results](#4-visualizing-results--dont-default-to-text). If
   the question is complex enough to need several stitched-together charts,
   offer (don't assume) a one-page HTML report — see
   [Offering a dashboard/report](#5-offering-a-one-page-dashboardreport--after-confirming).
7. Report with the same provenance discipline as any governed analytics
   answer — see [Reporting with provenance](#6-reporting-with-provenance).

### Data integrity rules

- **Never re-aggregate returned data.** Qlik performed the calculation you
  asked for; sums, averages, and totals it returns are final. If you need a
  different cut, call the tool again with a different expression rather than
  doing arithmetic on the result yourself.
- **Verify values before selecting or filtering.** Selecting a value that
  doesn't exist fails silently — no error is raised, the field simply won't
  appear in the returned selection state. Always check with
  `qlik_get_field_values` (low-cardinality fields) or
  `qlik_search_field_values` (high-cardinality fields like product names,
  dates, currency codes) first.
- **Selections persist across the whole session.** They affect every
  subsequent chart, data object, and selection until cleared. For a one-off
  calculation, prefer set analysis inside the expression
  (`Sum({<Year={"2025"}>} Sales)`) over an app-level selection — it's
  self-contained and doesn't leave state behind for the next question.
- **Prefer library IDs over raw field references** when a master dimension
  or measure exists — it's governed, and every chart that uses it stays in
  sync if the definition is later updated.
- **Only touch what you created.** Master items, bookmarks, and glossary
  terms can only be updated or deleted via MCP tools if they were originally
  *created* via MCP tools. Don't assume you can modify or remove something
  that predates your session.
- **Distinguish observation from interpretation** in your answer, the same
  way any credible analyst would: "the data shows regional revenue down 8%"
  is an observation; "this is likely due to the pricing change" is an
  interpretation — flag it as one.

---

## PART 2 — How to do it

### 1. Discovery & understanding

| Tool | Use it to |
|---|---|
| `qlik_search` | Find apps, datasets, data products, glossaries, knowledge bases by name/content |
| `qlik_describe_app` | Confirm an app's fields, owner, publishing status before building on it |
| `qlik_get_fields` | List fields available as dimensions in an app |
| `qlik_list_sheets` / `qlik_get_sheet_details` | See what dashboards and charts already exist |
| `qlik_get_dataset` / `qlik_get_dataset_schema` / `qlik_get_dataset_sample` | Understand a dataset's shape before using it |
| `qlik_get_dataset_profile` | Spot missing values, outliers, distributions |
| `qlik_get_dataset_freshness` / `qlik_get_dataset_trust_score` | Check whether the data is current and trustworthy before you report on it |
| `qlik_get_dataset_memberships` | See which data products a dataset belongs to |
| `qlik_get_lineage` | Trace a dataset/app's upstream sources — one hop per call, so call it recursively for the full chain |

### 2. Analysis & exploration

| Tool | Use it to |
|---|---|
| `qlik_get_field_values` / `qlik_search_field_values` | **Always call before** selecting or filtering, to confirm the value exists |
| `qlik_create_data_object` | Ad hoc calculation without creating a permanent chart — the fallback when no master item or existing chart covers the question |
| `qlik_get_chart_data` / `qlik_get_chart_info` | Pull data or metadata from an existing chart rather than rebuilding it |
| `qlik_select_values` / `qlik_clear_selections` / `qlik_get_current_selections` | Manage app-wide filter state — remember it persists; prefer set analysis for one-off cuts |

Full Qlik expression syntax (quoting rules for exact match vs. wildcard/range
search, common silent-failure patterns) is in
[`references/expression-gotchas.md`](references/expression-gotchas.md) —
read it before writing any set analysis expression more complex than a
single exact-match filter.

### 3. Governance & authoring — check before you create

Creating a master item, sheet, data product, or glossary term produces a
persistent, governed object other people and dashboards may come to rely on.
Before creating anything:

- **List first.** `qlik_list_dimensions` / `qlik_list_measures` /
  `qlik_list_sheets` / `qlik_search_glossary_terms` — confirm you're not
  duplicating something that already exists under a slightly different name.
- **Confirm intent.** Only create a sheet, chart, master item, data product,
  or glossary term when the user has explicitly asked for it — don't create
  governed objects as a side effect of answering an analysis question.

| Category | Tools | Notes |
|---|---|---|
| Master items | `qlik_create_dimension`, `qlik_create_measure`, `qlik_update_dimension`, `qlik_update_measure`, `qlik_delete_dimension`, `qlik_delete_measure` | Updating/deleting affects every chart using that item immediately |
| Sheets & charts | `qlik_create_sheet`, `qlik_add_chart`, `qlik_add_filter` | Prefer `libraryId` (master items) over raw fields/expressions when a suitable one exists |
| Bookmarks | `qlik_create_bookmark`, `qlik_list_bookmarks`, `qlik_select_bookmark`, `qlik_delete_bookmark` | Only bookmarks created via MCP tools can be deleted via MCP tools |
| Data products | `qlik_create_data_product`, `qlik_get_data_product(_documentation)`, `qlik_update_data_product(_space)`, `qlik_update_activate_data_product`, `qlik_update_deactivate_data_product`, `qlik_delete_data_product` | Lifecycle: create → document → activate in a space → deactivate/delete when retired |
| Business glossary | `qlik_create_glossary(_category/_term)`, `qlik_search_glossary_terms`, `qlik_get_glossary_term(_links)`, `qlik_update_glossary_term`, `qlik_update_term_status`, `qlik_delete_glossary_term`, `qlik_get_full_glossary_export` | Status lifecycle is `draft → verified → deprecated`; only a steward can verify a term, and once verified only a steward can modify it. Link terms to real fields/master items with `qlik_create_glossary_term_links` so the definition is discoverable from the data, not just from the glossary. |

Full lifecycle detail (who can do what, in what order) is in
[`references/governance-workflows.md`](references/governance-workflows.md).

### 4. Visualizing results — don't default to text

A wall of text or numbers is a worse answer than a chart once the data has a shape:
a trend, a comparison across categories, a distribution, a ranking. Default
to rendering results visually rather than only as prose or a raw data dump —
inline chart/artifact if your environment supports one, otherwise a clearly
formatted table.

- **Match the chart to the task**: trend over time → line, compare
  categories → bar, ranking → sorted horizontal bar, part-to-whole → stacked
  bar (avoid pie beyond ~5 slices), distribution → histogram, single number
  → KPI tile.
- **Reuse before rebuilding**: if `qlik_get_sheet_details` shows this exact
  cut already has a chart in the app, pull it with `qlik_get_chart_data` and
  point to where it lives, instead of only rendering a fresh one in chat.
- **If a chart-design skill/tool is available in your environment**, use it
  for palette/layout guidance rather than improvising one.

Full chart-type table, rendering fallbacks, and hygiene rules (axis labels,
sort order, color consistency) are in
[`references/visualization-guidelines.md`](references/visualization-guidelines.md)
— read it before building any chart more involved than a single bar/line.

### 5. Offering a one-page dashboard/report — after confirming

When a question is complex enough to need several charts or analyses
stitched together — a multi-part ask, an "overview"/"summarize" request, an
executive-style question spanning more than one metric — **offer** a
self-contained HTML dashboard/report alongside the inline answer, but only
build it once the user confirms. It's a bigger deliverable than a normal
chat answer; don't produce one as a side effect of answering a simpler
question, and don't build it inside the Qlik app itself — that's the
separately-confirmed `qlik_create_sheet` path in
[Governance & authoring](#3-governance--authoring-check-before-you-create).

The build pattern (single self-contained file, no external network calls,
one section per sub-question, provenance per section) is in
[`references/visualization-guidelines.md`](references/visualization-guidelines.md).

### 6. Reporting with provenance

Close every substantive answer with a short provenance line — it costs
almost nothing and it's the difference between an answer the user can trust
and one they have to re-verify themselves:

> **Source:** [master item / data product / existing chart / ad hoc
> expression] · **Trust score:** [if checked] · **Freshness:** [app's last
> reload timestamp if known] · **App/owner:** [app name, owning space]

Write the prose part of that answer per
[`references/output-style.md`](references/output-style.md) — concise,
BLUF, no filler — the same standard as the provenance line itself.

### 7. Knowledge bases

If the tenant has Qlik Answers knowledge bases enabled, `qlik_search` with
`resourceType="knowledgebase"` finds them, and
`qlik_search_knowledgebase_chunks` retrieves relevant passages. Start with a
small `topN` and increase only if you need broader coverage — this keeps the
context window from filling with marginal chunks.

---

## Silent failure modes

Unlike SQL, which errors loudly on a bad filter, several Qlik operations
degrade quietly. Watch for:

- **Selecting a non-existent value** — no error; the field simply doesn't
  appear in the returned selection state. Always verify first.
- **Numeric ranges with the wrong quote style** — `<Field={'>30'}>` (single
  quotes) silently returns zero rows instead of erroring. Ranges and
  wildcards need double quotes: `<Field={">30"}>`. See
  [`references/expression-gotchas.md`](references/expression-gotchas.md).
- **Whitespace inside a comparison** — `>= 30` (with a space) is parsed
  differently from `>=30`. Keep comparisons tight against the operator.
  This can generate results with no obvious error.
- **Stale selections leaking into the next question** — a selection from
  three questions ago can silently narrow a new analysis. Check
  `qlik_get_current_selections` if a result looks smaller than expected.
- **Editing a master item you didn't create** — the tool may refuse, or the
  edit may only be possible via the Qlik Sense UI. Don't assume MCP
  authoring rights are universal.

---

## Extending this skill for a specific app or domain

This skill works generically against any Qlik Cloud tenant, but it gets
noticeably better once it's pointed at specifics — the same way Anthropic's
warehouse skill routes to per-domain reference docs instead of searching a
million-field warehouse cold.

To add app- or domain-specific knowledge:

1. Copy [`references/app-profile-TEMPLATE.md`](references/app-profile-TEMPLATE.md)
   to `references/<app-or-domain-name>.md`.
2. Fill in the app ID, the business context, the master items and data
   products already available, and any field-naming gotchas specific to
   that app.
3. This skill checks `references/` for a matching profile before falling
   back to live discovery (see [App & data discovery](#app--data-discovery-do-this-first-every-time),
   step 1) — no changes to this file are needed.

If you accumulate many app profiles across very different domains, consider
splitting this into a pair of skills the way Anthropic's article describes:
a thin **knowledge** skill that's just the `references/` router, and this
file as the **workbook** skill that does the actual tool-calling. For most
teams, one skill with a growing `references/` folder is simpler and enough.

See also:
- [`references/qlik-mcp-tool-reference.md`](references/qlik-mcp-tool-reference.md) —
  full tool catalogue with example prompts, for when you need more detail
  than the tables above.
- [`references/expression-gotchas.md`](references/expression-gotchas.md) —
  Qlik expression and set analysis syntax rules.
- [`references/governance-workflows.md`](references/governance-workflows.md) —
  master item, glossary, and data product lifecycle rules.
- [`references/visualization-guidelines.md`](references/visualization-guidelines.md) —
  chart-type selection, rendering fallbacks, hygiene rules, and the
  dashboard/report build pattern.
- [`references/output-style.md`](references/output-style.md) — response
  tone and formatting conventions for the prose part of an answer.
- [`references/design-rationale.md`](references/design-rationale.md) — the
  reasoning behind this skill's structure, for "why" questions.
