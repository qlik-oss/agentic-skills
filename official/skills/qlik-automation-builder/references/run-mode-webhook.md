# Run mode: `webhook`

Read this once the mode is `webhook`. `SKILL.md` under **Run modes** decides the mode and holds the rule that the StartBlock's output *is* the incoming payload, plus the `test_payload` string rule.

A webhook automation starts when a connector publishes an event — an app reload finishing, a push to a repository, an automation run failing. Everything the StartBlock carries comes from the connector's webhook configuration. Fetch it; never reconstruct event ids, param ids, filter paths or filter values from memory, from this file, or from an earlier chat.

## Discover the event

1. Resolve the connector with `qlik_list_automation_connectors`, exactly as for any other block. Only a connector reporting `hasWebhooks: true` can start a webhook automation. If the connector the request names has none, say so and offer `triggered` or `scheduled` (poll on a recurrence) instead of inventing an event.
2. Call `qlik_get_automation_connector_webhook_configuration(connectorId=<connector-guid>)`. It returns the connector's `events[]`.
3. Pick the event by `name`, `description`, `role` (`create`, `update`, `delete`) and — where present — `eventType`. Read the `description` of every plausible candidate before choosing: connectors can ship several events that sound alike, and the descriptions are where the service says which one fits which use case (e.g. one event per attempt versus one per final outcome). When two events still fit the request equally well, ask.

Each `events[]` entry carries:

| field | what it is | what you do with it |
|---|---|---|
| `id` | the event guid | `webhook_event_guid` value |
| `name`, `description`, `role` | what the event means | choosing the event; the StartBlock `name` (below) |
| `params[]` | the event's configuration inputs — `id`, `name`, `options`, `required`, `type` | one StartBlock input each (below) |
| `exampleOutput` | a sample payload | `test_payload`, and the map of fields downstream blocks may reference |
| `eventType` | the event's CloudEvent type, when the service declares one | informational only; never persist it |
| `allowedFilters` | `null`, or the filter `path`s this event accepts and the `allowedValues` each accepts | how to build the `filter` param (below) |

## StartBlock shape

Inputs, in this order:

1. `{"id": "run_mode", "type": "select", "value": "webhook"}`
2. `{"id": "datasourcetype_guid", "type": "select", "value": "<connector id>"}`
3. `{"id": "webhook_event_guid", "type": "select", "value": "<event id>"}`
4. one input per `params[]` entry, in the order returned, with id `webhook_param_<param id>`
5. `{"id": "test_payload", "type": "json", "value": "<exampleOutput serialized to a JSON string>"}`

Every input also carries `"structure": {}`.

`settings`: a `datasource` setting only when the connector needs a connection — resolve it with `qlik_list_automation_connections` exactly as `SKILL.md` describes for connector blocks. Qlik-native connectors persist none.

Never persist editor helper inputs on the StartBlock. The editor draws extra UI fields over some params (for example a list of app ids or a status dropdown that it compiles into the `filter` param); they are rebuilt from the param value on import and are not part of the workspace. Only the five groups above are.

### Name

On import the editor renames a webhook StartBlock after its event: the event `name` split on spaces and hyphens, the first word kept as-is, every later word with its first letter upper-cased, joined with nothing in between — `"Reload Finished"` → `ReloadFinished`, `"On push"` → `OnPush`. Use that name yourself. A StartBlock left as `Start` is renamed on load, and every `{$.Start...}` reference downstream stops resolving.

## Params

For every entry in the chosen event's `params[]`:

- **id** — `webhook_param_<param id>`, with the id copied verbatim. Emit every param, including optional ones, with `value: null` when unused. Never add a `webhook_param_*` id the response did not return.
- **type** — the returned `type`. When it is `null`, use `"select"` if `options` is non-empty and `"string"` otherwise.
- **options** — when non-empty, the value must be one of them.
- **required** — `true` means the param must carry a value. If it is a business value only the user knows (a repository, an owner, a project id), ask for it.
- **internal params** — params whose `name` starts with `_internal_` are hidden in the editor, which sets them itself. For `_internal_migrated_to_cloud_event`, set `"yes"` (the only option): the editor writes `"yes"` whenever an event is picked, and a null value marks the StartBlock as a deprecated legacy event.
- **filter** — a param named `filter` holds a filter expression the service evaluates against each event before starting a run. Build it from `allowedFilters`, below.

