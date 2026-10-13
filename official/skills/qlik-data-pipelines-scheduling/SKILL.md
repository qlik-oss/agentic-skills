---
name: qlik-data-pipelines-scheduling
description: >-
  Create or modify a schedule.yaml for a QTCP task (time-based or
  event-based), including the per-task-type eligibility rules. Use for
  "add a schedule", "run this task daily/hourly", "trigger this task
  when another completes", "change/enable/disable this schedule".
  Shared by both replication and data-pipeline task types.
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

# Scheduling

Centralized scheduling capability shared by all task domains — not duplicated inside `replication` or `data-pipeline`; they reference this skill's eligibility checks.

> **Note — duplicated on purpose.** The cross-cutting rules below are copied verbatim into every file-writing skill in this plugin (canonical source: the `project-rules` skill) rather than left as a "see project-rules" cross-reference, because nothing in the Agent Skills spec guarantees `project-rules` loads alongside this skill when it fires. If you change one of these rules, update every copy — `project-rules` lists where they're duplicated.

### Cross-cutting file rules (always apply)

- **No comments in generated files.** Do not add comments (`#` in YAML, `//`/`/* */` in JSON) to any generated project file — YAML/JSON files must contain only data.
- **Minimal files.** Include only the fields required by the relevant schema (`task.schedule.schema.json` for `schedule.yaml`); never speculatively add optional properties. Existing tasks already in the workspace are examples only — never copy or infer structure from them.
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

**Only one schedule allowed per task** — if `schedule.yaml` already exists, inform the user rather than creating a second one. Always set `enabled: true` when creating a new `schedule.yaml`. Task directory names are customizable — task type is defined in `task.yaml`, not the folder name.

## Eligibility by task type

| Task Type | Allowed Scheduling |
|---|---|
| STORAGE | `TIME_BASED` always allowed; `EVENT_BASED` conditionally — see STORAGE check below |
| LANDING, LAKE_LANDING *(DATA_PIPELINE)* | `TIME_BASED` allowed only if `fullLoadOnly: true`; otherwise no scheduling. No `EVENT_BASED` — see LANDING check below |
| REPLICATION | `TIME_BASED` allowed unless `applyChanges: true`; if `applyChanges: true` → no scheduling. No `EVENT_BASED` — see REPLICATION check below |
| LAKE_LANDING *(DATA_MOVEMENT)* | Same rule as LANDING/LAKE_LANDING above, keyed on `fullLoadOnly` — see the `replication` skill |
| QVD_STORAGE, STREAMING_LAKE_LANDING, REGISTERED_DATA, REPLICATE_LANDING | No scheduling — do not create `schedule.yaml` |
| TRANSFORM, DATAMART, KNOWLEDGE_MART, FILE_BASED_KNOWLEDGE_MART, LAKEHOUSE_MIRROR, STREAMING_TRANSFORM, LAKEHOUSE_STORAGE | `TIME_BASED` or `EVENT_BASED` — ask the user which |

### STORAGE event-based eligibility check

Before offering `EVENT_BASED` to a STORAGE task, check whether its source landing task is full-load-only:
1. Read the current task's `sourceSelection.yaml`, find the `sourceTask` value.
2. Find the task whose `id` matches that value.
3. In that task's `task.yaml`, look under `settings` for `fullLoadOnly`.
4. `fullLoadOnly: true` → both `TIME_BASED` and `EVENT_BASED` are allowed.
5. Absent or `false` → only `TIME_BASED` is allowed.

### LANDING / LAKE_LANDING time-based eligibility check

Read the task's `task.yaml`, look under `settings` for `fullLoadOnly`:
- `true` → `TIME_BASED` allowed (no `EVENT_BASED`).
- Absent or `false` → no scheduling; do not create `schedule.yaml`.

### REPLICATION time-based eligibility check

Read the task's `task.yaml`, look under `settings.taskSettings` for `applyChanges`:
- Absent or `false` → `TIME_BASED` allowed (no `EVENT_BASED`).
- `true` → no scheduling; do not create `schedule.yaml`.

## Schedule Creation Workflow

> **Never suggest enabling scheduling by changing task properties.** When scheduling isn't allowed because of a property's presence/absence (e.g. `applyChanges: true`, or `fullLoadOnly` not set), simply inform the user — never propose changing those properties to make scheduling possible.

**Step 1:** Check the task type against the eligibility table.
- Not allowed → inform the user, don't create `schedule.yaml`.
- STORAGE → run the STORAGE check to determine whether `EVENT_BASED` is also available.
- LANDING/LAKE_LANDING → run that check; if ineligible, inform the user and stop.
- REPLICATION → run that check; if ineligible, inform the user and stop.
- Only `TIME_BASED` allowed → go directly to Step 2a.
- Both allowed → ask: "Should this task run on a time-based schedule or be triggered by another task completing (event-based)?"

