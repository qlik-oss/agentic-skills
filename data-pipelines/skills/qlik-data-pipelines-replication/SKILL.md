---
name: qlik-data-pipelines-replication
description: >-
  Domain knowledge for QTCP Replication projects (DATA_MOVEMENT) — the
  minimal project template, the REPLICATION and LAKE_LANDING task
  types, their defaults, and their scheduling eligibility. Use for
  "replicate this database", "set up a replication/CDC task",
  "point-to-point replication". Invoked by project-management when the
  project's use case is replication.
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

# Replication (DATA_MOVEMENT)

Dedicated domain knowledge for `DATA_MOVEMENT` projects. This is the smaller and simpler of the two project-type domains — it has exactly two task types — so project and task creation stay in this one skill rather than being split further. > **Note — duplicated on purpose.** The cross-cutting rules below are copied verbatim into every file-writing skill in this plugin (canonical source: the `project-rules` skill) rather than left as a "see project-rules" cross-reference, because nothing in the Agent Skills spec guarantees `project-rules` loads alongside this skill when it fires. If you change one of these rules, update every copy — `project-rules` lists where they're duplicated.

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

## Key characteristics

- Task types: `REPLICATION`, `LAKE_LANDING`.
- Scheduling is limited to `TIME_BASED`, and only when eligible (see below). `EVENT_BASED` is never available for these task types. Detailed scheduling mechanics live in the `scheduling` skill — this section only states replication's eligibility facts.
- No `settings.artifactsNaming` in `qtcp_project.yaml` (unlike `DATA_PIPELINE`).
- No `platformType` question — replication projects skip that entirely.

## Minimal `qtcp_project.yaml`

```yaml
properties:
  exportVersion: '1.0'
  name: '{{projectName}}'
  space: 'ref{project.current.spaceId}'
  type: DATA_MOVEMENT
```

## Task types

### `REPLICATION`

Required `settings` fields: `taskSettings.fullLoad`, `taskSettings.applyChanges`, `targetEndpoint.targetConnection`, `targetEndpoint.targetSchema`, `targetEndpoint.targetStorageConnection`.

- Always set both `fullLoad: true` and `applyChanges: true` under `settings.taskSettings` by default.
- Only deviate from this default if the user explicitly specifies different modes; valid modes are `fullLoad`, `applyChanges`, `storeChanges`.
- Write these mode flags only under `settings.taskSettings` — never directly under `settings`.
- Only write the selected mode flag(s) as `true`; do **not** add unselected mode flags with `false`.

**Scheduling eligibility:** `TIME_BASED` is allowed unless `settings.taskSettings.applyChanges` is `true`. If `applyChanges: true` → no scheduling; do not create `schedule.yaml`. `EVENT_BASED` is never available. See the `scheduling` skill for the full workflow.

### `LAKE_LANDING` (under `DATA_MOVEMENT`)

Required `settings` field: `targetEndpoint.targetConnection`.

- Always include `settings.targetEndpoint.targetConnection` for `LAKE_LANDING` tasks in a `DATA_MOVEMENT` project.
- This is a **different** minimal shape than `LAKE_LANDING` under `DATA_PIPELINE` — do not reuse the `data-pipeline` skill's `LAKE_LANDING` template here, and do not add `targetEndpoint.targetConnection` to a `DATA_PIPELINE` `LAKE_LANDING` task.

**Scheduling eligibility:** `TIME_BASED` is allowed only if the task has `settings.fullLoadOnly: true`; otherwise no scheduling — do not create `schedule.yaml`. `EVENT_BASED` is never available. See the `scheduling` skill for the full workflow.

## Source selection and transformations

`REPLICATION` and `LAKE_LANDING` (under `DATA_MOVEMENT`) are both **Landing-style** tasks: they read directly from a data source connection, not from an upstream task. Use the `source-selection` skill's Landing Tasks branch unchanged — no replication-specific fork is needed there. Neither task type uses the `transformations` skill.

## Binding notes specific to replication

`LAKEHOUSE_MIRROR` (a `data-pipeline` task type) has a documented exception to two-level binding, but that exception does not apply here — `REPLICATION` and `LAKE_LANDING` under `DATA_MOVEMENT` follow the normal binding-synchronization rules with no special-casing.

**Task-type key segment (for two-level `task-type.*` binding keys, see `binding-synchronization`):** `REPLICATION` → `replication`. (`LAKE_LANDING` shares the single `lakeLanding` key segment used across both project types — see `data-pipeline`'s task-type mapping table.) Neither task type's currently-required settings fields fall on the two-level-defaulted property list, so this key segment isn't exercised by the minimal templates above — it's here for completeness and for any future property that does need it.
