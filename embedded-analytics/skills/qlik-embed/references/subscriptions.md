# Subscriptions next to an embed (sharing tasks)

Optional: only when the user asks. In preview mode (`preview="true"`), the
native context menu of `analytics/chart` and `analytics/sheet` already offers
Subscribe; suggest that first. Build a custom UI with `@qlik/api` on the
embed's sign-in only for their own Subscribe button (default mode, own
styling) or a "My subscriptions" panel.

Use only what the Sharing tasks spec documents (qlik.dev reference and the
`@qlik/api` typings). The Qlik Cloud UI sends extra, undocumented fields;
don't copy them. Tested on a tenant (2026-11-09, `@qlik/api` 2.22.0): create
(PDF), list, rename, reschedule, pause, resume, delete. Not tested:
`sheet-sharing`, PowerPoint output, non-admin users, other recipients.

## Calls (`@qlik/api/sharing-tasks`)

| Feature | Call |
|---|---|
| Available? Limits | `getSharingTasksSettings()` |
| Subscribe | `createSharingTask(body)` |
| My subscriptions | `getSharingTasks({ role: ["owner"], type: ["chart-sharing", "sheet-sharing"], excludeDeleting: true, sort: ["-datecreated"], limit: 50 })` |
| Rename, reschedule, pause, resume | `patchSharingTask(id, [{ op: "replace", path, value }])` with `/name`, `/scheduleOptions`, `/enabled` |
| Delete | `deleteSharingTask(id)` |
| Recipient | `getMyUser()` from `@qlik/api/users` |

## Where the options come from

Tell the user:

- **Server:** feature flags and limits from `getSharingTasksSettings()`. Hide
  the button when they're off.
- **User:** `getMyUser()` for the recipient ID; the time zone from
  `preferredZoneinfo` or the browser.
- **App:** frequency, days, time, and format. There's no public API that lists
  them: the page builds an RFC 5545 `RRULE` (daily, weekly, monthly) and offers
  PDF (`"pdf"`) or PowerPoint (`"pptx"`).
- **Embed:** app, sheet, and object IDs, and current selections (ref API).

There's no public API to validate recipients before saving: report problems
from `recipients.userIds[].taskRecipientErrors` after saving. Both gaps are
feature requests the user can raise with Qlik.

## Template

```ts
import {
  createSharingTask,
  deleteSharingTask,
  getSharingTasks,
  getSharingTasksSettings,
  patchSharingTask,
  type Selection,
  type SharingTaskRecurringCreateRequest,
} from "@qlik/api/sharing-tasks";
import { getMyUser } from "@qlik/api/users";
import type { Doc } from "@qlik/api/qix";

export type Frequency = { freq: "DAILY" } | { freq: "WEEKLY"; days: string[] } | { freq: "MONTHLY"; day: number };

// RRULE without DTSTART/UNTIL: start and end go in scheduleOptions.
export function toRRule(f: Frequency, hour: number, minute: number): string {
  const by = f.freq === "WEEKLY" ? `;BYDAY=${f.days.join(",")}` : f.freq === "MONTHLY" ? `;BYMONTHDAY=${f.day}` : "";
  return `RRULE:FREQ=${f.freq};INTERVAL=1${by};BYHOUR=${hour};BYMINUTE=${minute};BYSECOND=0`;
}

export async function subscriptionsAvailable(): Promise<boolean> {
  const { data: s } = await getSharingTasksSettings();
  return !!s["enable-sharing"] && !!s["enable-report-subscription"] && s["reporting-service-license-status"] === "enabled";
}

// The embed's current selections, in the shape the sharing service expects.
// The service turns them into a bookmark for the task (and deletes it with the task).
export async function currentSelections(doc: Doc): Promise<Selection[]> {
  const obj = await doc.createSessionObject({ qInfo: { qType: "current-selections" }, qSelectionObjectDef: {} });
  try {
    const layout = await obj.getLayout();
    return (layout.qSelectionObject?.qSelections ?? []).map((s) => {
      // Lists only the first few values of large selections: if
      // values.length < s.qSelectedCount, read them with a list object.
      const values = (s.qSelectedFieldSelectionInfo ?? []).map((v) => v.qName ?? "");
      return { name: s.qField ?? "", displayName: s.qField ?? "", stateName: "$", isNumeric: false, values, displayValues: values };
    });
  } finally {
    await doc.destroySessionObject(obj.id);
  }
}

export async function subscribe(opts: {
  name: string;
  appId: string;
  sheetId: string;
  objectId: string;
  rrule: string;
  timezone: string;
  format: "pdf" | "pptx";
  selections: Selection[];
}) {
  const { data: me } = await getMyUser();
  const body: SharingTaskRecurringCreateRequest = {
    name: opts.name,
    type: "chart-sharing",
    enabled: true,
    state: { selections: opts.selections },
    scheduleOptions: { recurrence: [opts.rrule], timezone: opts.timezone },
    recipients: { userIds: [{ value: me.id, subscribed: true }] },
    templates: [
      {
        type: "chart",
        subType: opts.format,
        chartData: {
          appId: opts.appId,
          sheetId: opts.sheetId,
          objectId: opts.objectId,
          widthPx: 1680,
          heightPx: 1120,
          jsOpts: { language: navigator.language, theme: "horizon" },
        },
      },
    ],
  };
  const { data: task } = await createSharingTask(body);
  return task;
}

export async function mySubscriptions() {
  const { data } = await getSharingTasks(
    { role: ["owner"], type: ["chart-sharing", "sheet-sharing"], excludeDeleting: true, sort: ["-datecreated"], limit: 50 },
    { noCache: true },
  );
  return (data.sharingTasks ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    app: t.appName,
    rrule: t.scheduleOptions?.recurrence?.[0],
    timezone: t.scheduleOptions?.timezone,
    // `enabled` is left out of the response when false.
    paused: t.enabled !== true,
    nextRun: t.enabled === true ? t.scheduleOptions?.nextExecutionTime || null : null,
    status: t.statusCode,
  }));
}

export async function reschedule(id: string, rrule: string, timezone: string) {
  await patchSharingTask(id, [{ op: "replace", path: "/scheduleOptions", value: { recurrence: [rrule], timezone } }]);
}

export async function setPaused(id: string, paused: boolean) {
  await patchSharingTask(id, [{ op: "replace", path: "/enabled", value: !paused }]);
}

export async function unsubscribe(id: string) {
  await deleteSharingTask(id);
}
```

Wire it up with the embed's ref API
(`const doc = await (await el.getRefApi()).getDoc()`), and refresh the panel
after each change.

## Gotchas

- **Paused:** a disabled task has no `enabled` key and keeps a stale
  `nextExecutionTime`. Show "Paused", not a next run.
- **Filters:** pass arrays to `@qlik/api`. A hand-built repeated parameter
  (`role=owner&role=recipient`) returns nothing, with status 200. Filter by
  `type`: unfiltered lists include alerts (`chart-monitoring`).
- **Deletes are asynchronous** (`statusCode: "DELETING"` for a few seconds):
  use `excludeDeleting: true`.
- **`statusCode`:** show anything other than `VALID` next to the subscription.
- **Changing format:** delete and recreate with the same schedule and
  `state.selections`. Replacing `/templates` with documented fields loses the
  link to the selections bookmark, and the spec doesn't say whether
  selections still apply.
- **Spec gaps to mention:** where `language` goes (the template uses
  `jsOpts`), and `trigger` vs `scheduleOptions` (the template follows the
  typings).
- **Listing without `appid`** is documented for admins; for other users, fall
  back to the embedded app's `appid` if refused.
