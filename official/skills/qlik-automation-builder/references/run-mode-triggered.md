# Run mode: `triggered`

Read this once the mode is `triggered`. `SKILL.md` under **Run modes** decides the mode and holds the rule that the StartBlock's output *is* the trigger payload, plus the `test_payload` string rule.

StartBlock inputs: `run_mode: "triggered"`, plus `async` and `test_payload` — both optional.

## Sync vs async

A triggered automation can run either synchronously or asynchronously; `async` on the StartBlock only sets the **default**, and the caller can override it per call.

- `async: "no"` runs synchronously — the run URL holds the connection open and returns the run output to the caller. `async: "yes"` returns as soon as the run is queued. An absent `async` input behaves as `"no"`, so the input is optional and the schema does not require it.
- The run URL overrides the block per call with its own `async` request parameter, which is a **boolean** (`?async=true` / `?async=false`) — not the block's `"yes"`/`"no"` string. When the parameter is present it wins; only when it is absent does the block's value apply. So pick the block value for the common case and leave the caller free to differ.
- Sync and async runs get very different timeouts: a sync run defaults to **60s** and is capped at **300s**, while an async run gets the automation's normal timeout (an hour by default). Anything that loops over a list, reloads an app, or waits on a slow API must default to `"yes"` — a sync default will simply time out. Reserve `"no"` for short flows whose result the caller reads immediately.
- `qlik_start_automation_run` does not go through this at all: it posts to `/runs` with context `api`, which is always queued and polled with `qlik_get_automation_run`. `async` neither helps nor hurts there.

## Why this mode for outside callers

- The run URL — `POST /api/v1/automations/{id}/actions/execute`, authenticated with the automation's execution token — **rejects every run mode except `triggered`** for automations created after the tenant's cut-off date. That is the reason to pick this mode for anything driven from outside the hub.
- `qlik_start_automation_run` posts to `/runs` instead and is not subject to that check, so it will happily start a `manual` automation. It still cannot get a payload into one: the `inputs` it sends are only readable through a `triggered` StartBlock.

## Preflight additions

Confirm these alongside the checklist in `SKILL.md`:

- `async` is present only when its default is deliberate, and when it is `"no"` the flow demonstrably finishes inside the 300s sync cap.
- Every `{$.<startBlockName>...}` reference names a field the caller sends.
