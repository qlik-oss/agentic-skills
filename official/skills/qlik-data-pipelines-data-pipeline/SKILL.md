---
name: qlik-data-pipelines-data-pipeline
description: >-
  Domain knowledge for QTCP Data Pipeline projects (DATA_PIPELINE),
  including Qlik Open Lakehouse — platform type selection, landing
  target, and every DATA_PIPELINE task type (LANDING, STORAGE,
  REGISTERED_DATA, TRANSFORM, LAKEHOUSE_STORAGE, LAKEHOUSE_MIRROR,
  STREAMING_LAKE_LANDING, STREAMING_TRANSFORM, QVD_STORAGE). Use for
  "build a data pipeline", "ingest into Snowflake/Databricks/lakehouse",
  "create a LANDING/STORAGE/TRANSFORM task". Invoked by
  project-management when the project's use case is a data pipeline.
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

# Data Pipeline (DATA_PIPELINE)

Dedicated domain knowledge for `DATA_PIPELINE` projects — the larger and more complex of the two project-type domains, symmetric to the `replication` skill for `DATA_MOVEMENT`. Detailed per-task-type minimal settings, templates, and the LAKEHOUSE_MIRROR platform sub-branches live in `references/task-templates.md` — read that file once you know the task type.

> **Note — duplicated on purpose.** The cross-cutting rules below are copied verbatim into every file-writing skill in this plugin (canonical source: the `project-rules` skill) rather than left as a "see project-rules" cross-reference, because nothing in the Agent Skills spec guarantees `project-rules` loads alongside this skill when it fires. If you change one of these rules, update every copy — `project-rules` lists where they're duplicated.

### Cross-cutting file rules (always apply)

- **No comments in generated files.** Do not add comments (`#` in YAML, `//`/`/* */` in JSON) to any generated project file — YAML/JSON files must contain only data.
- **Minimal files.** Include only the fields required by the relevant schema (`project.schema.json` for `qtcp_project.yaml`, `task.schema.json` for `task.yaml`); never speculatively add optional properties. Existing tasks already in the workspace are examples only — never copy or infer structure from them.
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

> This is likely to be the largest and fastest-growing skill in the plugin. Don't pre-split it; if a sub-area (e.g. QLIK_OPEN_LAKEHOUSE-specific task types) grows large enough to be independently reasoned about, consider extracting it into its own skill then — not now.

## Determining `platformType`

- If the project includes (or the user is simultaneously requesting) a `LAKE_LANDING` task → automatically set `platformType` to `SNOWFLAKE`. Do not ask the user.
- Otherwise → ask "Which `platformType` should I use?" and present the options using their `enumDescriptions` as display labels (from `properties.platformType.enumDescriptions` in `project.schema.json` — see the `project-rules` skill's Schema Reference). When the user selects one, write the corresponding `enum` value (not the display label) into the YAML.
- Do **not** ask for `platformType` as unrestricted free text when schema values are known.

### `QLIK_OPEN_LAKEHOUSE`: lakehouse cloud provider

When `platformType` is `QLIK_OPEN_LAKEHOUSE`, automatically add `lakehouseCloudProvider: AWS` under `properties` in `qtcp_project.yaml`. Do not ask the user. (Future: when GCP is supported, ask instead, with options `AWS`/`GCP`, and write the selected literal value.)

### `SNOWFLAKE`: landing target

When `platformType` is `SNOWFLAKE`:
- If the project includes (or the user is simultaneously requesting) a `LAKE_LANDING` task → automatically treat the landing target as "files in cloud storage." Do not ask.
- Otherwise → ask "What is the landing target?": `tables in Snowflake` (data lands as tables directly in Snowflake) or `files in cloud storage` (data lands as files in cloud storage).

If the landing target is **files in cloud storage** (chosen or inferred):
- Add `snowflakeStorageIntegration: '{{snowflakeStorageIntegration}}'` under `properties` in `qtcp_project.yaml`.
- Ensure `snowflakeStorageIntegration` is added to `qtcp_bindings_definition.json` under `variables`.

If the landing target is **tables in Snowflake**: no additional properties needed.

Regardless of landing target, when first creating the project: do **not** create `sourceSelection.yaml` unless the user has specified data sources; do **not** create `schedule.yaml`, `transformationRules.yaml`, or sample datasets automatically.

## Minimal `qtcp_project.yaml`

```yaml
properties:
  exportVersion: '1.0'
  name: '{{projectName}}'
  space: 'ref{project.current.spaceId}'
  type: DATA_PIPELINE
  platformType: <PLATFORM_TYPE>
  platformConnection: '{{platformConnection}}'
  cloudStagingConnection: '{{cloudStagingConnection}}'
settings:
  artifactsNaming:
    prefixSchema: '{{project.current.prefixSchema}}'
```

## Task Type Availability by Project Type / Platform Type

| Platform Type | Allowed Task Types |
|---|---|
| SYNAPSE, FABRIC, MSSQL, REDSHIFT, BIGQUERY, DATABRICKS, SNOWFLAKE (landing → tables in Snowflake) | LANDING, STORAGE, REGISTERED_DATA, TRANSFORM |
| SNOWFLAKE (landing → files in cloud storage) | LAKE_LANDING, STORAGE, REGISTERED_DATA, TRANSFORM |
| QLIK_OPEN_LAKEHOUSE | LAKE_LANDING, LAKEHOUSE_STORAGE, STREAMING_LAKE_LANDING, STREAMING_TRANSFORM, LAKEHOUSE_MIRROR, REPLICATE_LANDING |
| QVD | LANDING, QVD_STORAGE |

Never include `DATAMART`, `KNOWLEDGE_MART`, or `FILE_BASED_KNOWLEDGE_MART` in a presented task-type list — if the user requests any of these, redirect them to create it in the QTC UI and commit back. Data flow (Pattern 3) datasets get the same redirect — see the `transformations` skill.

**Source-matches-platform rule:** when the user wants to ingest data whose source is the same platform as the project's `platformType` (e.g. reading from Snowflake in a SNOWFLAKE project), use a `REGISTERED_DATA` task instead of a `LANDING` task — `LANDING` is for external/heterogeneous sources only.

## Creating a task: required settings and follow-up questions

Read `references/task-templates.md` for the full minimal-settings table (per task type) and YAML templates, including:
- The `LAKEHOUSE_MIRROR` platform question and its three platform sub-branches (`SNOWFLAKE`/`REDSHIFT`/`DATABRICKS`), each with different settings blocks.
- The `REGISTERED_DATA` update-method question (compare-with-storage vs. incremental) and its follow-up incremental-settings question.
- The two-level-binding markers per property, and the `LAKEHOUSE_MIRROR` no-two-level-binding exception (both detailed in the `binding-synchronization` skill).

**DATA_PIPELINE binding name guardrail (MUST):** for task schema properties, always use the canonical `taskSchema` suffix: `{{task.<task-id>.taskSchema}}`. Never use synonym variable names such as `landingSchema`, `targetSchema`, `artifactSchema`, or `internalTaskSchema` for these fields, in any DATA_PIPELINE task.

## Scheduling, source selection, and transformations

These stay in their own shared skills and are not duplicated here — reference them, don't reimplement them:
- `scheduling` skill for eligibility per task type (STORAGE/LANDING/TRANSFORM etc. each differ) and the creation/modification workflows.
- `source-selection` skill for adding sources to LANDING/LAKE_LANDING (Landing-task branch) vs. STORAGE/TRANSFORM/etc. (Non-Landing branch) vs. REGISTERED_DATA (its own branch).
- `transformations` skill for TRANSFORM task dataset files and table/dataset-level transformation rules.
