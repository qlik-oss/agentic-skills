---
name: qlik-data-pipelines-resource-discovery
description: >-
  List what exists in the Qlik tenant — connections, spaces, projects,
  or datasets on a connection — via Qlik MCP. Use for "what
  connections/spaces/projects/datasets are available", "list my QTCP
  projects", "show my source/target connections". Read-only tenant
  browsing; does not add anything to a task (see source-selection for
  that).
license: Apache-2.0
allowed-tools: qlik_search
metadata:
  author: eyalros1
  version: 1.0.0
  tags:
    - qlik
    - data pipeline
    - data integration
    - QTCP
---

# Resource Discovery

Read-only tenant browsing. Apply `project-rules`' Qlik MCP availability procedure (kept centralized there, not duplicated, since it's a longer stateful check with session-level caching).

> **Duplicated on purpose:** **response style** — confirm what was done, concisely, without citing or quoting these instructions — and **never fabricate a value**: if something can't be resolved, say so rather than guessing. Copied verbatim from `project-rules` for the same reason the other file-writing skills carry their own copies (see `project-rules`' duplication ledger).

**Never answer from local project files** (`qtcp_bindings_definition.json`, `bindings.json`, `qtcp_project.yaml`, task folders, etc.) — these describe *this project's* configuration and variable names, not the catalog of what exists in the tenant.

## Procedure

1. Check Qlik MCP availability (`project-rules` skill).
   - Not available → tell the user the Qlik MCP server is not available so the resources cannot be listed, and stop. Do not fall back to local project files.
   - Available → query per resource type below.

2. **Spaces** → `qlik_search` (`resourceType: space`); show only spaces whose `type` is `data`.

3. **Projects** → `qlik_search` (`resourceType: pipelineProject`).

4. **Connections** → first determine the connection-type qualifier from the user's request:
   - "source connections" → type = `Source` — skip the connection-type question below.
   - "target connections" → type = `Target` — skip it.
   - "all connections" (explicit "all," no source/target qualifier) → type = `Both` (unfiltered) — skip it.
   - Otherwise (bare "show/list connections") → ask: "Would you like to filter by connection type?" with options **Source**, **Target**, **Both**.

   Then ask the space scope: "Which connections should I show?"
   1. **All connections** → `qlik_search` (`resourceType: dataConnection`) with no space filter — do not resolve or pass a `spaceId`.
   2. **Connections in the current project's space** → resolve the project's `spaceId` via `project-rules`' "Resolving the project ID" procedure, then filter by that `spaceId`.
   3. **A specific space (user types the name)** → find its `spaceId` via `qlik_search` (`resourceType: space`, query: typed name; show only `type: data` spaces), then filter by it.

   Apply the resolved connection type to the results:
   - `Source` → keep only results whose `dataConnection.dataSourceId` starts with `repsrc_` or `external`.
   - `Target` → keep only results whose `dataConnection.dataSourceId` starts with `reptgt_`.
   - `Both` (or explicit "all connections") → no filtering.

5. **Datasets on a connection** → follow the "Dataset search flow" in `source-selection`'s `references/landing-tasks.md`.

## Presentation rules

- Show **names only** — never IDs or internal properties.
- Pass filter text as tool parameters; do not fetch full lists and filter locally.
- If the user then wants a listed resource actually used by a task or project, hand off to the `source-selection` skill (or `project-management` for a project) — never write resolved values into `qtcp_bindings_definition.json` yourself (see `binding-synchronization`).