**Step 2a: Time-based**
- Ask for free text, e.g. "Describe the schedule in plain language (frequency, interval, and start time)."
- Parse and convert to RRULE with only `FREQ` and `INTERVAL`.
- If required details are missing, ask concise follow-ups.
- Write `timeBasedScheduling.schedule`, `timeBasedScheduling.startDateTime` (UTC), `timeBasedScheduling.timezone: Etc/UTC`.
- Do not mention RRULE conversion to the user.

**Step 2b: Event-based**
- Ask: "Should this task be triggered when any of its input tasks complete, or only when specific tasks complete?" — `ANY_INPUT_TASK` (no `triggerApps` needed) or `ANY_SELECTED_TASK`.
- If `ANY_SELECTED_TASK`: read the current task's `sourceSelection.yaml`, collect distinct source task names referenced via `sourceTask` (in `explicitlySelected` or `includePatterns`), deduplicating.
  - Exactly one → suggest it: "The only source task is `<task>` — shall I use it?"
  - Multiple → ask which should trigger the schedule, listing them.
  - Populate `triggerApps` with the selected task(s).

## Schedule Modification Workflow

When the user asks to change an existing `schedule.yaml` (timing, scheduling type, trigger tasks):
- After applying the change, check `enabled` on the modified scheduling entry.
  - Missing or `false` → inform and ask: "The schedule is currently disabled. Would you like me to enable it as well?" Yes → set `enabled: true`. No → leave as-is (keep `false` if present, don't add it if absent).

## Templates

**Time-based:**
```yaml
scheduling:
  - schedulingType: TIME_BASED
    enabled: true
    timeBasedScheduling:
      schedule:
        - 'RRULE:FREQ=DAILY;INTERVAL=1'
      startDateTime: '2026-03-18T15:30:44.746Z'
      timezone: 'Etc/UTC'
```

**Event-based, ANY_INPUT_TASK:**
```yaml
scheduling:
  - schedulingType: EVENT_BASED
    enabled: true
    eventBasedScheduling:
      eventSchedulingType: ANY_INPUT_TASK
```

**Event-based, ANY_SELECTED_TASK:**
```yaml
scheduling:
  - schedulingType: EVENT_BASED
    enabled: true
    eventBasedScheduling:
      eventSchedulingType: ANY_SELECTED_TASK
      triggerApps:
        - projectId: '{{ref(project.current.projectId)}}'
          dataAppId: <source-task-id>
```

RRULE format: `RRULE:FREQ=<DAILY|HOURLY|WEEKLY|MONTHLY>;INTERVAL=<N>` — only `FREQ` and `INTERVAL` are used.

## Other properties in `task.schedule.schema.json`

Confirmed by reading the full raw schema directly. These exist structurally but aren't covered by the workflow above — don't guess their semantics or when to use them; ask the user or say the behavior isn't documented here if it matters to their request.

- **`schedulingType: DATA_EVENTS_BASED`** — a third scheduling type alongside `TIME_BASED` and `EVENT_BASED` (the schema's `schedulingType` enum is `NONE`, `TIME_BASED`, `EVENT_BASED`, `DATA_EVENTS_BASED`). This skill does not document its shape, its eligibility by task type, or when a user should choose it over `EVENT_BASED`. If a user asks for data-event-based scheduling, say this isn't yet covered here rather than improvising a structure.
- **`schedulingType: NONE`** — also a valid enum value (and the schema's own default); presumably represents "no active schedule" without deleting the `scheduling` array entry. Not used by any workflow above; don't reach for it without the user asking specifically.
- **`runOnReconnect`** (sibling of `schedulingType`, string enum `ONSCHEDULED` \| `IMMEDIATE`, default `IMMEDIATE`) — "Behavior when reconnecting." Optional; per the minimal-file rule, omit it unless the user explicitly asks to change reconnect behavior.
- **`timeBasedScheduling.endDateTime`** — optional, same ISO-8601 shape as `startDateTime`. Add it only when the user specifies an end date/time for the schedule; otherwise omit.
- **`timeBasedScheduling.fullloadInterval`** — optional integer, default `0`. The schema's own description is just "Full load interval" — its exact effect isn't specified there. If a user asks for it explicitly, pass through the value they give rather than inferring one.
- **`description`, `version`** (both strings, siblings of `schedulingType`) — optional metadata on a scheduling entry. Skip by default per the minimal-file rule; only add if the user asks for a description or version tag.

> Open question, needs a decision rather than a schema fact: the schema's own example RRULE is `RRULE:FREQ=HOURLY;INTERVAL=6;BYMINUTE=16;BYSECOND=0` — i.e. it uses `BYMINUTE`/`BYSECOND` too, and the `schedule` property is just `"one or more RFC-5545 RRULE strings or schedule expressions"` with no structural restriction to `FREQ`/`INTERVAL` only. The `FREQ`/`INTERVAL`-only rule above came from the original instructions, not from this schema — it may reflect a real QTC product/UI limitation, or it may be an oversimplification. Flagging rather than changing it, since this needs a product-knowledge call, not a schema read.
