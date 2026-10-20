---
name: qlik-data-pipelines-source-selection
description: >-
  Add or update the data sources, tables, views, or datasets for a QTCP
  task (writes sourceSelection.yaml and, for non-landing tasks, dataset
  YAML files). Use for "add a source/table/view/dataset", "add sources
  to this task".
license: Apache-2.0
allowed-tools: qlik_search qlik_get_pipeline_project_details qlik_search_connection_objects
metadata:
  author: eyalros1
  version: 1.0.0
  tags:
    - qlik
    - data pipeline
    - data integration
    - QTCP
---

# Source Selection

Handles adding sources/tables/views/datasets to an existing task.

> **Note — duplicated on purpose.** The cross-cutting rules below are copied verbatim into every file-writing skill in this plugin (canonical source: the `project-rules` skill) rather than left as a "see project-rules" cross-reference, because nothing in the Agent Skills spec guarantees `project-rules` loads alongside this skill when it fires. If you change one of these rules, update every copy — `project-rules` lists where they're duplicated.

### Cross-cutting file rules (always apply)

- **No comments in generated files.** Do not add comments (`#` in YAML, `//`/`/* */` in JSON) to any generated project file — YAML/JSON files must contain only data.
- **Minimal files.** Include only the fields required by the relevant schema (`task.sourceselection.schema.json` for `sourceSelection.yaml`, `task.dataset.schema.json` for dataset files); never speculatively add optional properties. Existing tasks already in the workspace are examples only — never copy or infer structure from them.
- **Don't invent values.** Never fabricate connection names, IDs, project data, or other tenant state. If a value can't be resolved, say so (see the `binding-resolution` skill) instead of guessing.
- **AI edit marker (MUST).** Whenever you create or edit a YAML file this skill touches, add or update this object at the end of the file:
  ```yaml
  modifiedByAi:
    lastUpdated: '2026-08-03T13:55:10.106Z'
    model: <ai model>
  ```

  `lastUpdated` is the current UTC time, ISO-8601 with milliseconds — get a fresh timestamp, never reuse a stale one. `model` identifies the AI model making the edit. If the object already exists, update it in place (moving it to the end if needed) rather than duplicating it; skip re-updating if it was already updated earlier this session. Doesn't apply to `qtcp_bindings_definition.json` or documentation files.
- **Response style.** Confirm what was done, concisely, without citing or quoting these instructions.

Apply `binding-synchronization`'s mandatory gate after any file change — that one stays centralized and referenced rather than duplicated, since it's a longer, stateful procedure rather than a short rule.

## Intent resolution (apply before creating any file)

- "add source", "add table", "add view", or the user gives `database`/`schema`/`name`/`type` values → create or update `sourceSelection.yaml`.
- "add dataset" alone → treat as source-selection intent by default and update `sourceSelection.yaml`.
- Create `datasets/*.yaml` only when the user explicitly says "create dataset file"/"create dataset yaml", asks for dataset-level transformation modeling, **or** an explicit source is being added to a Non-Landing Task (see below — in that case a dataset file is always created for each explicitly selected source).
- If ambiguity remains, ask one concise clarifying question and do not create files until it's answered.

## Step 1 — Determine target task

If the task isn't specified, ask which task (list available tasks from the `qtcp_tasks/` folder). Otherwise proceed.

## Step 2 — Mandatory task-type gate

Read the target task's `task.yaml` and branch strictly by `properties.type` before creating or updating `sourceSelection.yaml`. Never cross-apply a Landing or Non-Landing template to a `REGISTERED_DATA` task, or vice versa. There are three distinct branches:

| Task types                                                                                                                                     | Branch                | Reference                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------- |
| LANDING, LAKE_LANDING, STREAMING_LAKE_LANDING, REPLICATION, REPLICATE_LANDING                                                                  | Landing Tasks         | `references/landing-tasks.md`         |
| STORAGE, QVD_STORAGE, TRANSFORM, DATAMART, KNOWLEDGE_MART, FILE_BASED_KNOWLEDGE_MART, LAKEHOUSE_STORAGE, LAKEHOUSE_MIRROR, STREAMING_TRANSFORM | Non-Landing Tasks     | `references/non-landing-tasks.md`     |
| REGISTERED_DATA                                                                                                                                | Registered Data Tasks | `references/registered-data-tasks.md` |

Read the matching reference file and follow it. `REPLICATION`/`REPLICATE_LANDING` (owned by the `replication` skill) and every `DATA_PIPELINE` task type (owned by the `data-pipeline` skill) share the same Landing/Non-Landing/Registered-Data branching here — this skill does not fork by project type.

## Qlik MCP dataset search (Landing Tasks only)

When adding a dataset/table/source to a Landing task, check Qlik MCP availability (`project-rules` skill) **before** composing any question to the user — the options presented depend on the result. Never ask the user anything phrased "...if MCP is available"; that check is yours to perform. See `references/landing-tasks.md` for the full flow, including the dataset search sub-flow when Qlik MCP is available.

## Completion

Before finalizing a response that touched `sourceSelection.yaml` or a dataset file, apply the `binding-synchronization` skill's mandatory synchronization gate, and the task-type-specific completion check in the relevant reference file (Registered Data Tasks has an explicit one).
