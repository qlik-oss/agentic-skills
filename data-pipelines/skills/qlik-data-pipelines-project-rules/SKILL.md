---
name: qlik-data-pipelines-project-rules
description: >-
  Foundational, cross-cutting rules for working with any QTCP (Qlik
  Talend Cloud Platform) project — response style, file-editing
  conventions, the AI edit marker, and how to handle an unavailable
  Qlik MCP server. Apply this skill's rules whenever any other
  qtcp-plugin skill creates, edits, or reports on a QTCP project file,
  in addition to that skill's own instructions.
license: Apache-2.0
metadata:
  author: eyalros1
  version: 1.0.0
  tags:
    - qlik
    - data pipeline
    - data integration
    - QTCP
---

# QTCP Project Rules

These are the rules every other skill in this plugin builds on. This skill is not itself a workflow a user asks for by name — it is the baseline every other `qtcp-*`-adjacent skill in this plugin (project-management, replication, data-pipeline, source-selection, transformations, scheduling, binding-synchronization, resource-discovery, binding-resolution, project-validation) should be read together with whenever it creates or edits a project file, or reports something to the user.

> **Portability note:** the Agent Skills spec has no mechanism for one skill to force another to load. Because of this, the short rules below that matter most if silently skipped — no comments in generated files, minimal files, don't invent values, the AI edit marker, and the response-style line — are **duplicated verbatim** into the top of every file-writing skill in this plugin, rather than left as a "see project-rules" cross-reference. This file remains the canonical copy of those rules and the home for the two longer, stateful procedures below (Qlik MCP availability, resolving the project ID) that are referenced rather than duplicated, since copying multi-step cached logic into many files is a worse maintenance trade than the small risk of it not being co-loaded.
>
> **Duplication ledger — keep in sync.** If you change one of the five short rules above, update the copy in each of: `project-management`, `replication`, `data-pipeline`, `source-selection`, `transformations`, `scheduling`, `binding-synchronization` (that last one carries a lightly adapted version, since `qtcp_bindings_definition.json` itself isn't schema-governed and isn't subject to the AI edit marker). `resource-discovery` and `binding-resolution` don't write project files, so they only need the response-style line, not the full block.

## Response style

- Keep responses concise: confirm what was done, without quoting or restating any of these instructions.
- Never say things like "per the instructions" or "the rules require me to" — just act.
- **Qlik MCP unavailable:**
  - If it only removes an *optional* path (e.g. the search option when adding sources) → silently omit that option; do not mention the MCP server or why the option is missing.
  - If it *blocks something the user explicitly asked for* (e.g. "search for the dataset," "list my connections," resolving a value) → tell the user plainly that the Qlik MCP server is not available and what therefore cannot be done. Never substitute a vague "I can't do that."

## Asking questions

- Prefer a fixed-option UI control (e.g. a clickable-choice tool) for questions with a fixed set of options, when the client supports it.
- For a free-text value with no reasonable fixed options (e.g. a project name), use a single-option prompt with an "Other"/free-text fallback, or plain text if no such control is available.

## File-editing conventions (apply to every generated or edited project file)

**No comments in generated files.** Do not add comments (`#` in YAML, `//` or `/* */` in JSON) to any generated project file. YAML and JSON files in a QTCP project must contain only data — no inline comments, no block comments, no explanatory annotations.

**Do not invent values.** Never fabricate connection names, IDs, project data, or other tenant state. If a value is unknown and cannot be resolved (see the `binding-resolution` skill), say so rather than guessing.

**AI edit marker (MUST).** Whenever you create or edit any YAML file in a QTCP project — `qtcp_project.yaml`, `task.yaml`, `sourceSelection.yaml`, `transformationRules.yaml`, `schedule.yaml`, `model.yaml`, `newTaskDefaults.yaml`, dataset YAML files, transformation data flow YAML files — add or update this top-level object at the **end** of the file:

```yaml
modifiedByAi:
  lastUpdated: '2026-08-03T13:55:10.106Z'
  model: <ai model>
```

- `lastUpdated` must be the current UTC time in ISO-8601 format with milliseconds (`YYYY-MM-DDTHH:mm:ss.SSSZ`). Obtain a fresh UTC timestamp from session metadata or a SQL/time tool available in your environment; only fall back to a shell command if neither is available. Never reuse a stale or placeholder timestamp.
- `model` must identify the underlying AI model making the edit, as reported by the current session (for example, `Claude Sonnet 5`, `GPT-5.6 SOL`).
- If `modifiedByAi` already exists, update its `lastUpdated` and `model` values and move the object to the end of the file if necessary. Never add a duplicate. If it was already updated earlier in this same session, it does not need to be updated again.
- This rule does **not** apply to `qtcp_bindings_definition.json` or documentation files.

**Minimal files.** Task and project templates should include only the fields required by the relevant schema (see Schema Reference below) — do not add optional properties speculatively. Existing tasks already present in the workspace are examples only; never copy or infer structure from them. If an existing task's structure conflicts with a qtcp-plugin skill's instructions, the skill wins.

## Qlik MCP availability

