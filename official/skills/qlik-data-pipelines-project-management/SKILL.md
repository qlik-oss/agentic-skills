---
name: qlik-data-pipelines-project-management
description: >-
  Create a new QTCP project (asks for a name and use case, then
  scaffolds the project folder) or add a new task to an existing
  project. Use for "create a new project/pipeline/replication project",
  "start a new QTCP project", "add a task to this project". Routes the
  domain-specific parts of the work to the replication or data-pipeline
  skill.
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

# Project Management (front door)

This skill is the single entry point for "create a new project" and "add a task to an existing project." It only owns what's genuinely shared regardless of project type. Everything platform/task-type-specific is owned by the `replication` skill (for `DATA_MOVEMENT`) or the `data-pipeline` skill (for `DATA_PIPELINE`) — this skill routes to them and does not duplicate their content.

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

After creating or editing any file below, also apply the `binding-synchronization` skill's mandatory synchronization gate — that one stays centralized and referenced rather than duplicated, since it's a longer, stateful procedure rather than a short rule.

> **Delegation mechanism note:** the steps below say things like "apply the replication skill's task templates." If your client does not support one skill's instructions causing another named skill to load, read that skill's SKILL.md directly (skills in this plugin are plain files under `skills/<name>/SKILL.md`) before continuing.

## When the user asks to create a new project

**Step 1 — Project name.** Ask: "What would you like to name this project?" Once provided, create a root folder with that name; all project files go inside it.

**Step 2 — Use case.** Ask: "What is the use case for this project?" with exactly these two options:
1. Replication — point-to-point replication task
2. Data pipeline — data pipeline centered around a single platform

**Step 3 — Project type from use case.**
- Replication → project type `DATA_MOVEMENT` → hand off to the **`replication` skill** for everything else in project and task creation (its minimal `qtcp_project.yaml`, task types, and task templates), then return here for Steps 5 and 7 (shared scaffolding, task ID).
- Data pipeline → project type `DATA_PIPELINE` → hand off to the **`data-pipeline` skill** for everything else (platform type, landing target, its minimal `qtcp_project.yaml`, task types, and task templates), then return here for Steps 5 and 7.

**Step 4 — Create the project.**
- Create root folder `<ProjectName>/`.
- Create `<ProjectName>/qtcp_project.yaml` using the template the `replication` or `data-pipeline` skill provides for the resolved project type.
- Create `<ProjectName>/qtcp_bindings_definition.json` — apply the binding-synchronization skill's mandatory binding variable rules to the project YAML just created: extract every `{{...}}` variable and add it to `variables` with a blank value `""`.
- Create empty subfolder `<ProjectName>/qtcp_tasks`.

**Step 5 — Offer to create a task.** Ask: "Would you like me to create a task now?" If yes, ask for task type, presenting only the options allowed for this project's type and platform type (from the `replication` or `data-pipeline` skill's task-type-availability table). Never include `DATAMART`, `KNOWLEDGE_MART`, or `FILE_BASED_KNOWLEDGE_MART` in the presented list — if the user asks for any of these, redirect them to create it in the QTC UI and commit back.

**Source-matches-platform rule:** when the user wants to ingest data whose source is the *same platform* as the project's `platformType` (e.g. reading from Snowflake in a SNOWFLAKE project), use a `REGISTERED_DATA` task instead of a `LANDING` task — `LANDING` is for external/heterogeneous sources only. (This only applies to `DATA_PIPELINE` projects; see the `data-pipeline` skill.)

**Step 6 — Task name and creation.** Ask: "What would you like to name this task?" Create `<ProjectName>/qtcp_tasks/<TaskName>/`, then create a minimal `task.yaml` using the template the `replication` or `data-pipeline` skill provides for the chosen task type, with required fields only.

**Task ID generation rule (applies to every task type, in either domain):**
- Format: `<sanitized-task-name>-<NNNN>` where `NNNN` is exactly 4 digits.
- Preferred default: 4 random digits (e.g. `4821`).
- Alternative, only when explicitly requested: 4-digit sequential numbering (`0001`, `0002`, ...).

**Step 7 — Offer follow-up configuration.** After creation, ask: "Would you like me to: add data sources to this task? (→ `source-selection` skill) / add transformation rules to this task? (→ `transformations` skill) / add a schedule to this task?" — only offer scheduling if the task type supports it per the `scheduling` skill's eligibility table.

## When the user asks to add a single task (project already exists)

Skip Steps 1–2. Read the existing `qtcp_project.yaml` to determine the project type and (for `DATA_PIPELINE`) `platformType`, then continue from Step 5.
