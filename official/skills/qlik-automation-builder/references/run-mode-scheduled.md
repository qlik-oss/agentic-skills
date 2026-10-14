# Run mode: `scheduled`

Read this once the mode is `scheduled`. `SKILL.md` under **Run modes** decides the mode.

StartBlock inputs: `run_mode: "scheduled"` and nothing else. The recurrence is **not** part of the workspace — it travels in the `schedules` payload of the same create/update call.

## The two halves

Set `run_mode: "scheduled"` on the StartBlock **and** pass a one-element `schedules` array in the same `qlik_create_automation` / `qlik_update_automation` call:

```json
[{"recurrence": "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO", "startAt": "2026-09-14 06:00:00", "stopAt": null, "timezone": "Europe/Stockholm"}]
```

- `recurrence` — a single RRULE (RFC5545) string describing when the automation runs. Keep `DTSTART`/`UNTIL` out of it: the active window is `startAt` / `stopAt`.
- `startAt` / `stopAt` — `"Y-m-d H:i:s"` interpreted in `timezone`. Not ISO-8601: no `T`, no offset, no `Z`. `startAt` is when the schedule becomes active and supplies any time-of-day the rule leaves unspecified, so the clearest payloads pin the time in both: `BYHOUR`/`BYMINUTE` in the rule and a matching `startAt`.
- `timezone` — a tz database name (`Europe/Stockholm`, `UTC`). DST is the service's problem, not yours.
- At most one schedule per automation; further entries are dropped.

## Writing the rule

| the user asks for | `recurrence` |
|---|---|
| every N minutes | `RRULE:FREQ=MINUTELY;INTERVAL=N` |
| every N hours | `RRULE:FREQ=HOURLY;INTERVAL=N` |
| daily at 06:00 | `RRULE:FREQ=DAILY;INTERVAL=1;BYHOUR=6;BYMINUTE=0` |
| every Monday at 06:00 | `RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;BYHOUR=6;BYMINUTE=0` |
| weekdays only | `RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=6;BYMINUTE=0` |
| twice a day (09:00 and 17:00) | `RRULE:FREQ=DAILY;BYHOUR=9,17;BYMINUTE=0` |
| the 1st of every month | `RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1;BYHOUR=6` |
| the first Monday of every month | `RRULE:FREQ=MONTHLY;BYDAY=1MO;BYHOUR=6` |
| the last day of every month | `RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;BYHOUR=6` |
| once, at a set time | `RRULE:FREQ=DAILY;COUNT=1` with `startAt` at that time |

How to compose one:

- `FREQ` sets the unit — `MINUTELY`, `HOURLY`, `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`.
- `INTERVAL=N` skips to every Nth of that unit; omit it for every one.
- `BYHOUR` / `BYMINUTE` pin the time of day, `BYDAY` the weekdays (`MO`…`SU`), `BYMONTHDAY` the days of the month. Each takes a comma-separated list, so one rule can fire several times a day or on several weekdays.
- A `BYDAY` value can carry an ordinal — `1MO` is the first Monday of the period, `-1FR` the last Friday. `BYMONTHDAY=-1` is the last day of the month.
- `COUNT=N` stops after N runs; keep `UNTIL` out of the rule and use `stopAt` instead.

Put the whole recurrence in the rule rather than filtering unwanted days with an `IfElseBlock` in the flow — the schedule is the cheaper and more visible place for it.

State the rule you chose in `Assumptions`, in words as well as RRULE ("every Monday 06:00 Europe/Stockholm"), so the user can check it before the first run.

## Run-mode drift

The tenant recomputes `runMode` on every save, and the schedule wins:

- An active schedule makes the tenant report `runMode: "scheduled"` even when the StartBlock says `manual`.
- Removing the schedule (an empty `schedules` array) flips the reported `runMode` back to `manual` while the StartBlock still says `scheduled`.

Neither is fatal, but both leave the automation describing itself two different ways. Change both halves together, and when removing a schedule set the StartBlock back to `manual` in the same call.

## Preflight additions

Confirm these alongside the checklist in `SKILL.md`:

- A one-element `schedules` array accompanies the create/update call.
- Its `recurrence` is a single `RRULE:` string with no `DTSTART` or `UNTIL`.
- Its `startAt` / `stopAt` use `"Y-m-d H:i:s"` — no `T`, no offset, no `Z`.
- `Assumptions` states the recurrence in words as well as RRULE.
