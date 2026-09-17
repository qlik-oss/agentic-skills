---
name: qlik-automation-builder
description: >
  Build automations for Qlik Automate. Translate natural-language requests into automation workspace JSON and, when requested, create, update, or delete automations using the automation management tools exposed through qlik-mcp.
license: Apache-2.0
allowed-tools: qlik_skill_view qlik_search qlik_create_automation qlik_update_automation qlik_delete_automation qlik_get_automation_by_id qlik_list_automation_connectors qlik_get_automation_connector qlik_list_automation_connections bash
metadata:
  author: yeshQ
  version: 0.2.0
  tags:
  - qlik
  - analytics
  - workflow-automation
---

# Create Automation Skill

Build automation `workspace` JSON, then create, update, or delete automations via qlik-mcp tools.

## Scope

When the platform the automation needs to reach has no dedicated connector, or the resolved connector does not expose the needed block, do **not** stop — fall back to the generic connectors or the built-in `CallUrlBlock` as long as the platform has an HTTP API. See `references/generic-connectors.md`. Stop and tell the user the skill cannot help only when even that fallback cannot express the request (no HTTP API, or an auth flow the generic connectors do not support).

Three run modes are supported — `manual`, `triggered` and `scheduled`. Pick the one the request implies, then follow [Run modes](#run-modes).

## Workflow

### 1. Discover connectors and pick blocks via qlik-mcp tools

1. Resolve connectors via the MCP tool `qlik_list_automation_connectors`. It returns the live tenant connector list, each entry carrying `id`, `name`, `description` and other connector related information. Reference the returned `id` as `datasourcetype_guid` on connector blocks. ex: Filter syntax: `filter='name eq "Qlik Cloud Services"'`.
   - If the `qlik-mcp` is not connected, stop and ask the user to connect it. Do not guess or hardcode connector guids.
2. Fetch full connector detail with `qlik_get_automation_connector(connector_id=<connector-guid>)`. It returns endpoints and snippets in **two separate top-level arrays** — the array an entry came from is what decides the block type:
   - `blocks[]` → build an `EndpointBlock`; the entry's `id` is its `endpoint_guid`.
   - `snippets[]` → build a `SnippetBlock`; the entry's `id` is its `snippet_guid`.

   Both arrays carry the same fields — `id`, `name`, `description`, `role`, `objectType`, `exampleOutput`, and `inputs[]` (per-input `id`, `name`, `fieldType`, `optional`, `description`, `options`; `blocks[]` inputs also carry `exampleValue`, snippet inputs do not). Pick a candidate by searching both arrays by `name` and `role`, then read that entry's `inputs`. On import the editor rebuilds each input list from connector metadata and pairs values by `id`, so emit every `id` exactly as returned — one missing or misspelled lands as an empty input.
3. For external connector blocks (any block that carries a `datasource` setting — QCS-native blocks don't), resolve the connection: call `qlik_list_automation_connections` with `filter='connectorId eq "<connector-guid>"'`, once per distinct connector. Exactly one match → bind its `id` as the block's `datasource` value; warn when it reports `isConnected: false` (runs will fail at the service until the user reconnects it). Several matches → ask the user which to bind. None → leave `value: null` and record in `Assumptions` that the user must create and bind a connection before execution. For cloud-storage file blocks there is no `datasourcetype_guid` — their `datasourcetype` is an adapter name — so first get the connector guid with `qlik_list_automation_connectors` using `filter='name eq "<adapter name>"'` (the adapter name is the connector's catalog name), then resolve the connection as above. The create/update API stores `datasource` verbatim — a null is never auto-bound on import, so an unbound block stays unbound.
4. If no connector or block fits, don't stop — see `references/generic-connectors.md`.

### 2. Build workspace JSON

1. Decide the run mode from how the automation is meant to start, and read what it obliges you to emit — see [Run modes](#run-modes).
2. **Read `references/construction-rules.md` before drafting.** It holds the rules the artifact must satisfy — workspace shape and settings, variables, value-reference syntax, which blocks are iterable, edge topology, and the `fieldType` → input `type` mapping. Most of them are not expressible in JSON Schema, so validation will not catch a violation.
3. Pick block types and confirm their shapes via `$defs`. Each block type's entry opens with what it is for and when to reach for it — read a candidate's description before picking it (that selection guide covers every supported type), then confirm required top-level fields, `inputs[*]` shape constraints, and any conditional rules. To find an entry, look up the type in `$defs.Block` in `assets/schemas/workspace-schema.json`: every type is listed there as a `$ref` pointing at its definition, either in the same file or in a `blocks/` category file — e.g. `{"$ref": "blocks/basic.json#/$defs/IfElseBlock"}` means read `assets/schemas/blocks/basic.json`. Open only the files the draft needs.
   - Prefer a `SnippetBlock` over a hand-built equivalent when the connector's `snippets[]` ships one, and do not inline-expand a snippet into its constituent blocks unless the user explicitly asks. Check `snippets[]` before assembling something out of `blocks[]` entries — a snippet and an endpoint can share a name, and only the array tells them apart.
   - Add a `FormBlock` only when the flow genuinely needs runtime user input — an interactive caller supplying parameters, not a value you could resolve while drafting.
   - Decide from the connector-detail `role` whether a chosen block owns an internal loop, and wire accordingly.
4. Draft `workspace` JSON, obeying `references/construction-rules.md` and [JSON output rules](#json-output-rules). Fill only `value` fields, names, comments, and edges.
5. Validate the draft — see [Validation](#validation).
6. Return the result — see [Return format](#return-format).

If the request is underspecified, ask only for blocking business values (app ids, recipient ids, message text). Do not ask questions the connector detail can answer. If you don't understand how blocks should be wired, ask rather than assume.

### 3. Create, update, or delete automations via qlik-mcp tools

- `qlik_create_automation` to create a new automation (pass `workspace` with the built JSON, plus — for a scheduled one — the `schedules` payload described in `references/run-mode-scheduled.md`, in the same call).
- `qlik_get_automation_by_id` to inspect an automation's configuration.
- `qlik_update_automation` to change name, description, workspace, schedules, or concurrency.
- `qlik_delete_automation` to delete an automation.

Lifecycle guidance:

1. Resolve required ids first (automation id, connector, connection, space).
2. Validate request completeness before calling write operations.
3. For mutating operations (`create`, `update`, `delete`), echo key identifiers and resulting status.
4. Do not fabricate ids. Ask for missing ids only when they cannot be discovered from prior results.
5. After a successful `qlik_create_automation` (or `qlik_update_automation`), call `qlik_search` with `resourceType="automation"` and the automation's name as the query, match the result whose `id` equals the returned automation id, and share that result's `open` URL so the user can open the automation in the editor. Never hand-build or guess the URL — if no result matches, say the link could not be resolved and report the automation id instead.

## Run modes

`StartBlock.inputs[0]` is always `run_mode`, and its value decides what else the StartBlock carries and whether the create/update call needs a `schedules` payload. This section decides **which** mode; the mode's own file carries what that mode requires.

| mode | starts when | then read |
|---|---|---|
| `manual` | someone presses Run in the editor or the hub | nothing — `run_mode` is the StartBlock's only input |
| `triggered` | an outside caller starts it — an Answers assistant action, `qlik_start_automation_run`, a sheet button, the run URL | `references/run-mode-triggered.md` |
| `scheduled` | a recurrence stored on the automation fires | `references/run-mode-scheduled.md` |

Read the mode out of the request rather than asking: "every morning at 6" is `scheduled`, "so an agent / Answers / a sheet button can run it" is `triggered`, and a flow a person kicks off by hand is `manual`. Ask only when the request genuinely fits two modes (e.g. "run it after the nightly reload" — a schedule timed after the reload, or a triggered automation the reload flow calls).

Read only the file for the mode you picked — it lists that mode's StartBlock inputs and carries the timeouts or schedule grammar it needs, plus its extra `Preflight` items.

### The trigger payload is the StartBlock's output

For `triggered` the StartBlock produces output: the payload the caller sent. Downstream blocks read it like any other block — `{$.<startBlockName>.<field>}`. A StartBlock named `Start` receiving `{"appId": "..."}` is referenced as `{$.Start.appId}`.

A `manual` StartBlock produces **nothing**. The same workspace that returns the payload under `run_mode: "triggered"` resolves `{$.Start.appId}` to `null` under `run_mode: "manual"` — so if the flow consumes values from whoever started it, the mode is `triggered` (or the values come from a `FormBlock`, for interactive prompts). Never wire a payload reference off a `manual` StartBlock.

`test_payload` is a **JSON string**, not a JSON object — `"value": "{\"appId\":\"abc\"}"`. Editor and test runs substitute it for the real payload, so give it the shape the real trigger delivers. Live runs ignore it.

## JSON output rules

These rules govern the workspace JSON emitted in the response. Violating any of them produces malformed or unimportable output.

- The workspace is **one** JSON object with exactly one top-level `blocks` array and one top-level `variables` array, emitted as **exactly one** fenced ` ```json ` block per response — never split across code blocks or followed by a second object (`{...}{...}`). If the user asks to extend an automation, regenerate the whole workspace from scratch.
- Plain JSON only: no trailing commas, no `//` or `/* */` comments, no unquoted keys, no `undefined` / `NaN` / `Infinity`, ASCII double quotes only (no smart quotes `“ ” ‘ ’`), no em-dashes inside JSON strings unless the user asked for them in literal text.
- No placeholder strings in the final output. Replace every `BLOCK-ID`, `LABEL-BLOCK-ID`, `LOOP-BLOCK-ID`, `VARIABLE-GUID`, `<endpoint-guid>`, `OPERATION-KEY`, `VALUE-HERE`, etc. with real connector-detail guids or freshly generated uppercase UUIDv4s. If a value is genuinely unknown (e.g. connection id), use `null`, not a placeholder string.
- Do **not** copy block snippets from `$defs` examples or from prior chat output verbatim — those examples contain sentinel ids. Construct each block fresh, using connector-detail ids and your own UUIDs.

## Validation

Validate every draft with [ajv-cli](https://github.com/ajv-validator/ajv-cli) before returning it as final. No project-level install is needed — invoke through `npx`:

```bash
npx -y -p ajv-cli@5 -p ajv-formats@3 ajv validate \
  -s assets/schemas/workspace-schema.json \
  -r 'assets/schemas/blocks/*.json' \
  -d path/to/workspace.json \
  --spec=draft2020 --strict=false -c ajv-formats
```

- The schema is JSON Schema **Draft 2020-12** (hence `--spec=draft2020 --strict=false`) and split across a core file plus four category files under `assets/schemas/blocks/`, which must be loaded with `-r`.
- Success output is `path/to/workspace.json valid`. Anything else (including `invalid` plus an error list) means fix the draft and re-validate before responding.
- Omitting `-r` is not a lenient run — `ajv` reports `schema assets/schemas/workspace-schema.json is invalid / error: can't resolve reference blocks/basic.json#/$defs/IfElseBlock` instead of a verdict. That means the command was wrong, not the draft.
- Validate several drafts in one call with multiple `-d` flags or a glob (`-d 'examples/*.workspace.json'`); only `-d` varies.
- If `npx` cannot reach the registry, install once (`npm i -g ajv-cli@5 ajv-formats@3`) and run `ajv validate` with the same flags, `-r` included.

The validator reports schema violations only. The rules in `references/construction-rules.md` — parent uniqueness, `item` references, iterability, connector-detail guids and input completeness — are not expressible in JSON Schema and must still be checked in `Preflight`.

## Return format

**For workspace building:**

1. Final `workspace` JSON in one fenced ` ```json ` block.
2. `Preflight` confirming each of:
   - ajv returns `valid` for the command in [Validation](#validation), `-r` included
   - the sole `StartBlock` has `inputs[0].id: "run_mode"`, `inputs[0].type: "select"`, and an `inputs[0].value` matching the mode the request implies
   - for `manual`: the StartBlock carries nothing beyond `run_mode`, and no `{$.<startBlockName>...}` reference appears anywhere in the workspace. For every other mode: the `Preflight additions` listed in that mode's `references/run-mode-<mode>.md`
   - every `test_payload` value is a JSON **string**, not a JSON object
   - every `EndpointBlock` / `SnippetBlock` `inputs[*].id` matches an `inputs[*].id` for that block in the `qlik_get_automation_connector` response, with none left out — including optional inputs, which carry `value: null`
   - every `datasourcetype_guid` is the `id` of a connector returned by `qlik_list_automation_connectors` in this session (e.g. `61a87510-c7a3-11ea-95da-0fb0c241e75c` for Qlik Cloud Services), and matches the connector whose block detail supplied that block's `endpoint_guid` / `snippet_guid`
   - every external connector block's `datasource` value is a connection `id` returned by `qlik_list_automation_connections` this session, or `null` with a matching `Assumptions` entry
   - every `IfElseBlock` uses `type: "custom"` with `value.mode` and at least one `value.conditions` entry; every `CaseBlock` keeps `statementChildrenIds` aligned with `inputs['statements'].value`; every `GotoBlock` points to a real `LabelBlock.id` with matching `displayValue`
   - every `VariableBlock` is named after its variable, its `variableGuid` matches a real `variables[*].guid`, and every operation `id` is one its variable's `type` allows
   - every `loopBlockId` sits on an iterable block, and each such `EndpointBlock` carries a matching `endpoint_role`
   - every reference made from inside a loop to the list-producing block that owns that loop goes through `item` (`{$.blockName.item...}`), not the bare list — and the field after `item` is one the user named or the element demonstrably exposes, not an assumed `id`
   - no block has multiple parents
   - no `inputs[*].value` holds a literal credential (API key, password, token, secret, signed URL) — authenticated calls go through a connection-bound connector block, and any `CallUrlBlock` with `headers` or `params` sets `automations_censor_data: true`
3. Short `Assumptions` section listing unresolved connections or guesses.

`Preflight` and `Assumptions` are plain Markdown **after** the JSON code block — never embed them as extra keys (e.g. `"_preflight"`) on the workspace object. If schema validation fails, or any `Preflight` item cannot be truthfully confirmed, **do not emit the JSON block** — report the failure or ask a clarifying question instead.

**For automation lifecycle operations:**

1. `Action` summary: tool called, why, and what changed.
2. `Inputs` used: ids, filters, or payload fields sent to the tool.
3. `Result`: automation id, status, and key returned fields from the tool response — including the returned `runMode` and, for a scheduled automation, the stored `recurrence` and `nextRunAt` (both can differ from what was sent: the service normalizes the rule, and `runMode` is recomputed). For a create or update, include the editor link resolved via `qlik_search` (lifecycle guidance step 5).
4. `Next steps` only when additional input or actions are required — binding a connection before execution, or copying the run URL for a triggered automation.
