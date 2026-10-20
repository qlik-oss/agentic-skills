---
name: qlik-data-pipelines-project-validation
description: >-
  Validate an existing QTCP project against the plugin's mandatory
  rules (bindings sync, naming, minimal files, AI edit marker, etc.)
  and report any violations. Use for "validate my project", "check my
  project for errors", "is this project set up correctly". Local
  checklist only.
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

# Project Validation

On-demand audit of an existing project. Nothing else in this plugin triggers this automatically — it runs only when the user explicitly asks.

## Step 1 — Local validation (always)

Validate the project against every rule below and report the results: list the issues found, or confirm none.

**Critical Rules Checklist:**

1. **Unified creation workflow followed** — if the project was created through this plugin, its structure matches `project-management` + (`replication` or `data-pipeline`).
2. **Minimal files** — only required fields present; check against the schemas in `project-rules`' Schema Reference table.
3. **No automatic extras** — no files exist that weren't explicitly requested (e.g. `sourceSelection.yaml`, `schedule.yaml`, or `transformationRules.yaml` created without being asked for).
4. **No comments in generated files** — YAML/JSON files contain only data.
5. **AI edit marker (MUST)** — every created/edited YAML file (`qtcp_project.yaml`, `task.yaml`, `sourceSelection.yaml`, `transformationRules.yaml`, `schedule.yaml`, `model.yaml`, `newTaskDefaults.yaml`, dataset files, transformation data flow files) ends with a fresh `modifiedByAi` object (see `project-rules`).
6. **Dataset-level transformations** use separate dataset files, never `transformationRules.yaml` (see `transformations`).
7. **Binding synchronization (MUST)** — every `{{...}}` variable across all project files exists in `qtcp_bindings_definition.json` under `variables` (see `binding-synchronization`).
8. **Two-level bindings** — task-type-defaulted properties use a `task-type.*` reference, not a blank value, except `LAKEHOUSE_MIRROR` tasks; and every such reference has a matching `task-type.*` entry with a blank value (see `binding-synchronization`).
9. **Fixed-choice questions** use a clickable-option control where the client supports it (see `project-rules`).
10. **Variable values resolved correctly when reported** — any prior report of a property's value followed the `binding-resolution` procedure rather than reading raw placeholders or `qtcp_bindings_definition.json` directly.
11. **Presentation fallback rules applied** for `taskSchema`, `internalSchema`, `databaseName`, `warehouseName` when previously reported (see `binding-resolution`).

## Step 2 — Tool validation

🚫 **Currently disabled — do not perform this step.** This is a placeholder for future remote/schema-service validation via Qlik MCP, gated on Qlik MCP being available. Leave it out of the checklist output entirely rather than reporting it as skipped, until it's implemented.
