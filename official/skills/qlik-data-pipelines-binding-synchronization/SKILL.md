---
name: qlik-data-pipelines-binding-synchronization
description: >-
  Keep qtcp_bindings_definition.json in sync with every {{...}} binding
  variable used across a QTCP project's YAML/JSON files — variable
  naming conventions, two-level bindings, property aliases, and the
  mandatory synchronization gate. Apply this after creating or editing
  any QTCP project file, from any other skill in this plugin.
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

# Binding Synchronization

Cross-file consistency between project YAML/JSON and `qtcp_bindings_definition.json`. Single source of truth for binding rules — other skills (`project-management`, `replication`, `data-pipeline`, `source-selection`, `transformations`) should say "apply binding-synchronization" rather than repeating these rules, and this skill should be consulted after any of them touches a project file.

> **Note — duplicated on purpose.** The cross-cutting rules below are copied verbatim into every file-writing skill in this plugin (canonical source: the `project-rules` skill) rather than left as a "see project-rules" cross-reference, because nothing in the Agent Skills spec guarantees `project-rules` loads alongside this skill when it fires. If you change one of these rules, update every copy — `project-rules` lists where they're duplicated.

### Cross-cutting file rules (always apply)

- **No comments in generated files.** Do not add comments (`#` in YAML, `//`/`/* */` in JSON) to any generated project file — YAML/JSON files must contain only data.
- **Minimal files.** Include only the fields required by the relevant schema for whichever file you're editing — see `project-rules`' full Schema Reference table; `qtcp_bindings_definition.json` itself has no published SchemaStore schema. Never speculatively add optional properties.
- **Don't invent values.** Never fabricate connection names, IDs, project data, or other tenant state. If a value can't be resolved, say so (see the `binding-resolution` skill) instead of guessing.
- **AI edit marker (MUST).** This rule does **not** apply to `qtcp_bindings_definition.json` itself, but does apply to every other YAML file you touch while performing a synchronization pass — add or update this object at the end of the file:
  ```yaml
  modifiedByAi:
    lastUpdated: '2026-08-03T13:55:10.106Z'
    model: <ai model>
  ```
  `lastUpdated` is the current UTC time, ISO-8601 with milliseconds — get a fresh timestamp, never reuse a stale one. `model` identifies the AI model making the edit. If the object already exists, update it in place (moving it to the end if needed) rather than duplicating it; skip re-updating if it was already updated earlier this session.
- **Response style.** Confirm what was done, concisely, without citing or quoting these instructions.

## Variable naming conventions

- `task.<task-id>.<property>` — task-specific properties (e.g. `task.landing_cdc-0001.sourceConnection`).
- `task.<task-id>:<database>$_$<schema>.<property>` — schema-specific properties, where `<database>` is the database name or `null` if unspecified (e.g. `task.landing_cdc-0001:null$_$dbo.schema`).
- `task-type.<type>.<property>` — default values for task types (e.g. `task-type.landing.databaseName`).
- `project.current.<property>` — project-level references (e.g. `project.current.projectId`).

## Task-type-defaulted properties (two-level binding)

These properties use a two-level binding when added to a task: `warehouseName`, `databaseName`, `databricksVectorSearchEndpoint`, `indexDatabase`, `vectorDbTargetType`, `vectorDbConnection`, `llmConnection`, `databaseSelectionMethod`, `warehouseSelectionMethod`, `indexDatabaseSelectionMethod`, `lakehouseCluster`, `folder`.

For these, instead of a blank value in `qtcp_bindings_definition.json`, set the task-level variable's value to a `task-type` reference, and also add the corresponding `task-type` variable with a blank value.

**Exception — `LAKEHOUSE_MIRROR` tasks:** two-level binding does **not** apply. Even for properties in the list above, always add a blank value directly (no `task-type` reference).

**Task type name mapping** (for the `task-type` key segment): see `data-pipeline`'s `references/task-templates.md` for DATA_PIPELINE task types, and the `replication` skill for `REPLICATION`/`LAKE_LANDING` under DATA_MOVEMENT.

**Example** — `LANDING` task with id `landing-1234`, property `databaseName`:
```json
{
  "task.landing-1234.databaseName": "{{task-type.landing.databaseName}}",
  "task-type.landing.databaseName": ""
}
```
If `task-type.landing.databaseName` already exists in `variables` (from a previous task of the same type), do not duplicate it — leave the existing entry as-is.

**Ordering:** all `task-type.*` variables must appear at the top of the `variables` object, before any `task.*` or other variables. When adding a new `task-type.*` variable, insert it at the top. When adding a `task.*` variable whose value references a `task-type.*` variable, place it after all `task-type.*` entries.

## Property name aliases

Some properties bind to a variable whose name differs from the property name; the task-id prefix follows the normal pattern, but the trailing property name is remapped.

| Property name (in task.yaml) | Variable name suffix to use |
|---|---|
| `snowflakeCatalogIntegration` | `snowflakeOpenCatalog` |

**Example** — task id `mi1-5284`, property `snowflakeCatalogIntegration`:
```yaml
snowflakeCatalogIntegration: '{{task.mi1-5284.snowflakeOpenCatalog}}'
```
and `task.mi1-5284.snowflakeOpenCatalog` added to `qtcp_bindings_definition.json` with a blank value.

## Mandatory Binding variable rules (MUST)

- Whenever a `{{...}}` binding variable is used in any project file, add it to `qtcp_bindings_definition.json` `variables` with a blank value (`""`) — except task-type-defaulted properties, which follow the two-level binding rule instead.
- If the variable refers to a **connection property** (name ends with `Connection`, e.g. `sourceConnection`, `targetConnection`, `targetStorageConnection`), add it to `connectionProperties` **only if** the `type` or `kindId` are known — never guess or add an empty entry.
- **Mandatory synchronization gate (MUST):** before finalizing any response, extract every `{{...}}` variable from all changed project files and ensure each exists in `qtcp_bindings_definition.json` under `variables`.
- **Two-level binding completeness check (MUST):** for every `task.*` variable whose value is a `task-type.*` reference, verify the corresponding `task-type.*` variable also exists with a blank value `""`. If missing, add it at the top of `variables`.
- **Completion criteria:** do not state task completion until both checks above have been performed and verified.

## `DATA_PIPELINE` binding name guardrail (MUST)

For task schema properties in a `DATA_PIPELINE` project, always use the canonical `taskSchema` suffix: `{{task.<task-id>.taskSchema}}`. Never use synonym variable names such as `landingSchema`, `targetSchema`, `artifactSchema`, or `internalTaskSchema`.

## Example `qtcp_bindings_definition.json`

```json
{
  "variables": {
    "platformConnection": "",
    "cloudStagingConnection": "",
    "projectName": "",
    "task-type.landing.databaseName": "",
    "task.landing_cdc-0001.sourceConnection": "",
    "task.landing_cdc-0001.databaseName": "{{task-type.landing.databaseName}}",
    "task.landing_cdc-0001:null$_$dbo.schema": ""
  },
  "connectionProperties": {
    "task.landing_cdc-0001.sourceConnection": {
      "type": "repsrc_mssql"
    }
  }
}
```

See the `project-rules` skill for the general usage rules governing `qtcp_bindings_definition.json` (it's a template, never a source of resolved values — see `binding-resolution` for how to actually resolve a value).
