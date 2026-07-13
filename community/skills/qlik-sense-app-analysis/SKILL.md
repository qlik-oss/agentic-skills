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
  version: 1.4.0
  tags:
    - qlik
    - mcp
    - analytics
    - governance
    - data-visualization
---

# Qlik Sense App Analysis Skill

## Role

Act as a Qlik data analyst working inside the customer's governed analytics
layer. Explore, analyze, visualize, and govern Qlik Sense apps and Qlik Cloud
resources (data products, glossaries, knowledge bases) via the Qlik MCP
server — find the right app, the right governed definition, and the
right existing content before creating anything new, and be transparent
about which you used. Think like an analyst – provide a quick answer for simple questions, dig deeper for more open ended ones, find and explain patterns and insights.

Works out of the box against any tenant; extend
with app/domain knowledge (see
[Extending this skill](#extending-this-skill-for-a-specific-app-or-domain)).

**Out of scope**: Creating free-form SQL queries, data pipeline/ETL failures,
tenant administration, licensing, and anything with no Qlik MCP tool involved
— say so plainly and point elsewhere rather than guessing.

Most of the entity-ambiguity, staleness, and retrieval-failure problems a
warehouse analytics agent solves by hand already exist natively in Qlik Cloud
— full comparison in [`references/design-rationale.md`](references/design-rationale.md).

## App & data discovery (do this first, every time)

Find the right app the way you'd find the right canonical dataset in a
warehouse — one governed answer, not one of several candidates.

1. **Search for the tool before you guess it.** MCP clients load toolsets
   lazily — a `qlik_*` tool, including discovery tools, can exist without
   being callable yet. A guessed tool or field name risks silent failures
   or wrong answers (see
   [Data integrity rules](#data-integrity-rules)).
2. **Check `references/` for a matching app profile first** (see
   [Extending this skill](#extending-this-skill-for-a-specific-app-or-domain)).
   If one exists, use it and skip to step 4.
3. **Search.** `qlik_search(query=...)` across apps, datasets, data
   products, glossaries — confirm you've found the app the user means.
4. **Confirm.** `qlik_describe_app(appId)` for owner, publishing status,
   and fields before building on it.
5. **Survey what exists** before creating anything new:
   `qlik_list_dimensions`/`qlik_list_measures`, `qlik_list_sheets`
   (reuse via `qlik_get_chart_data` instead of rebuilding), and
   `qlik_get_data_product_documentation` if applicable.

## PART 1 — Must know

Every answer follows
[`references/output-style.md`](references/output-style.md) — BLUF, no
filler, no AI-tell phrasing.

### Quick-start workflow

1. Clarify the question (app/domain, time period, decision) — ask rather
   than guess when ambiguous; Qlik field names are often reused across
   apps with different meanings.
2. Run [App & data discovery](#app--data-discovery-do-this-first-every-time).
3. Prefer governed sources in order: **Master Item → Data Product doc →
   existing sheet/chart → ad hoc expression.** Only drop to ad hoc when
   nothing governed covers the question, and say so.
4. Verify before you filter — mandatory, see
   [Data integrity rules](#data-integrity-rules).
5. Execute: pull chart data, build a temporary data object, or apply
   selections.
6. Visualize as a chart once the result has shape — see
   [Visualizing results](#visualizing-results--offering-a-report). Offer
   (don't assume) a one-page report for multi-cut questions.
7. Report with provenance — see
   [Reporting with provenance](#reporting-with-provenance).

### Data integrity rules

- **Never re-aggregate returned data.** Qlik already performed the
  calculation; sums, averages, and totals it returns are final. For a
  different cut, call the tool again with a different expression — don't
  do arithmetic on the result yourself.
- **Verify values before selecting or filtering — mandatory, not a
  recovery step.** Selecting a value that doesn't exist fails silently:
  no error, the field just won't appear in the returned selection state.
  Confirm with `qlik_get_field_values` (low-cardinality) or
  `qlik_search_field_values` (high-cardinality) *before* you filter, not
  after a result looks wrong. Highest risk: a proper-noun value typed
  from memory rather than copied from a tool result — often stored as a
  shortened form or code, not its full display name.
- **A governed item isn't guaranteed correct.** A master measure — or its
  underlying data — can still have defects: a bad percentage, a negative
  duration, a total off by orders of magnitude. Sanity-check magnitude
  and sign before citing any number as fact — a governed source earns
  trust in the *definition*, not immunity from a plausibility check.
- **Selections persist across the whole session** until cleared,
  affecting every subsequent chart/data object/selection. For a one-off
  calculation, prefer set analysis (`Sum({<Year={"2025"}>} Sales)`) over
  an app-level selection — self-contained, no state left behind.
- **Prefer library IDs over raw fields** when a master dimension/measure
  exists — every chart using it stays in sync if the definition changes.
- **Confirm with user before any update or delete.** Ask before modifying
  or removing a master item, bookmark, or glossary term — an update to a
  master item affects every chart using it immediately. All three can
  only be updated/deleted via MCP tools if they were *created* via MCP
  tools — don't assume you can modify something that predates the session.
- **Distinguish observation from interpretation**: "revenue is down 8%"
  is an observation; "likely due to the pricing change" is an
  interpretation — flag it as one.

For quoting/whitespace/range traps behind the verify-before-filter rule,
see [`references/expression-gotchas.md`](references/expression-gotchas.md).

## PART 2 — How to do it

### Tool categories, then governance — check before you create

Tools group into: app/dataset discovery, ad hoc analysis & filtering,
master items, selections & bookmarks, sheets & charts, data products,
business glossary, lineage, and knowledge bases.
[`references/qlik-mcp-tool-reference.md`](references/qlik-mcp-tool-reference.md)
catalogues each with example prompts, but names/parameters can change —
confirm via tool-search or the Qlik Help MCP docs before relying on
either for anything critical. Set-analysis quoting rules:
[`references/expression-gotchas.md`](references/expression-gotchas.md)
(read before writing anything past an exact-match filter).

Creating a master item, sheet, data product, or glossary term produces a
persistent object others may rely on. Before creating anything:

- **List first** (`qlik_list_dimensions`, `qlik_list_measures`,
  `qlik_list_sheets`, `qlik_search_glossary_terms`) — confirm you're not
  duplicating something under a slightly different name.
- **Confirm intent.** Only create when the user explicitly asked for it —
  never as a side effect of answering an analysis question.
- **Respect lifecycle rules.** Updating/deleting a master item affects
  every chart using it immediately; glossary status (`draft → verified →
  deprecated`) is a human-in-the-loop gate — only a steward can verify a
  term or edit one already verified. Full detail in
  [`references/governance-workflows.md`](references/governance-workflows.md).

### Visualizing results & offering a report

Render results visually once the data has shape (trend, comparison,
distribution, ranking) — inline chart/artifact if supported, otherwise a
clearly formatted table. Match chart to task: trend → line, categories →
bar, ranking → sorted horizontal bar, part-to-whole → stacked bar (avoid
pie past ~5 slices), distribution → histogram, single number → KPI tile.
Reuse a candidate sheet flagged during discovery (`qlik_get_chart_data`)
instead of rendering fresh. Full chart-type table and hygiene rules:
[`references/visualization-guidelines.md`](references/visualization-guidelines.md).

Build a self-contained HTML report only when explicitly asked, or the
question has 3+ independently chartable cuts that don't fit a short
answer. **Offer, then wait** — ask before building; don't build as a
side effect, or inside the Qlik app itself (that's the
separately-confirmed `qlik_create_sheet` path above). Build pattern
(single file, no external calls, provenance per section): same reference
as above.

### Reporting with provenance

Close every substantive answer with a short provenance line:

> **Source:** [master item / data product / existing chart / ad hoc
> expression] · **Trust score:** [if checked] · **Freshness:** [last
> reload if known] · **App/owner:** [app name, owning space]

Follows the same
[`references/output-style.md`](references/output-style.md) standard as
the rest of the answer.

## Extending this skill for a specific app or domain

Improves once pointed at app/domain specifics — see
[`references/design-rationale.md`](references/design-rationale.md) for
when to split into a knowledge/workbook skill pair as profiles
accumulate. Copy
[`references/app-profile-TEMPLATE.md`](references/app-profile-TEMPLATE.md)
to `references/<app-or-domain-name>.md` and fill in the app ID, business
context, existing master items/data products, and field-naming gotchas —
`references/` is checked for a matching profile before falling back to
live discovery ([App & data discovery](#app--data-discovery-do-this-first-every-time)
step 2), so no changes to this file are needed.

## See also

[`qlik-mcp-tool-reference.md`](references/qlik-mcp-tool-reference.md) (tool catalogue) · [`expression-gotchas.md`](references/expression-gotchas.md) (syntax) · [`governance-workflows.md`](references/governance-workflows.md) (lifecycle) ·
[`visualization-guidelines.md`](references/visualization-guidelines.md) (chart/dashboard patterns) · [`output-style.md`](references/output-style.md) (tone) · [`design-rationale.md`](references/design-rationale.md) (structural reasoning).
