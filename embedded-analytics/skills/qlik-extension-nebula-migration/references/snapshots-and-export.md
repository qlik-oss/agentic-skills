# Snapshots, export, printing

Two different things share the word "export": the `support` flags on the extension, and the product features (snapshots, export to image/PDF/PowerPoint/data, reporting) that use them. Keep the flags, and set expectations about the features.

## `support` flags

| Flag | Default | Meaning |
|---|---|---|
| `snapshot` | false | Object can be included in a snapshot / story |
| `export` | false | Object can be exported to image/PDF and story PPT/PDF |
| `exportData` | true | Data export |
| `viewData` | false | "View data" available |
| `sharing` | (scaffold sets false) | Appears in the scaffold; no Extension API reference entry, copy the old value if present |

Copy the old values into `ext.support`. Each can be a function of the layout. Only turn `snapshot: true` on if the chart renders from the layout alone (see below). The scaffold's default has `export: true`; keep the *old* value instead.

## Qlik Cloud limits (migration does not change them)

As documented in October 2026 (check the Extension API page and the Qlik support article before relying on this), qlik.dev states that extensions in Qlik Cloud support only data export to XLSX (when the object has a hypercube) and that export to image, PDF and PowerPoint is not supported for extensions. A Qlik support article also states that third-party extensions cannot be exported in Qlik Cloud Analytics. On client-managed, image, PDF and PowerPoint export work, but fail for extensions that use external resources or undocumented modules. **Tell the user that migrating does not restore export on Qlik Cloud**, and list it in the migration report. Do not promise otherwise from the `export: true` flag.

## Snapshots

Legacy members and their nebula replacement:

| Legacy | nebula.js |
|---|---|
| `support.snapshot` | `ext.support.snapshot` |
| `setSnapshotData(snapshotLayout)` | `onTakeSnapshot(async (layoutCopy) => { ...; return layoutCopy; })` |
| `backendApi.isSnapshot()` | `layout.snapshotData` exists |
| `snapshot: { canTakeSnapshot }` (old form) | `ext.support.snapshot` |

Pattern used by sn-org-chart: store what the chart needs to redraw (view state, data it fetched beyond the first page) in `snapshotLayout.snapshotData`, and have the render path read `layout.snapshotData` first:

```js
import { onTakeSnapshot, useLayout } from '@nebula.js/stardust';

component() {
  const layout = useLayout();
  const viewState = /* e.g. current zoom */;
  onTakeSnapshot((snapshotLayout) => {
    snapshotLayout.snapshotData = { ...snapshotLayout.snapshotData, viewState };
    return Promise.resolve(snapshotLayout);
  });
  // when layout.snapshotData is present, render from it and do not call the engine
}
```

The snapshot payload the Sense client builds is richer than the plain `onTakeSnapshot` copy, and nebula.js recently added an optional client-style format (a hidden option in nebula.js PR 2247, October 2026), so re-test snapshots on the version you target. A snapshot is stored data, not a live hypercube. Inference, to verify in your host: when `layout.snapshotData` is present, avoid `useModel()` calls and do not rely on selections, and render only from what the layout holds.

## "Finished rendering" for print and export

Legacy code returned `qlik.Promise.resolve()` (or a deferred) from `paint` to tell the print service when drawing was done. nebula has no documented one-to-one replacement. Evidence: the runtime waits for promises created with `usePromise`, so run asynchronous drawing there:

```js
const [, error] = usePromise(() => drawAsync({ element, layout }), [element, layout]);
```

`useRenderState()` returns `{ pending, restore }` for related state. Verify print and export behavior in your host; this is evidence-based, not documented.

## Test checklist (host-specific)

- Take a snapshot, open it, confirm it renders with no engine access.
- Export data to XLSX (Qlik Cloud) and image/PDF (client-managed) and compare with the legacy chart.
- Include the object in a story and in a report if the legacy chart was used there.
