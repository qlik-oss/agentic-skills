# Construction rules

How to shape the `workspace` object once the connector, blocks and run mode are resolved. Read this before drafting — every rule here applies to every automation, and most of them are invisible to schema validation.

Shape and field-level constraints live in `assets/schemas/` and are enforced by ajv. This file carries what the schema cannot express: value syntax, loop semantics, edge topology, and the `fieldType` translation.

## Workspace shape

```json
{ "blocks": [], "variables": [] }
```

- Exactly one `StartBlock`. Block ids and variable guids are uppercase UUIDv4s (see `$defs.BlockId`). Keep block names unique and stable so JSON-path references stay readable.
- For `EndpointBlock` and `SnippetBlock`, emit the **full** visible input list from the matching connector-detail block's `inputs` array — including optional ones (`optional: true`) with `value: null`. Each `inputs[*].id` is the connector-detail `inputs[*].id`; each `inputs[*].type` is derived from `fieldType` via the [fieldType mapping](#fieldtype-to-input-type-mapping). Which array supplies the guid, and the input ordering rule, are in the `EndpointBlock` / `SnippetBlock` `$defs` descriptions.
- Most blocks should carry `collapsed: [{ "name": "loop", "isCollapsed": false }]`. `IfElseBlock` uses `[{name:"both"}, {name:"yes"}, {name:"no"}]`. `CaseBlock` uses `[{name:"default"}]`.
- Settings to add for connector blocks:
  - `blendr_on_error` — allowed: `ignore`, `warning`, `stop`; never `continue`. Default `stop`; use `warning` on a block whose failure downstream logic inspects and classifies, `stop` everywhere else.
  - `automations_censor_data` — default `false`.
  - `datasource` — only when the connector persists one. Qlik Cloud Services blocks omit it; external connectors carry the connection id resolved in workflow step 1.3, or `value: null` when the tenant has no matching connection (return the workspace anyway and note that the user must bind a connection before execution). Binding and null semantics: `$defs.DatasourceSetting`.
  - `maxitemcount` — for `list`, `search`, `listnew` and `listupdated` roles.
  - `blendr_pointer: "yes"` — for `listnew` and `listupdated`.

## Variables

Variables are workspace-level named values (`string`, `number`, `list`, `object`, `table`) for carrying state across blocks — use one when a value must be accumulated, flagged, or read outside the block that produced it. Declaration shape and the per-type operation list are in the `$defs.Variable` and `$defs.VariableOperation` descriptions; the rules below are not.

- Seed initial state (a zeroed counter, a pre-filled list) with a `VariableBlock` early in the flow: start with an `empty` operation, then the seeding operations (`set_value`, `add_item`, …). `number` variables have no `empty` — start them with `set_value`.
- Variable names: letters, digits, and underscores only, starting with a letter or underscore; unique among variables and distinct from every block name — `{$.name}` references resolve blocks and variables in one namespace, and other characters get mangled or quoted in the derived path.
- Name each `VariableBlock` exactly after its variable; repeats get `#2`, `#3`, … (this mirrors how the editor names them, so imported and authored blocks stay consistent).
- Accumulate results in `list` variables. Avoid `table` variables and `add_row` in authored workspaces — the editor UI can configure them, but authored rows do not reliably survive the runtime.

## References in input values

- `{$.blockName}` or `{$.blockName.field}` references an earlier block. Use this exact form — no spaces inside the braces.
- When the referenced block returns a **list** and the referencing block sits inside that list's loop, reference the current element with `item` — not the list itself. `{$.listApps.item}` is the element the iteration is on and `{$.listApps.item.<field>}` is one field of it, while `{$.listApps}` is the whole list. This applies both to blocks in a `ForEachBlock` body and to blocks placed in an `EndpointBlock` / `SnippetBlock` internal loop via `loopBlockId`. Emit the bare `{$.blockName}` form only where a whole list is genuinely wanted — e.g. the `input` of a `ForEachBlock` that runs *after* the producing block rather than inside its loop. Where a whole list is wanted, the reference must be the input's **entire** value — never embed a list reference inside a longer string (concatenation flattens the list into text).
  - `<field>` is not a fixed choice — never default to `id`. Take it from what the user asked to chain (an id, a name, an email, a url, a nested path like `owner.email`) and confirm the list element actually exposes it. If the request doesn't name a field, or the element's shape doesn't make the right one unambiguous, stop and ask the user which field to chain instead of guessing. Reference the whole element as `{$.blockName.item}` only when the downstream input genuinely takes the full object.
- `VariableBlock` outputs use the **variable name**, not the block name. If `variables[*].name = "reload_failed"`, use `{$.reload_failed}` — not `{$.setFailureFlag1}`.
- `{explode: {$.inputs.reload_ids}, ','}` for explode helpers.

## Iterable blocks and loops

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

## Edges and parent uniqueness

Edge fields: `childId`, `childTrueId`, `childFalseId`, `loopBlockId`, `statementChildrenIds`, `defaultChildId`. All edge values must reference an existing block id or be `null`.

A block id may appear **only once** as a target across all edge fields in the whole workspace. Merge-style rejoin wiring is invalid for import even when the runtime logic looks fine.

`GotoBlock` jumps via `inputs[].id = "label"`, not via an edge field. `LabelBlock`s reached only via `GotoBlock` may be intentionally disconnected from the `StartBlock` chain.

### Branch recipe

Converging several branches on one later block is the usual way parent uniqueness gets violated. Instead: declare a top-level variable, set it with a `VariableBlock` inside each branch that should trigger the later action, continue the main sequence through `IfElseBlock.childId` rather than through branch leaves, then read the variable once in a final `IfElseBlock` and hang the action off its `childTrueId`.

So `checkReload1.childFalseId` and `checkReload2.childFalseId` both pointing at `sendFailureMessage` is invalid; each pointing at its own `VariableBlock` that sets `reload_failed = true` is not.

## fieldType to input type mapping

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
