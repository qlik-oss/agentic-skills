---
name: qlik-automation-builder
description: >
  Build automations for Qlik Automate. Translate natural-language requests into automation workspace JSON and, when requested, create, update, or delete automations using the automation management tools exposed through qlik-mcp.
license: Apache-2.0
allowed-tools: qlik_skill_view qlik_search qlik_create_automation qlik_update_automation qlik_delete_automation qlik_get_automation_by_id qlik_list_automation_connectors qlik_get_automation_connector qlik_list_automation_connections bash
metadata: 
  author: yeshQ
  version: 0.1.0
  tags:
  - qlik
  - analytics
  - workflow-automation
---

# Create Automation Skill

Build automation `workspace` JSON, then create, update, or delete automations via qlik-mcp tools.

## Scope

When the platform the automation needs to reach has no dedicated connector, or the resolved connector does not expose the needed block, do **not** stop — fall back to the generic connectors or the built-in `CallUrlBlock` as long as the platform has an HTTP API. See [No dedicated block: generic connectors and raw API](#no-dedicated-block-generic-connectors-and-raw-api). Stop and tell the user the skill cannot help only when even that fallback cannot express the request (no HTTP API, or an auth flow the generic connectors do not support).

Never draft scheduled, triggered, or webhook automations. StartBlock must always use run_mode: "manual".

## Workflow

### 1. Discover connectors and pick blocks via qlik-mcp tools

1. Resolve connectors via the MCP tool `qlik_list_automation_connectors`. It returns the live tenant connector list, each entry carrying `id`, `name`, `description` and other connector related information. Reference the returned `id` as `datasourcetype_guid` on connector blocks. ex: Filter syntax: `filter='name eq "Qlik Cloud Services"'`.
   - If the `qlik-mcp` is not connected, stop and ask the user to connect it. Do not guess or hardcode connector guids.
2. Fetch full connector detail (blocks, parameters, snippet templates) with `qlik_get_automation_connector(connector_id=<connector-guid>)`. Each entry in `blocks` carries `id` (used as `endpoint_guid` / `snippet_guid`), `name`, `description`, `snippet` (`true` = `SnippetBlock`, `false` = `EndpointBlock`), `role`, `objectType`, and `inputs[]` (per-input `id`, `name`, `fieldType`, `optional`, `description`, `options`). On import the editor rebuilds each input list from connector metadata and pairs values by `id`, so emit every `id` exactly as returned — one missing or misspelled lands as an empty input. Filter blocks in-memory after fetching (e.g. `snippet == false and name matches /reload/i` for endpoint blocks, or pick an `id` and read its `inputs`).
3. For external connector blocks (any block that carries a `datasource` setting — QCS-native blocks don't), resolve the connection: call `qlik_list_automation_connections` with `filter='connectorId eq "<connector-guid>"'`, once per distinct connector. Exactly one match → bind its `id` as the block's `datasource` value; warn when it reports `isConnected: false` (runs will fail at the service until the user reconnects it). Several matches → ask the user which to bind. None → leave `value: null` and record in `Assumptions` that the user must create and bind a connection before execution. For cloud-storage file blocks there is no `datasourcetype_guid` — their `datasourcetype` is an adapter name — so first get the connector guid with `qlik_list_automation_connectors` using `filter='name eq "<adapter name>"'` (the adapter name is the connector's catalog name), then resolve the connection as above. The create/update API stores `datasource` verbatim — a null is never auto-bound on import, so an unbound block stays unbound.
4. If no connector or block fits, don't stop — see [No dedicated block: generic connectors and raw API](#no-dedicated-block-generic-connectors-and-raw-api).

### 2. Build workspace JSON

1. Pick block types and confirm their shapes via `$defs`. Each block type's entry opens with what it is for and when to reach for it — read a candidate's description before picking it (that selection guide covers every supported type), then confirm required top-level fields, `inputs[*]` shape constraints, and any conditional rules. To find an entry, look up the type in `$defs.Block` in `assets/schemas/workspace-schema.json`: every type is listed there as a `$ref` pointing at its definition, either in the same file or in a `blocks/` category file — e.g. `{"$ref": "blocks/basic.json#/$defs/IfElseBlock"}` means read `assets/schemas/blocks/basic.json`. Open only the files the draft needs.
   - Prefer a `SnippetBlock` over a hand-built equivalent when the connector ships one, and do not inline-expand a snippet into its constituent blocks unless the user explicitly asks.
   - Add a `FormBlock` only when the flow genuinely needs runtime user input — an interactive caller supplying parameters, not a value you could resolve while drafting.
2. Draft `workspace` JSON. Fill only `value` fields, names, comments, and edges. Use the connector-detail `inputs[*].id` as `inputs[*].id` on the workspace block. Translate `fieldType` to the schema's `type` using the [fieldType mapping](#fieldtype-to-input-type-mapping).
3. Validate the draft — see [Validation](#validation).
4. Return the result — see [Return format](#return-format).

If the request is underspecified, ask only for blocking business values (app ids, recipient ids, message text). Do not ask questions the connector detail can answer.

Decide from the connector-detail `role` whether a chosen block owns an internal loop, and wire accordingly — see [Iterable blocks and loops](#iterable-blocks-and-loops).

If you don't understand how blocks should be wired, ask rather than assume.

### 3. Create, update, or delete automations via qlik-mcp tools

- `qlik_create_automation` to create a new automation (pass `workspace` with the built JSON).
- `qlik_get_automation_by_id` to inspect an automation's configuration.
- `qlik_update_automation` to change name, description, workspace, or concurrency. Do not set schedules — see [Scope](#scope).
- `qlik_delete_automation` to delete an automation.

Lifecycle guidance:

1. Resolve required ids first (automation id, connector, connection, space).
2. Validate request completeness before calling write operations.
3. For mutating operations (`create`, `update`, `delete`), echo key identifiers and resulting status.
4. Do not fabricate ids. Ask for missing ids only when they cannot be discovered from prior results.
5. After a successful `qlik_create_automation` (or `qlik_update_automation`), call `qlik_search` with `resourceType="automation"` and the automation's name as the query, match the result whose `id` equals the returned automation id, and share that result's `open` URL so the user can open the automation in the editor. Never hand-build or guess the URL — if no result matches, say the link could not be resolved and report the automation id instead.

## No dedicated block: generic connectors and raw API

When `qlik_list_automation_connectors` has no dedicated connector for the platform being called, or the resolved connector's blocks don't cover the needed operation, escalate in this order instead of stopping:

1. **Generic connector matched to how the platform's API authenticates** — ordinary connectors, so the normal workflow applies (resolve the guid from the connector list, fetch blocks with `qlik_get_automation_connector`): [`API Key`](https://community.qlik.com/t5/Official-Support-Articles/How-to-Getting-started-with-the-API-key-connector-in-Qlik/ta-p/2036563) (key sent as an HTTP header or query-string parameter), [`Basic Authentication`](https://community.qlik.com/t5/Official-Support-Articles/How-to-get-started-with-the-Basic-Authentication-connector-in/ta-p/2057190) (username/password), or [`OAuth2`](https://community.qlik.com/t5/Official-Support-Articles/How-to-Getting-started-with-the-Oauth2-connector-in-Qlik/ta-p/1880261) (authorization-code flow with automatic token refresh). Each exposes the same [raw API block family](https://community.qlik.com/t5/Official-Support-Articles/How-to-use-the-Raw-API-Request-blocks-in-Qlik-Automate/ta-p/1844965): one `raw API request` `EndpointBlock` (`path` relative to the connection's base URL, `method`, `query_parameters`, `request_body`, `headers`) for single calls, and `raw API list request - <paging>` variants (cursor-token, offset, page-number, or no paging) for lists — pick the variant matching the API's pagination and set `json_path_for_output_records` to the JSON path of the record array. Base URL and credentials live on the **connection**, not the workspace: resolve and bind the connection id like any other connector (workflow step 1.3); when the tenant has none, keep `value: null` and note in `Assumptions` that the user must create and bind a connection (connector name, auth type, credentials, base URL) before execution.
2. **Built-in [`CallUrlBlock`](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_QlikAutomation/basic/call-url-block.htm)** — only for endpoints needing no authentication, or when a connection-bound connector cannot be used. Nothing signs the request; never inline secrets (API keys, passwords, tokens) into `headers` or `params` — use a generic connector for authenticated APIs.

Tell the user which fallback was chosen and why. Known limitation: the `API Key` connector cannot send extra fields in the authorize request itself; if the auth flow needs that, say so and stop.

## Workspace shape

```json
{ "blocks": [], "variables": [] }
```

- Exactly one `StartBlock`. Use uppercase UUIDv4s for block ids and variable guids. Keep block names unique and stable so JSON-path references stay readable.
- For `EndpointBlock` and `SnippetBlock`, emit the **full** visible input list from the matching connector-detail block's `inputs` array — including optional ones (`optional: true`) with `value: null`. Each `inputs[*].id` is the connector-detail `inputs[*].id`; each `inputs[*].type` is derived from `fieldType` via the [fieldType mapping](#fieldtype-to-input-type-mapping).
- Most blocks should carry `collapsed: [{ "name": "loop", "isCollapsed": false }]`. `IfElseBlock` uses `[{name:"both"}, {name:"yes"}, {name:"no"}]`. `CaseBlock` uses `[{name:"default"}]`.
- Settings to add for connector blocks: `blendr_on_error` (allowed: `ignore`, `warning`, `stop` — never `continue`; default `stop`; use `warning` on a block whose failure downstream logic inspects and classifies, `stop` everywhere else), `automations_censor_data` (default `false`), and `datasource` only when the connector persists one (Qlik Cloud Services blocks omit it; external connectors carry the connection id resolved in workflow step 1.3, or `value: null` when the tenant has no matching connection — return the workspace anyway and note that the user must bind a connection before execution). For list/search/listnew/listupdated roles also add `maxitemcount`. For listnew/listupdated also add `blendr_pointer: "yes"`.

### Variables

Variables are workspace-level named values (`string`, `number`, `list`, `object`, `table`) for carrying state across blocks — use one when a value must be accumulated, flagged, or read outside the block that produced it.

- Declare each variable as `{ "guid": ..., "name": ..., "type": ... }` only — never a `value`. Seed initial state (a zeroed counter, a pre-filled list) with a `VariableBlock` early in the flow: start with an `empty` operation, then the seeding operations (`set_value`, `add_item`, …). `number` variables have no `empty` — start them with `set_value`.
- Variable names: letters, digits, and underscores only, starting with a letter or underscore; unique among variables and distinct from every block name — `{$.name}` references resolve blocks and variables in one namespace, and other characters get mangled or quoted in the derived path.
- Name each `VariableBlock` exactly after its variable; repeats get `#2`, `#3`, … (this mirrors how the editor names them, so imported and authored blocks stay consistent).
- Operations must match the variable's `type` — the mapping is in the schema's `VariableOperation` description. Each operation entry carries a fresh UUIDv4 `key`, the operation `id`, its editor label as `name`, and a `value` (except `empty`).
- Accumulate results in `list` variables. Avoid `table` variables and `add_row` in authored workspaces — the editor UI can configure them, but authored rows do not reliably survive the runtime.

### References in input values

- `{$.blockName}` or `{$.blockName.field}` references an earlier block. Use this exact form — no spaces inside the braces. 
- When the referenced block returns a **list** and the referencing block sits inside that list's loop, reference the current element with `item` — not the list itself. `{$.listApps.item}` is the element the iteration is on and `{$.listApps.item.<field>}` is one field of it, while `{$.listApps}` is the whole list. This applies both to blocks in a `ForEachBlock` body and to blocks placed in an `EndpointBlock` / `SnippetBlock` internal loop via `loopBlockId`. Emit the bare `{$.blockName}` form only where a whole list is genuinely wanted — e.g. the `input` of a `ForEachBlock` that runs *after* the producing block rather than inside its loop. Where a whole list is wanted, the reference must be the input's **entire** value — never embed a list reference inside a longer string (concatenation flattens the list into text).
  - `<field>` is not a fixed choice — never default to `id`. Take it from what the user asked to chain (an id, a name, an email, a url, a nested path like `owner.email`) and confirm the list element actually exposes it. If the request doesn't name a field, or the element's shape doesn't make the right one unambiguous, stop and ask the user which field to chain instead of guessing. Reference the whole element as `{$.blockName.item}` only when the downstream input genuinely takes the full object.
- `VariableBlock` outputs use the **variable name**, not the block name. If `variables[*].name = "reload_failed"`, use `{$.reload_failed}` — not `{$.setFailureFlag1}`.
- `{explode: {$.inputs.reload_ids}, ','}` for explode helpers.

### Iterable blocks and loops

A block is **iterable** — it owns a loop body and accepts `loopBlockId` — by block type, not by the shape of its output. Never infer it from a `collapsed` entry: a `loop` entry is the editor's default for every block except `IfElseBlock` and `CaseBlock`, iterable or not, and an authored `collapsed` array is stored verbatim, so it says nothing about iterability.

- `EndpointBlock` / `SnippetBlock`: iterable when the connector-detail `role` is `list`, `search`, `listnew`, or `listupdated` — the same four roles that get a `maxitemcount` setting. Every other role (`get`, `create`, `update`, `delete`, anything else, or none) is **not** iterable.
- Always iterable regardless of role or inputs: `ForEachBlock`, `ForEachBatchBlock`, `FilterListBlock`, `TransformListBlock`, `DeduplicateListBlock`, `MergeListsBlock`, `CompareListsBlock`, `ReplaceFieldNamesBlock`, `ListFilesBlock`, `ReadDataFromFileBlock`.
- Never iterable, despite being list blocks: `LookupItemBlock` (returns one matched item) and `LimitBlock`.
- Connector-specific block types outside this schema's `KnownBlockType` list (legacy FTP/SFTP/S3 file blocks, data-store list blocks) can be iterable independently of their role. Don't author those types; prefer the generic cloud-storage blocks above.

Consequences for the draft:

- Set `loopBlockId` only on an iterable block. A non-iterable block keeps the field in memory but never renders a loop body, and the editor omits `loopBlockId` when serializing it — so the chain hanging off it is invisible on the canvas and lost the first time the automation is saved from the editor.
- On an `EndpointBlock`, emit `endpoint_role` with the connector-detail `role`. It is the only role the editor has until the connector metadata request resolves, so without it the block counts as non-iterable in that window — and anything that serializes the workspace before the metadata lands drops its `loopBlockId`.
- Wiring a per-item action off a list: put it inside the producer's own loop via `loopBlockId` — no `ForEachBlock` needed. Reach for a separate `ForEachBlock` chained via `childId` only when the producer is not iterable, when the list is a variable or an earlier block's output rather than the immediate parent, or when work must run once over the whole list before the iteration.
- Inside a loop, reference the current element through `item`, per [References in input values](#references-in-input-values).

### Edges and parent uniqueness

Edge fields: `childId`, `childTrueId`, `childFalseId`, `loopBlockId`, `statementChildrenIds`, `defaultChildId`. All edge values must reference an existing block id or be `null`.

A block id may appear **only once** as a target across all edge fields in the whole workspace. Merge-style rejoin wiring is invalid for import even when the runtime logic looks fine.

`GotoBlock` jumps via `inputs[].id = "label"`, not via an edge field. `LabelBlock`s reached only via `GotoBlock` may be intentionally disconnected from the `StartBlock` chain.

#### Branch recipe

Converging several branches on one later block is the usual way parent uniqueness gets violated. Instead: declare a top-level variable, set it with a `VariableBlock` inside each branch that should trigger the later action, continue the main sequence through `IfElseBlock.childId` rather than through branch leaves, then read the variable once in a final `IfElseBlock` and hang the action off its `childTrueId`.

So `checkReload1.childFalseId` and `checkReload2.childFalseId` both pointing at `sendFailureMessage` is invalid; each pointing at its own `VariableBlock` that sets `reload_failed = true` is not.

### fieldType to input type mapping

The connector detail describes inputs with `fieldType`; the schema's `inputs[*].type` uses editor types. The two vocabularies do not overlap and no connector-detail input reports its editor type, so this translation cannot be looked up at runtime — it has to live here.

| connector-detail `fieldType` | schema `inputs[*].type` | notes |
|---|---|---|
| `string`, `input`, `int`, `json`, `json_list` | `string` | The wrapper type is `string`; the agent still writes a stringified JSON list for `json_list`. |
| `enum`, `select` | `select` | Allowed values come from the connector-detail `options` array — but roughly half of QCS `select` inputs return `options: []`, and then the input's `description` is what states the default and the alternatives. |
| `object`, `json_object` | `object` | Add `"mode": "keyValue"` on the input alongside `type`. |
| `longtext`, `textarea` | `longtext` | Multi-line text. |
| `file` | `file` | File payload passed from an upstream block, e.g. a cloud-storage `Open File` output. |
| `date` | `date` | |

The remaining `EditorType` values — `checkbox`, `list`, `custom`, `field`, `code`, `documentation`, `api-search` — are never the target of this translation. They belong to built-in block inputs and connector settings (`conditions` is `custom`, `automations_censor_data` is `checkbox`), not to connector-detail inputs.

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

The validator reports schema violations only. Cross-cutting rules above (parent uniqueness, `statementChildrenIds` length, real connector-detail guids) are not expressible in JSON Schema and must still be checked in `Preflight`.

## JSON output rules

These rules govern the workspace JSON emitted in the response. Violating any of them produces malformed or unimportable output.

- The workspace is **one** JSON object with exactly one top-level `blocks` array and one top-level `variables` array, emitted as **exactly one** fenced ` ```json ` block per response — never split across code blocks or followed by a second object (`{...}{...}`). If the user asks to extend an automation, regenerate the whole workspace from scratch.
- Plain JSON only: no trailing commas, no `//` or `/* */` comments, no unquoted keys, no `undefined` / `NaN` / `Infinity`, ASCII double quotes only (no smart quotes `“ ” ‘ ’`), no em-dashes inside JSON strings unless the user asked for them in literal text.
- No placeholder strings in the final output. Replace every `BLOCK-ID`, `LABEL-BLOCK-ID`, `LOOP-BLOCK-ID`, `VARIABLE-GUID`, `<endpoint-guid>`, `OPERATION-KEY`, `VALUE-HERE`, etc. with real connector-detail guids or freshly generated uppercase UUIDv4s. If a value is genuinely unknown (e.g. connection id), use `null`, not a placeholder string.
- Do **not** copy block snippets from `$defs` examples or from prior chat output verbatim — those examples contain sentinel ids. Construct each block fresh, using connector-detail ids and your own UUIDs.

## Return format

**For workspace building:**

1. Final `workspace` JSON in one fenced ` ```json ` block.
2. `Preflight` confirming each of:
   - the workspace validates against `assets/schemas/workspace-schema.json` plus `assets/schemas/blocks/*.json` (ajv-cli command in [Validation](#validation), `-r` included, returns `valid`), and its sole `StartBlock` has `inputs[0].id: "run_mode"`, `inputs[0].type: "select"`, and `inputs[0].value: "manual"`
   - every `EndpointBlock` / `SnippetBlock` `inputs[*].id` matches an `inputs[*].id` for that block in the `qlik_get_automation_connector` response, with none left out — including optional inputs, which carry `value: null`
   - every `EndpointBlock` / `SnippetBlock` `datasourcetype_guid` is the `id` of a connector returned by `qlik_list_automation_connectors` in this session (e.g. `61a87510-c7a3-11ea-95da-0fb0c241e75c` for Qlik Cloud Services), and matches the connector whose block detail supplied that block's `endpoint_guid` / `snippet_guid`
   - every `IfElseBlock` uses `type: "custom"` with `value.mode` and at least one `value.conditions` entry
   - every `CaseBlock` keeps `statementChildrenIds` aligned with `inputs['statements'].value`, and every `GotoBlock` points to a real `LabelBlock.id` with matching `displayValue`
   - every `VariableBlock` is named after its variable, its `variableGuid` matches a real `variables[*].guid`, and every operation `id` is one its variable's `type` allows
   - every external connector block's `datasource` value is a connection `id` returned by `qlik_list_automation_connections` this session, or `null` with a matching `Assumptions` entry
   - no `inputs[*].value` in the workspace holds a literal credential (API key, password, token, secret, signed URL) — authenticated calls go through a connection-bound connector block, and any `CallUrlBlock` with `headers` or `params` sets `automations_censor_data: true`
   - every `loopBlockId` sits on an iterable block — a built-in loop block, or an `EndpointBlock` / `SnippetBlock` whose connector-detail `role` is `list`, `search`, `listnew`, or `listupdated` — and each such `EndpointBlock` carries a matching `endpoint_role`
   - every reference made from inside a loop to the list-producing block that owns that loop goes through `item` (`{$.blockName.item...}`), not the bare list (`{$.blockName...}`), and the field after `item` is one the user named or the element demonstrably exposes — not an assumed `id`
   - no block has multiple parents
3. Short `Assumptions` section listing unresolved connections or guesses.

`Preflight` and `Assumptions` are plain Markdown **after** the JSON code block — never embed them as extra keys (e.g. `"_preflight"`) on the workspace object. If schema validation fails, or any `Preflight` item cannot be truthfully confirmed, **do not emit the JSON block** — report the failure or ask a clarifying question instead.

**For automation lifecycle operations:**

1. `Action` summary: tool called, why, and what changed.
2. `Inputs` used: ids, filters, or payload fields sent to the tool.
3. `Result`: automation id, status, and key returned fields from the tool response. For a create or update, include the editor link resolved via `qlik_search` (lifecycle guidance step 5).
4. `Next steps` only when additional input or actions are required (e.g., binding a connection before execution).
