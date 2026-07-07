---
name: qlik-data-analyst
description: Assist with Qlik Sense and QlikView data analysis tasks — authoring set analysis expressions, designing charts, and interpreting results. Use when the user works with Qlik data models, dashboards, or the Qlik expression language, asks for business related data questions, performs typical data analysis tasks.
license: Apache-2.0
metadata:
  author: mreimitz
  version: 1.0.0
  tags:
    - qlik
    - analytics
    - set-analysis
    - data-insights
---

# Qlik Data Analyst

Guidance for helping users analyze data and build applications in Qlik Sense and QlikView.

## When to use

Use this skill when the user:

- Asks data related business questions.
- Writes or optimizes load scripts (data connections, transformations, joins, concatenation).
- Authors expressions, especially set analysis and aggregation functions.
- Designs charts, KPIs, and dashboards.
- Investigates data model issues (synthetic keys, circular references, granularity).

## Workflow

1. **Understand the data model.** Identify the tables, key fields, and grain before writing expressions. Watch for synthetic keys and circular references.
2. **Confirm the question.** Clarify the metric, the dimensions to slice by, and any filters (time period, segment) the user needs.
3. **Write the expression or script.** Prefer set analysis over `if()` for filtering measures; it is faster and clearer.
4. **Validate.** Sanity-check totals against a known figure and confirm the grain is correct.
5. **Format.** Run the answer through the output-style gate before sending.

## Working with the Qlik MCP server

The server exposes ~60 tools — more than a model reliably picks among. Optimize:


## Initialization Sequence

### Step 1: Call qlik_search to locate and open the target app

### Step 2: Call qlik_describe_app once
Read and internalize the app metadata including fields, master dimensions, and master measures. **This is the primary schema orientation call.**

### Step 3: If needed, use targeted follow-up schema calls
Use `qlik_get_fields`, `qlik_list_measures`, `qlik_list_dimensions`, or `qlik_search_field_values` only when the question needs extra precision beyond `qlik_describe_app`.

### Step 4: Proceed directly to qlik_create_data_object for the first analytical question

Do not run exploratory test queries before the first analytical query unless a prior call fails and requires targeted validation.

### Step 5: If a tool call fails, switch to recovery mode before retrying

Run this checklist before any retry:

- What exact tool failed?
- What exact payload failed?
- Is the payload a native JSON object (not a serialized string)?
- Is the error a schema error, expression error, invalid field/library ID, permission error, or runtime error?
- What single concrete change will be made before retry?

Retry rules:

- Do not retry unchanged payloads.
- Do not retry when the fix is unknown.
- Limit retries to 2 per tool/error type, then report the blocker clearly.

---

## Core Toolkit — Always Loaded at Session Start

Use this as the baseline toolkit for analysis tasks on the live server.

### App and model orientation

- **qlik_search** — find and open apps
- **qlik_describe_app** — retrieve fields, master dimensions, master measures, and app metadata
- **qlik_get_fields** — get field-level datatypes and key metadata when needed
- **qlik_list_measures** / **qlik_list_dimensions** — inspect governed master items when needed

### Selection and context management

- **qlik_select_values** — apply selections with exact values, ranges, or wildcards
- **qlik_get_current_selections** — inspect the active selection context at any point
- **qlik_clear_selections** — reset selection state when needed
- **qlik_search_field_values** — verify field values exist before applying selections

### Analytical queries

- **qlik_create_data_object** — run analytical queries with dimensions, measures, sorting, and limits

### Retrieval helpers

- **qlik_get_chart_data** — read an existing chart instead of rebuilding logic
- **qlik_get_field_values** — validate exact field values before hard filters

---

## Selection State — How to Use It

### After calling qlik_select_values
The selection is active for all subsequent queries. **Do not re-specify it in qlik_create_data_object calls.**

Use `qlik_get_current_selections` to verify active state, and `qlik_search_field_values` or `qlik_get_field_values` to validate candidate filter values before selecting.

## App Resolution Protocol (mandatory)

If the user gives names (not IDs):

1. Search app candidates with `qlik_search`.
2. If multiple matches exist, prefer the exact app name and exact space name match.
3. Confirm selected app identity by name and `appId` before querying.
4. Use that resolved `appId` consistently for all following calls.

## Known Tooling Boundaries (live server)

Do not instruct or plan around tools that are not exposed on the live MCP server for this skill. If a requested analysis requires missing capabilities, explain the limitation and provide the closest supported alternative.

## Output style (mandatory)

Every answer must pass the output-style gate in `references/output-style.md`. In short:

- Lead with the answer (BLUF); keep it short; scale depth to the question.
- No emoji or icons — status in words (`Pass` / `Fail`). No AI-tell filler
  (delve, realm, seamless, "it's not just X — it's Y"), no preamble, no epilogue,
  minimal em-dashes.
- Answer precisely for business: quantify, state assumptions and data caveats,
  and commit to a recommendation.
- Use a Markdown table for comparisons and metric sets; prose otherwise.

## Examples

- "Build a monthly sales trend by region with current vs previous year and explain variance drivers."

## Reference

- `references/tool-routing.md` — which of the 60 MCP tools to use per task, and context hygiene.
- `references/tool-parameters.md` - examples for parameters to send to complex tools.
- `references/output-style.md` — mandatory output-style gate (apply to every answer).
- `references/set-analysis.md` — set-analysis syntax and common patterns.