## The `filter` param: `allowedFilters` and `allowedValues`

A filter is the cheapest place to narrow which events start the automation: an event that fails the filter never creates a run. Use one whenever the request names a specific resource or outcome ("when *this* app's reload fails", "when an analytics app is deleted") and the event declares a filter path that can express it.

### Reading `allowedFilters`

- `allowedFilters: null` — the event declares no filter paths. Do not invent one. Leave an optional `filter` at `null` and narrow downstream instead (see [When the filter cannot express it](#when-the-filter-cannot-express-it)). If the `filter` param is `required` and no paths are declared, ask the user for the expression rather than guessing.
- Each `allowedFilters[]` entry is one condition you may use:
  - `path` — the payload field the condition tests. Write it **exactly** as returned, case included. Find where it lands in `exampleOutput` to learn what it means: a `path` of `a.b` is `exampleOutput.a.b`.
  - `allowedValues` — either a list or `null`.
    - **a list** — the field is an enum. Every value you test it against must be copied from the list, exact case. Map the user's wording onto a list entry ("analytics apps" → whichever entry denotes analytics); if no entry clearly matches, ask rather than approximating.
    - **`null`** — the field takes a free value, typically the id of a resource. That value must come from the user or from a tool lookup this session (`qlik_search`, `qlik_get_automation_by_id`, a connector list endpoint) — never a guess, never a placeholder.
- Use only the paths the request needs. A filter is optional unless the param says `required: true`; adding clauses the user did not ask for silently drops events they expect.

### Writing the expression

- One condition: `<path> eq "<value>"`.
- Several values for the same path: join with `or` — `<path> eq "<v1>" or <path> eq "<v2>"`.
- Conditions on different paths: join with `and`, and parenthesize any `or` group — `(<pathA> eq "<v1>" or <pathA> eq "<v2>") and <pathB> eq "<v3>"`.
- Values are always double-quoted. Inside the workspace JSON the param value is a string, so those quotes are escaped: `"value": "<path> eq \"<value>\""`.
- A required `filter` must contain at least one condition. If the only declared path takes a free value the user has not supplied, ask for it.

### When the filter cannot express it

When the request depends on a field no `allowedFilters` path covers — or on a comparison other than equality — keep the filter to what it *can* express (or `null`) and put an `IfElseBlock` straight after the StartBlock that tests the payload field, e.g. `{$.<StartBlockName>.<field>} = "<value>"`, with the rest of the flow under `childTrueId`. Take the field path from `exampleOutput`. Record in `Assumptions` that the automation starts on every matching event and exits early, since every such event still costs a run.

## Payload references

The StartBlock's output is the incoming event payload, shaped like the event's `exampleOutput`. Reference it as `{$.<StartBlockName>.<path>}` using the editor-derived name above, and only with paths that exist in `exampleOutput`. Note where the useful fields sit — many events nest them under a wrapper object such as `data`, and the nesting differs between events of the same connector.

## Preflight additions

Confirm these alongside the checklist in `SKILL.md`:

- `run_mode` is `"webhook"`; `datasourcetype_guid` is the `id` of a connector that reported `hasWebhooks: true`; `webhook_event_guid` is an `events[].id` from that connector's `qlik_get_automation_connector_webhook_configuration` response this session.
- There is exactly one `webhook_param_<id>` input per entry in that event's `params[]` — none missing, none extra — and every `type` follows the param rules above.
- Every param value with non-empty `options` is one of them, and every `_internal_migrated_to_cloud_event` param is `"yes"`.
- For the `filter` param: every condition's `path` is copied from that event's `allowedFilters[].path`; every value tested against a path with an `allowedValues` list is copied from that list; every free value came from the user or a tool lookup this session; an optional filter the request does not need is `null`; a required filter has at least one condition.
- The StartBlock carries no inputs beyond `run_mode`, `datasourcetype_guid`, `webhook_event_guid`, the `webhook_param_*` inputs and `test_payload`.
- The StartBlock `name` is the editor-derived event name, and every `{$.<StartBlockName>...}` reference names a path present in the event's `exampleOutput`.
- `test_payload` is the event's `exampleOutput` serialized to a JSON string.
