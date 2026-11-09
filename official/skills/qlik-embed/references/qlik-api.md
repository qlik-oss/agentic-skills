# Using @qlik/api with qlik-embed

`@qlik/api` is Qlik's typed library for Qlik Cloud REST APIs (one module per
API: `items`, `reports`, `users`, `sharing-tasks`, ...), the engine (`qix`), and
auth (`auth`). In the browser it loads the same Qlik runtime as qlik-embed, so
one sign-in serves both, and an app opened with an embed's `identity` shares
its engine session and selections. Replace every `<PLACEHOLDER>`.

Sources: <https://qlik.dev/toolkits/qlik-api/>,
<https://qlik.dev/embed/qlik-embed/customize/interact-with-ref-api/>,
<https://qlik.dev/embed/reports/qlik-api-export-data/>. Templates were compiled
against `@qlik/api` 2.22.0 types. The ref API and export templates were also
run against a tenant (2026-11-09; `@qlik/api` 2.23.0,
`@qlik/embed-web-components` 1.7.5, `@qlik/embed-react` 2.5.6).

## Decide

| The user wants | Use |
|---|---|
| A Qlik chart or sheet | qlik-embed only |
| The data behind a chart that's already embedded (a table, a total, a CSV) | The embed's ref API: `getObject()` → `getHyperCubeData` ([template](#an-embed-already-on-the-page-ref-api)) |
| Host-app buttons or filters that select in an embedded app, bookmarks, or own KPIs from that app | The embed's ref API: `getDoc()`. No `analytics/field` embed or second session needed |
| Their own list, KPI, or chart library with no embed of that app on the page | `qix.openAppSession` + a hypercube session object |
| Host-app filters for an app with no embed on the page | `qix.openAppSession` → `getField(...).selectValues(...)` |
| IDs by name at runtime | `items.getItems`, `spaces.getSpaces` |
| Export buttons: chart data to Excel, a chart as PNG or PDF, a sheet or several sheets as PDF | `reports.createReport` + `tempContents.downloadTempFile` ([Export](#export-excel-png-pdf-and-powerpoint)) |
| The signed-in user | `users.getMyUser()` |
| Their own Subscribe button or "My subscriptions" panel (only if asked; preview mode's context menu has Subscribe) | `sharing-tasks` (`subscriptions.md`) |
| Another Qlik Cloud UI feature | [Finding the API](#finding-the-api-behind-a-qlik-cloud-feature) |
| Calls on the server as the user | [Backend](#backend-impersonation-and-web-client) |

Prefer the ref API when an embed of that app is on the page: nothing extra to
open or close. A page with no Qlik visual doesn't need qlik-embed.

## Sharing authentication

- **One host config** for both, with the same tenant, client ID, and redirect
  URI. `user_default` covers user-level REST and the engine. In TypeScript,
  write `authType: "oauth2"` (lowercase).
- **Web components:** load both through an import map and call
  `auth.setDefaultHostConfig` (template below), or import the npm package after
  `setDefaultHostConfig`. Never configure two different clients.
- **React:** pass the same `HostConfig` (typed from `@qlik/api/auth`) to
  `QlikEmbedConfig.Provider` and `auth.setDefaultHostConfig`.
- **Svelte:** call `auth.setDefaultHostConfig` and keep the
  runtime-module-loader call, with the same object.
- **Impersonation / Web client:** the browser host config carries
  `getAccessToken`, so every `@qlik/api` call runs as that user. On the
  backend, build a per-request host config with the user's `userId` and
  `noCache: true`. Admin work uses a separate server-only client.
- **Several tenants:** `auth.registerHostConfig("<NAME>", config)` and
  `host-config="<NAME>"` on each `<qlik-embed>`.
- **Anonymous:** keep pages to embeds and ref API reads; which REST APIs an
  anonymous user may call hasn't been checked.

## Templates

### Web components: an embed plus your own list (CDN)

The import map replaces the `<script src=...embed-web-components...>` tag and
its `data-*` attributes.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sales</title>
    <script type="importmap">
      {
        "imports": {
          "@qlik/embed-web-components": "https://cdn.jsdelivr.net/npm/@qlik/embed-web-components@1/dist/index.min.js",
          "@qlik/api": "https://cdn.jsdelivr.net/npm/@qlik/api@2/index.js"
        }
      }
    </script>
    <script type="module">
      import "@qlik/embed-web-components";
      import { auth } from "@qlik/api";

      auth.setDefaultHostConfig({
        host: "https://<TENANT>.<REGION>.qlikcloud.com",
        authType: "oauth2",
        clientId: "<OAUTH_SPA_CLIENT_ID>",
        redirectUri: "https://<YOUR_APP_ORIGIN>/oauth-callback.html",
        accessTokenStorage: "session",
        autoRedirect: true,
      });
    </script>
    <style>
      .embed { width: 100%; height: 480px; }
      .embed qlik-embed { display: block; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <ol id="top-regions"></ol>
    <div class="embed">
      <qlik-embed ui="analytics/chart" app-id="<APP_ID>" object-id="<OBJECT_ID>"></qlik-embed>
    </div>
    <script type="module" src="./top-regions.js"></script>
  </body>
</html>
```

`top-regions.js`: a hypercube on the embed's own doc (ref API), re-read on
`changed`, so it follows the embed's selections and reloads.

```js
await customElements.whenDefined("qlik-embed");
const embed = /** @type {any} */ (document.querySelector("qlik-embed"));
/** @type {import("@qlik/api/qix").Doc} */
const doc = await (await embed.getRefApi()).getDoc();

// Top 5 regions by total sales, highest first, no "Others" row.
const cube = await doc.createSessionObject({
  qInfo: { qType: "top-regions" },
  qHyperCubeDef: {
    qDimensions: [
      {
        qDef: {
          qFieldDefs: ["Region"],
          qFieldLabels: ["Sales region"],
          qSortCriterias: [{ qSortByExpression: -1, qExpression: { qv: "Sum(Sales)" } }],
        },
        qOtherTotalSpec: {
          qOtherMode: "OTHER_COUNTED",
          qOtherCounted: { qv: "5" },
          qSuppressOther: true,
          qOtherSortMode: "OTHER_SORT_DESCENDING",
        },
      },
    ],
    qMeasures: [{ qLibraryId: "<MASTER_MEASURE_ID>" }],
    qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: 2, qHeight: 5 }],
  },
});

async function render() {
  const layout = await cube.getLayout();
  const rows = layout.qHyperCube?.qDataPages?.[0]?.qMatrix ?? [];
  document.getElementById("top-regions")?.replaceChildren(
    ...rows.map(([region, sales]) => {
      const li = document.createElement("li");
      li.textContent = `${region.qText}: ${sales.qText}`;
      return li;
    }),
  );
}

cube.on("changed", render);
await render();
```

Without an embed, drop the embed import and tag and open the app instead:
`const doc = await qix.openAppSession({ appId: "<APP_ID>" }).getDoc()` (with
`import { qix } from "@qlik/api"`), and close the session on unload.

### Web components with npm and a bundler

```ts
// src/config.ts: import first, before anything talks to Qlik.
import { auth } from "@qlik/api";

auth.setDefaultHostConfig({
  authType: "oauth2",
  host: import.meta.env.VITE_QLIK_HOST,
  clientId: import.meta.env.VITE_QLIK_CLIENT_ID,
  redirectUri: `${location.origin}/oauth-callback.html`,
  accessTokenStorage: "session",
  autoRedirect: true,
});
```

```ts
// src/main.ts: the embeds pick up the same host config, no data-* tag.
import "./config";
import "@qlik/embed-web-components";
```

Add `oauth-callback.html` (Vite fills `data-host="%VITE_QLIK_HOST%"`) as a
second `build.rollupOptions.input`. The package has no type declarations:

```ts
// src/qlik-embed.d.ts
import type { Doc, GenericObject } from "@qlik/api/qix";

declare module "@qlik/embed-web-components";

declare global {
  interface QlikEmbedElement extends HTMLElement {
    getRefApi(): Promise<{ getDoc(): Promise<Doc>; getObject(): Promise<GenericObject> }>;
  }
}

export {};
```

### React

`src/qlik.ts` (replaces the one in `frameworks.md`):

```ts
import { auth } from "@qlik/api";
import type { HostConfig } from "@qlik/api/auth";

export const hostConfig: HostConfig = {
  authType: "oauth2",
  host: "https://<TENANT>.<REGION>.qlikcloud.com",
  clientId: "<OAUTH_SPA_CLIENT_ID>",
  redirectUri: `${window.location.origin}/oauth-callback.html`,
  accessTokenStorage: "session",
  autoRedirect: true,
};

auth.setDefaultHostConfig(hostConfig);
```

`src/useHyperCube.ts`:

```ts
import { useEffect, useState } from "react";
import { qix } from "@qlik/api";
import type { HyperCubeDef, NxCellRows } from "@qlik/api/qix";

// Pass a module-level `def`, or the object is re-created every render.
export function useHyperCube(appId: string, def: HyperCubeDef) {
  const [rows, setRows] = useState<NxCellRows[]>([]);
  const [error, setError] = useState<unknown>();

  useEffect(() => {
    let cancelled = false;
    const session = qix.openAppSession({ appId });
    let destroyObject = () => {};

    (async () => {
      const doc = await session.getDoc();
      const obj = await doc.createSessionObject({ qInfo: { qType: "host-app-cube" }, qHyperCubeDef: def });
      const read = async () => {
        const layout = await obj.getLayout();
        if (!cancelled) setRows(layout.qHyperCube?.qDataPages?.[0]?.qMatrix ?? []);
      };
      obj.on("changed", read);
      destroyObject = () => void doc.destroySessionObject(obj.id);
      await read();
    })().catch((err) => {
      if (!cancelled) setError(err);
    });

    return () => {
      cancelled = true;
      destroyObject();
      void session.close();
    };
  }, [appId, def]);

  return { rows, error };
}
```

Use it next to `<QlikEmbed>` inside the same `QlikEmbedConfig.Provider`:
`const { rows } = useHyperCube(APP_ID, topRegions)`, with `topRegions` the
`qHyperCubeDef` above as a module-level constant. Svelte follows the same
pattern in `onMount`, returning the clean-up.

### Svelte

`src/main.ts` (replaces the one in `frameworks.md`):

```ts
import { mount } from "svelte";
import { auth } from "@qlik/api";
import type { HostConfig } from "@qlik/api/auth";
import { importRuntimeModule } from "@qlik/runtime-module-loader";
import App from "./App.svelte";

const hostConfig: HostConfig = {
  authType: "oauth2",
  host: "https://<TENANT>.<REGION>.qlikcloud.com",
  clientId: "<OAUTH_SPA_CLIENT_ID>",
  redirectUri: `${window.location.origin}/oauth-callback.html`,
  autoRedirect: true,
};

auth.setDefaultHostConfig(hostConfig); // @qlik/api
importRuntimeModule("auth@v1", hostConfig).then((m) => m.setDefaultHostConfig(hostConfig)); // <QlikEmbed>

export default mount(App, { target: document.getElementById("app")! });
```

### An embed already on the page (ref API)

The embed's ref API works in the embed's own engine session, so the host app
can read its data and drive its app without opening another session or adding
another embed. `getRefApi()` resolves once the embed has loaded.

| UI | Ref API |
|---|---|
| `analytics/chart` | `getDoc()` (the app), `getObject()` (the rendered chart) |
| `analytics/sheet` | `getDoc()`, `getObject()` (the sheet; for one of its charts, `doc.getObject("<OBJECT_ID>")`) |
| `analytics/field` | `getDoc()`, `getField()` |
| `analytics/selections` | `getDoc()` |
| `classic/app`, `classic/chart` | none: use `qix.openAppSession` |

The data behind an embedded chart (by object ID or on the fly), re-read when
selections or data change. For `<qlik-embed id="chart" ui="analytics/chart" ...>`
and a `<tbody id="chart-rows">`:

```js
await customElements.whenDefined("qlik-embed");
const chart = /** @type {any} */ (document.getElementById("chart"));
/** @type {import("@qlik/api/qix").GenericObject} */
const obj = await (await chart.getRefApi()).getObject();

async function readRows() {
  const size = (await obj.getLayout()).qHyperCube?.qSize;
  if (!size?.qcx) return [];
  const [page] = await obj.getHyperCubeData("/qHyperCubeDef", [
    { qTop: 0, qLeft: 0, qWidth: size.qcx, qHeight: Math.min(size.qcy ?? 0, Math.floor(10000 / size.qcx)) },
  ]);
  return (page?.qMatrix ?? []).map((row) => row.map((cell) => cell.qText ?? ""));
}

async function render() {
  const rows = await readRows();
  document.getElementById("chart-rows")?.replaceChildren(
    ...rows.map((cells) => {
      const tr = document.createElement("tr");
      for (const text of cells) tr.appendChild(Object.assign(document.createElement("td"), { textContent: text }));
      return tr;
    }),
  );
}

obj.on("changed", render);
await render();
```

- This reads charts with a straight hypercube (bar, line, table, KPI, ...).
  A pivot table (`qMode: "P"`) needs `getHyperCubePivotData`. One request
  returns at most 10,000 cells; page through larger results.
- Don't change the chart's properties through `obj`; use
  `override-properties___json` for presentation changes.

React: pass a state setter as the `ref`. The embed sets it once its API has
loaded, which re-renders the component with it:

```tsx
import { useEffect, useState } from "react";
import { QlikEmbed, type QlikEmbedRefApi } from "@qlik/embed-react";

export function ChartWithRows({ appId, objectId }: { appId: string; objectId: string }) {
  const [api, setApi] = useState<QlikEmbedRefApi<"analytics/chart"> | null>(null);
  const [rows, setRows] = useState<string[][]>([]);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    let stop = () => {};
    (async () => {
      const obj = await api.getObject();
      const read = async () => {
        const size = (await obj.getLayout()).qHyperCube?.qSize;
        if (!size?.qcx) return;
        const [page] = await obj.getHyperCubeData("/qHyperCubeDef", [
          { qTop: 0, qLeft: 0, qWidth: size.qcx, qHeight: Math.min(size.qcy ?? 0, Math.floor(10000 / size.qcx)) },
        ]);
        if (!cancelled) setRows((page?.qMatrix ?? []).map((r) => r.map((c) => c.qText ?? "")));
      };
      obj.on("changed", read);
      stop = () => obj.removeListener("changed", read);
      await read();
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [api]);

  const selectNorth = async () => {
    const doc = await api?.getDoc();
    await (await doc?.getField("Region"))?.selectValues([{ qText: "North" }]);
  };

  return (
    <>
      <div style={{ width: "100%", height: 480 }}>
        <QlikEmbed ui="analytics/chart" appId={appId} objectId={objectId} ref={setApi} />
      </div>
      <button onClick={selectNorth} disabled={!api}>North only</button>
      <table>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>{cells.map((text, j) => <td key={j}>{text}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
```

Selections, bookmarks, sheets, and the host app's own KPIs through the doc.
Every embed on the same app and `identity` follows the selections, so a
host-app filter doesn't need an `analytics/field` embed:

```js
import { qix } from "@qlik/api";

await customElements.whenDefined("qlik-embed");
const chart = /** @type {any} */ (document.getElementById("chart"));
/** @type {import("@qlik/api/qix").Doc} */
const doc = await (await chart.getRefApi()).getDoc();

/** @param {string[]} regions */
export async function selectRegions(regions) {
  const field = await doc.getField("Region");
  await field.selectValues(regions.map((qText) => ({ qText })));
}
export const clearAll = () => doc.clearAll();

const bookmarks = await doc.getBookmarkList();
await doc.applyBookmark(bookmarks[0]?.qInfo?.qId ?? "");
const sheetTitles = (await doc.getSheetList()).map((s) => s.qData?.title);

// A host-app KPI from the same session: a session object on the embed's doc.
// Destroy it when done; don't close the doc, it belongs to the embed.
const kpi = await doc.createSessionObject({
  qInfo: { qType: "host-kpi" },
  qHyperCubeDef: { qMeasures: [{ qDef: { qDef: "Sum(Sales)" } }], qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: 1, qHeight: 1 }] },
});
const total = (await kpi.getLayout()).qHyperCube?.qDataPages?.[0]?.qMatrix?.[0]?.[0]?.qText;
await doc.destroySessionObject(kpi.id);

// No embed of that app on the page: open it instead.
const other = await qix.openAppSession({ appId: "<OTHER_APP_ID>" }).getDoc();
await (await other.getField("Region")).select("North");
```

### Export: Excel, PNG, PDF, and PowerPoint

All exports go through the Reports API: build a report request, submit it,
poll its status, and download the output. The request says what to export
(a chart's data, a chart image, a sheet, or several sheets), with which
selections, and in which format. Source:
<https://qlik.dev/embed/reports/reporting-api-samples/>.

| Export | `type` | Template | `output.type` |
|---|---|---|---|
| A chart's data | `sense-data-1.0` | `senseDataTemplate` (`id`: object ID) | `xlsx` |
| A chart as an image or page | `sense-image-1.0` | `senseImageTemplate` (`visualization`: `id`, `widthPx`, `heightPx`) | `image` (PNG), `pdf`, `pptx` |
| A sheet | `sense-sheet-1.0` | `senseSheetTemplate` (`sheet.id`) | `pdf`, `pptx` |
| Several sheets or charts in one file | `composition-1.0` | `compositionTemplates` | `pdfcomposition`, `pptxcomposition` |

For a chart embedded with `id="chart"` (by object ID). The ref API gives the
app, and a temporary bookmark carries the user's current selections:

```js
import { reports, tempContents } from "@qlik/api";

await customElements.whenDefined("qlik-embed");
const chart = /** @type {any} */ (document.getElementById("chart"));
/** @type {import("@qlik/api/qix").Doc} */
const doc = await (await chart.getRefApi()).getDoc();
const appId = chart.getAttribute("app-id") ?? "";
const objectId = chart.getAttribute("object-id") ?? "";
/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @type {import("@qlik/api/reports").PdfOutput} */
const pdfPage = { size: "A4", orientation: "A", resizeType: "autofit", align: { horizontal: "center", vertical: "middle" } };

// The user's current selections (and the chart's patches) for the report.
/** @param {string[]} objectIds */
async function currentSelections(objectIds) {
  // Arguments by position: @qlik/api drops a single options object's patch list.
  const id = await doc.createTemporaryBookmark({ qIncludeVariables: true, qIncludeAllPatches: true }, objectIds);
  return { selectionType: /** @type {const} */ ("temporaryBookmarkV2"), temporaryBookmarkV2: { id: String(id) } };
}

/** @returns {Promise<import("@qlik/api/reports").ReportRequest>} */
async function chartData() {
  return {
    type: "sense-data-1.0",
    senseDataTemplate: { appId, id: objectId, ...(await currentSelections([objectId])) },
    output: { outputId: "chart-data", type: "xlsx" },
  };
}

/** @param {"png" | "pdf"} format @returns {Promise<import("@qlik/api/reports").ReportRequest>} */
async function chartImage(format) {
  const { width, height } = chart.getBoundingClientRect(); // the size the user sees
  return {
    type: "sense-image-1.0",
    senseImageTemplate: {
      appId,
      visualization: { id: objectId, type: "visualization", widthPx: Math.round(width), heightPx: Math.round(height) },
      ...(await currentSelections([objectId])),
    },
    output:
      format === "png"
        ? { outputId: "chart", type: "image", imageOutput: { outFormat: "png", outDpi: 96, outZoom: 1 } }
        : { outputId: "chart", type: "pdf", pdfOutput: pdfPage },
  };
}

/** @param {string} sheetId @returns {Promise<import("@qlik/api/reports").ReportRequest>} */
async function sheetPdf(sheetId) {
  return {
    type: "sense-sheet-1.0",
    senseSheetTemplate: { appId, sheet: { id: sheetId }, ...(await currentSelections([])) },
    output: { outputId: "sheet", type: "pdf", pdfOutput: pdfPage },
  };
}

/** @param {string[]} sheetIds @returns {Promise<import("@qlik/api/reports").ReportRequest>} */
async function sheetsPdf(sheetIds) {
  const selections = await currentSelections([]);
  return {
    type: "composition-1.0",
    compositionTemplates: sheetIds.map((id) => ({ type: "sense-sheet-1.0", senseSheetTemplate: { appId, sheet: { id }, ...selections } })),
    output: { outputId: "sheets", type: "pdfcomposition", pdfCompositionOutput: { pdfOutputs: sheetIds.map(() => pdfPage) } },
  };
}

// Submit, poll, and download.
/** @param {import("@qlik/api/reports").ReportRequest} request @param {string} filename */
async function runReport(request, filename) {
  const { headers } = await reports.createReport(request);
  const reportId = headers.get("content-location")?.match(/reports\/([^/]+)\/status/)?.[1];
  if (!reportId) throw new Error("No report ID returned");
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    // noCache: @qlik/api caches GETs in the page, so a poll would see the first status forever.
    const { data: status } = await reports.getReportStatus(reportId, { noCache: true });
    if (status.status === "failed" || status.status === "aborted") throw new Error(`Export ${status.status}`);
    if (status.status !== "done") continue;
    const { data: outputs } = await reports.getReportOutputs(reportId, {});
    const tempFileId = outputs.data[0]?.location?.split("/").pop()?.split("?")[0];
    if (!tempFileId) throw new Error("No output location");
    const file = await tempContents.downloadTempFile(tempFileId, { inline: "1" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(/** @type {Blob} */ (file.data));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  throw new Error("Export timed out");
}

/** @param {string} id @param {() => Promise<void>} run */
const onClick = (id, run) => document.getElementById(id)?.addEventListener("click", () => run().catch((err) => console.error(err)));
onClick("export-xlsx", async () => runReport(await chartData(), "chart-data.xlsx"));
onClick("export-png", async () => runReport(await chartImage("png"), "chart.png"));
onClick("export-pdf", async () => runReport(await chartImage("pdf"), "chart.pdf"));
onClick("export-sheet", async () => runReport(await sheetPdf("<SHEET_ID>"), "sheet.pdf"));
```

- **Selections:** the temporary bookmark carried the user's selections into
  all five exports in testing (Excel, PNG, chart PDF, sheet PDF, and a
  two-sheet composition). The documented alternative is `selectionsByState` (`{ "$": [{ fieldName, values: [{ text }
  | { number, isNumeric: true }], defaultIsNumeric }] }`); put any
  always-one-selected field first. `selectionStrategy` decides whether bad
  selections fail the report (default: `ignoreErrorsReturnDetails`).
- **Charts on the fly:** `sense-data-1.0` doesn't support them ("Visualizations
  created 'on the fly' are not supported"). `sense-image-1.0` lists
  `visualization.type: "sessionobject"` with a JSON definition as `id`, but
  the spec doesn't show the format; say so, or save the chart first.
- **PDF layout:** `size` (`A1`–`A6`, `Letter`, `Legal`, `Tabloid`; default
  A4), `orientation` (`L`, `P`, `A` auto), `resizeType` (`autofit`, `fit` with
  `resizeData.fit` such as `"27.7cmx19cm"`, `none`). Sheets default to their
  own size when `widthPx` and `heightPx` are left out.
- **Limits:** the output file expires after an hour (`meta.outputTtl`), and a
  report fails after 10 minutes by default (`meta.exportDeadline`, ISO 8601,
  up to 2 hours).
- Don't use the engine's `exportData`: it isn't supported in Qlik Cloud.
- Preview mode's context menu already offers download with no code; build
  buttons when the host app needs its own UI, a fixed format, or several
  sheets in one file.

### Look up IDs by name

```js
import { items, spaces } from "@qlik/api";

const { data: spaceList } = await spaces.getSpaces({ name: "<SPACE_NAME>" });
const { data: found } = await items.getItems({
  resourceType: "app",
  name: "<APP_NAME>",
  spaceId: spaceList.data?.[0]?.id,
});
const appId = found.data[0]?.resourceId; // the app GUID, not the item ID
```

This takes the first match, so recommend unique names within a space.

### Backend (impersonation and Web client)

```ts
import express, { type NextFunction, type Request, type Response } from "express";
import { auth, qix } from "@qlik/api";
import type { HostConfig } from "@qlik/api/auth";

const qlikConfig = {
  authType: "oauth2",
  host: process.env.QLIK_TENANT_URL,
  clientId: process.env.QLIK_OAUTH_CLIENT_ID ?? "",
  clientSecret: process.env.QLIK_OAUTH_CLIENT_SECRET,
  scope: "user_default",
} as const;

type SignedInRequest = Request & { user?: { qlikUserId: string } };
declare function requireSignedInUser(req: Request, res: Response, next: NextFunction): void; // the app's own middleware

const asUser = (req: SignedInRequest): HostConfig => ({ ...qlikConfig, userId: req.user!.qlikUserId, noCache: true });

const app = express();

app.post("/qlik/access-token", requireSignedInUser, async (req: SignedInRequest, res) => {
  try {
    res.send(await auth.getAccessToken({ hostConfig: asUser(req) }));
  } catch {
    res.status(401).send("No access");
  }
});

// A KPI computed on the server, as the signed-in user.
app.get("/api/kpi/total-sales", requireSignedInUser, async (req: SignedInRequest, res) => {
  const session = qix.openAppSession({ appId: "<APP_ID>", hostConfig: asUser(req) });
  try {
    const doc = await session.getDoc();
    res.json({ totalSales: await doc.evaluate("Sum(Sales)") });
  } catch {
    res.status(502).send("Qlik request failed");
  } finally {
    await session.close();
  }
});
```

For REST as the user, `createQlikApi({ hostConfig: asUser(req) })` returns
every module bound to that config.

## Chart from an analysis as raw data (Option C)

| Analysis (MCP) | `qHyperCubeDef` |
|---|---|
| dimension `{field, label}` | `qDimensions: [{ qDef: { qFieldDefs: ["<field>"], qFieldLabels: ["<label>"] } }]` |
| dimension `{libraryId}` | `qDimensions: [{ qLibraryId: "<id>" }]` |
| measure `{expression, label}` | `qMeasures: [{ qDef: { qDef: "<expression>", qLabel: "<label>" } }]` |
| measure `{libraryId}` | `qMeasures: [{ qLibraryId: "<id>" }]` |
| sort by measure, limit N | the same `qSortCriterias` and `qOtherTotalSpec` dimension object (`resource-discovery.md`) |
| `stateName` | `qStateName` |

Unlike a chart on the fly, measures go in `qMeasures` and master items take no
`type`. `qInitialDataFetch` must cover every column (`qWidth`) and row
(`qHeight`); one request returns at most 10,000 cells.

## Finding the API behind a Qlik Cloud feature

When the user wants something Qlik Cloud's own UI does (alert, share,
comment) next to an embed:

1. **Look in `@qlik/api`**: `node_modules/@qlik/api/<api>.d.ts`, and the
   matching qlik.dev API reference. qlik.dev pages can lag the package.
2. **If unclear which calls the feature uses**, ask the user to record the
   Qlik UI (developer tools → Network → Fetch/XHR, filter `/api/v1/`), with
   emails and IDs removed. It shows which documented endpoints to use; it isn't
   a payload to copy.
3. **Use only documented behaviour** (qlik.dev reference and `@qlik/api`
   typings). If a call appears only in the UI's traffic, tell the user there's
   no public API for that step and suggest it as a feature request. Where the
   spec is silent, say so.
4. **Test** with something that can't notify anyone, then delete it.
5. **Say where each option comes from:** the server, the app (choices the Qlik
   UI hard-codes), or the embed.

## Sessions and gotchas

- Same app and `identity` as an embed: one engine session, selections shared.
  A different `identity` is isolated. `withoutData: true` needs its own
  `identity`.
- Close what you open (`doc.destroySessionObject`, `session.close()`). Don't
  close the ref API's `doc`; it belongs to the embed.
- REST calls resolve to `{ status, headers, data }`; lists put the array in
  `data.data`. Status 300+ throws.
- GETs are cached in the page: pass `{ noCache: true }` for a fresh read,
  and always when polling (a cached status never changes).
- Array query parameters go comma-separated (what `@qlik/api` sends). Don't
  hand-roll `fetch`: it needs its own auth and a CSRF header for writes.
- Rate limits are per user: `429` with `Retry-After`
  (<https://qlik.dev/apis/rest/rate-limiting/>). Poll every few seconds.
