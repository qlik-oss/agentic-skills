---
name: qlik-data-analyst
description: Assist with Qlik Sense and QlikView data analysis tasks — authoring set analysis expressions, designing charts, and interpreting results. Use when the user works with Qlik data models, dashboards, or the Qlik expression language, asks for business related data questions, performs typical data analysis tasks.
license: Apache-2.0
metadata:
  author: mreimitz
  version: 1.1.0
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

The server exposes ~60 tools — more than a model reliably picks among. Follow the initialization sequence and core toolkit below to avoid wrong-tool selection and keep context manageable.

## Initialization Sequence (MANDATORY - Do Not Skip)

### Step 1: Call qlik_search to locate and open the target app

### Step 2: ALWAYS call qlik_describe_app FIRST - NO EXCEPTIONS

**This is mandatory.** Read and internalize the app metadata including fields, master dimensions, and master measures before making ANY data queries. This call returns:

- All available fields with their exact names
- Master dimensions with their libraryId values
- Master measures with their libraryId values
- Data model structure

**CRITICAL: Never guess field names.** The exact field names vary by app:
- Common time fields: `src_year`, `Year`, `=Year([field])`, `year`, `pickup_year`
- Common location fields: `PULocationID.borough`, `Borough`, `PUBorough`, `zone`
- ALWAYS use the exact names returned by `qlik_describe_app`

**Field Name Validation Rule**: If a `qlik_create_data_object` call fails with "Invalid fields" error, do NOT retry with guessed variations. Instead:
1. Re-check the exact field names from your `qlik_describe_app` result
2. Look for master dimensions that cover the concept you need
3. If the field truly does not exist, report it to the user

### Step 3: If needed, use targeted follow-up schema calls
Use `qlik_get_fields`, `qlik_list_measures`, `qlik_list_dimensions`, or `qlik_search_field_values` only when the question needs extra precision beyond `qlik_describe_app`.

### Step 4: Execute queries SEQUENTIALLY (not in parallel)

**NO PARALLEL QUERIES to Qlik servers.** Execute `qlik_create_data_object` calls one at a time. Parallel queries often trigger 30-second timeouts and overwhelm the server.

Good pattern:
```
1. qlik_describe_app
2. qlik_create_data_object (year trends) - wait for response
3. qlik_create_data_object (location breakdown) - wait for response
```

Bad pattern (DO NOT DO THIS):
```
1. qlik_describe_app
2. Launch 4-6 qlik_create_data_object calls simultaneously
```

### Step 5: Timeout and error handling

**30-second timeout rule**: If a query times out (30s), do NOT retry the exact same query. Instead:

1. **First timeout**: Simplify the query
   - Reduce number of dimensions (try 1-2 instead of 3-4)
   - Reduce number of measures (try 2-3 instead of 5-6)
   - Add a row limit if none exists
   - Avoid datetime fields as direct dimensions; use derived fields like `src_year` or calculated dimensions

2. **Second timeout**: Stop and report
   - After 2 timeouts on similar queries, report the issue to the user
   - Do not continue trying variations
   - Suggest the server may need optimization or the data volume is too large

**Recovery checklist before retry**:

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

**Master Item Priority Rule**: When building queries, ALWAYS prefer master items (using `libraryId`) over raw field references or ad-hoc expressions when available. Master items are:
- Pre-tested and governed
- Faster to execute (pre-calculated in some cases)
- Consistent across all uses
- Less prone to errors

Example - PREFER THIS:
```json
{
  "measures": [
    {"label": "Trips", "libraryId": "167d7096-8647-4e46-8bbb-a79c0fae5b13"},
    {"label": "TotalAmount", "libraryId": "f56fe084-34f8-48e6-be79-aa2190a9232c"}
  ]
}
```

Example - AVOID WHEN MASTER EXISTS:
```json
{
  "measures": [
    {"expression": "Count(1)", "label": "Trips"},
    {"expression": "Sum(total_amount)", "label": "Revenue"}
  ]
}
```

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

## Performance Optimization

### Target metrics for efficient runs:
- **Tool calls**: Aim for 8-16 calls per analysis (not 30+)
- **Turns**: Target 5-8 turns for complex questions (not 15-20)
- **Context tokens**: Keep peak context under 40K tokens when possible
- **Cost**: Typical analysis should cost $0.30-$0.50, not $0.80+

### How to achieve this:
1. **Call qlik_describe_app once** at the start, then reference that data throughout
2. **Use master items** (libraryId) instead of creating ad-hoc expressions
3. **Execute sequentially** - no parallel queries
4. **Batch related metrics** in single queries when possible (multiple measures, one call)
5. **Avoid field name guessing** - each failed validation adds cost and latency

### Circuit breaker pattern:
If you encounter 2+ consecutive timeouts or 3+ field validation errors:
1. Stop the current approach
2. Review the qlik_describe_app output again
3. Simplify the query significantly
4. If still failing, report the issue rather than continuing to retry

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