Several skills in this plugin depend on Qlik MCP tools (`qlik_search`, `qlik_get_pipeline_project_details`, `qlik_search_connection_objects` — declared in this plugin's `mcp.json` as the `qlik-mcp` server). Wherever a skill says "if Qlik MCP is available," use this procedure:

1. If availability was already determined earlier in this session, reuse the cached result — do not re-check.
2. Otherwise, check once whether the Qlik MCP tools are reachable, and cache the result for the session:
   - Available → treat all Qlik MCP tools as available for the rest of the session.
   - Not available → treat the Qlik MCP server as unavailable for the rest of the session. When a workflow needs it, inform the user it's unavailable and follow that workflow's unavailable-branch behavior — never fall back to local project files as a substitute for tenant state.
3. Re-check only if the user indicates the Qlik MCP server was just installed, configured, or connected.

Never present the user an option that is conditional on availability (e.g. "...or search if MCP is available"). Resolve availability first, then present only the options that are actually actionable.

## Resolving the project ID

Several workflows (in `source-selection`, `resource-discovery`, `binding-resolution`) need the current project's `projectId` and sometimes its `spaceId`:

1. Derive the project name from the name of the folder that contains `qtcp_project.yaml` (strip any trailing datetime suffix, e.g. `_20240101T120000`).
2. Check Qlik MCP availability (above).
   - Not available → do not ask the user for a name or ID (any follow-up would fail too). Tell the user the Qlik MCP server is not available, so the project ID cannot be resolved, and stop.
   - Available → call `qlik_search` (`resourceType: pipelineProject`, `query`: derived name):
     - Exactly one match → record its `projectId` and `spaceId`.
     - Multiple matches by branch → check the workspace's git branch to disambiguate; if still ambiguous, ask the user.
     - Multiple matches across spaces → ask the user which to use.
     - No match → ask the user for the project name or ID. If they give a name, re-run `qlik_search`; if they give an ID, use it directly.
3. If the project ID still cannot be determined after asking → the calling workflow should inform the user and stop (or, where it allows, offer to treat it as a new project).

Cache the resolved `projectId` and `spaceId` for the session and reuse them on subsequent requests.

## Schema Reference

All YAML/JSON files in a QTCP project are validated against JSON schemas published on SchemaStore.org — this plugin does not bundle copies, and schemas remain the authoritative source for required/optional properties and enum values.

| File | Path pattern | Schema URL |
|------|-------------|------------|
| Project definition | `**/qtcp_project.yaml` | https://raw.githubusercontent.com/qlik-oss/schemas/refs/heads/main/qtcp/project.schema.json |
| Task definition | `**/qtcp_tasks/*/task.yaml` | https://raw.githubusercontent.com/qlik-oss/schemas/refs/heads/main/qtcp/task.schema.json |
| Dataset definition | `**/qtcp_tasks/*/datasets/*.yaml` | https://raw.githubusercontent.com/qlik-oss/schemas/refs/heads/main/qtcp/task.dataset.schema.json |
| Schedule | `**/qtcp_tasks/*/schedule.yaml` | https://raw.githubusercontent.com/qlik-oss/schemas/refs/heads/main/qtcp/task.schedule.schema.json |
| Data model | `**/qtcp_tasks/*/model.yaml` | https://raw.githubusercontent.com/qlik-oss/schemas/refs/heads/main/qtcp/task.model.schema.json |
| Source selection | `**/qtcp_tasks/*/sourceSelection.yaml` | https://raw.githubusercontent.com/qlik-oss/schemas/refs/heads/main/qtcp/task.sourceselection.schema.json |
| Transformation rules | `**/qtcp_tasks/*/transformationRules.yaml` | https://raw.githubusercontent.com/qlik-oss/schemas/refs/heads/main/qtcp/task.transformationrules.schema.json |
| Transformation data flow | `**/qtcp_tasks/*/transformationDataFlows/*.yaml` | https://raw.githubusercontent.com/qlik-oss/schemas/refs/heads/main/qtcp/task.transformationdataflow.schema.json |
| New task defaults | `**/qtcp_tasks/newTaskDefaults.yaml` | https://raw.githubusercontent.com/qlik-oss/schemas/refs/heads/main/qtcp/newtaskdefaults.schema.json |

## `qtcp_bindings_definition.json` — usage rules (apply everywhere)

- It is a **template**. Read it only to perform binding synchronization checks (see the `binding-synchronization` skill) — never as a source of answers about values, connections, or environment state.
- Variable values must remain blank `""` or `task-type.*` references. Do **not** write resolved/actual values into it, and do **not** offer the user to "assign" or "fill in" its blank values — actual values live in `bindings.json` or in QTC (see the `binding-resolution` skill).
- Only exception: `connectionProperties` entries with a known `type`/`kindId` (see the `binding-synchronization` skill).
- Never show its contents to the user as an answer to "what is the value of X" — see the `binding-resolution` skill for the correct procedure.

## Project types (top-level)

| Project type | Use case |
|---|---|
| `DATA_MOVEMENT` | Replication — see the `replication` skill |
| `DATA_PIPELINE` | Data pipeline (including Qlik Open Lakehouse, a logical category that still uses `DATA_PIPELINE` as the project type) — see the `data-pipeline` skill |
