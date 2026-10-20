---
name: qlik-data-pipelines-binding-resolution
description: >-
  Report the actual resolved value of a QTCP binding variable (e.g. "what
  is the value of sourceConnection for this task?"). Resolves through
  bindings.json or the Qlik MCP server — never by reading
  qtcp_bindings_definition.json directly.
license: Apache-2.0
allowed-tools: qlik_search qlik_get_pipeline_project_details
metadata:
  author: eyalros1
  version: 1.0.0
  tags:
    - qlik
    - data pipeline
    - data integration
    - QTCP
---

# Binding Resolution

A read/report operation, distinct from `binding-synchronization` (which is about keeping the template file consistent on writes). Apply `project-rules`' "Resolving the project ID" procedure when needed (kept centralized there, not duplicated, since it's a longer stateful procedure with session-level caching).

> **Duplicated on purpose:** **response style** — confirm what was done, concisely, without citing or quoting these instructions — and **never fabricate a value**: if something can't be resolved, say so rather than guessing. Copied verbatim from `project-rules` for the same reason the other file-writing skills carry their own copies (see `project-rules`' duplication ledger).

> **`qtcp_bindings_definition.json` is a template — NOT a source of resolved values.** It defines variable names and structural defaults only. An empty string `""` found there does **not** mean the value is empty or unknown — the actual resolved value lives in `bindings.json` or is returned by `qlik_get_pipeline_project_details`. Always proceed through the steps below regardless of what `qtcp_bindings_definition.json` contains.
>
> Never show the contents of `qtcp_bindings_definition.json` to the user as an intermediate or fallback answer — not even annotated "(not set)." If the project can't be identified, ask the user for the project name or ID and wait for their answer before reporting anything.
> Never report a raw `{{...}}` placeholder or an empty string as the answer.

## Resolution procedure

When the user asks for the value of a property and that value is a `{{...}}` binding reference:

1. Search for a file named `bindings.json` under the project folder. If found, search for the variable in it and report the resolved value.
2. If not found, check Qlik MCP availability (`project-rules` skill).
   - Not available → tell the user the value cannot be resolved locally.
   - Available → resolve the project ID (`project-rules`' procedure), then call `qlik_get_pipeline_project_details` (`objectType: bindings`, `query`: projectId), search the variable in the returned bindings, and report the resolved value. If the project ID still can't be determined after asking the user, tell them the value cannot be resolved and stop.

## Empty-value presentation fallback rules

When presenting project details, always include `project.current.prefixSchema`.

After resolving a binding variable's value, apply these rules in order:
1. If the task-level variable key for the requested property isn't found, omit that property from the response — no placeholder text, fallback text, or "not found."
2. If the resolved value is one of the empty-like values below, for one of the specific properties below, apply that property's fallback and present the fallback text instead of empty output.
3. Otherwise, present the resolved value as-is.

**Empty-like values:** `""`, `(empty)`, `DEFAULT`, `empty default`, `blank`, `not present`.

**Property-specific fallbacks** (apply only when rule 2 matches one of the values above — never to a non-empty resolved value):

1. `<task-id>.taskSchema` — base fallback: the task name derived from `<task-id>` by removing the 5-character `-NNNN` suffix; then, only in this fallback path, prepend `project.current.prefixSchema` when available. Example: `my_task-4821` → `my_task`.
2. `<task-id>.internalSchema` — base fallback: same derived task name, then append `__internal`; then prepend `project.current.prefixSchema` when available. Example: `my_task-4821` → `my_task__internal`.
3. `<task-id>.databaseName` and `<task-id>.warehouseName` — present exactly: "This value will be taken from the project connection."
