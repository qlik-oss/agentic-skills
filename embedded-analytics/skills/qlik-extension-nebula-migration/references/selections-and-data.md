# Selections and data access

## Contents

- [Reading data](#reading-data)
- [Selecting values](#selecting-values)
- [Feedback while in a modal selection](#feedback-while-in-a-modal-selection)
- [Pitfalls](#pitfalls)

All of this uses hooks from `@nebula.js/stardust` inside `component()`. Nothing here needs the host page.

## Reading data

The layout carries the initial page. Read it, do not call the engine again:

```js
const layout = useStaleLayout();               // or useLayout()
const rows = layout.qHyperCube?.qDataPages?.[0]?.qMatrix ?? [];
// rows[i][0] = dimension cell { qText, qNum, qElemNumber, qState }, rows[i][1] = first measure cell, ...
```

Mapping: `backendApi.getRowCount()` -> `layout.qHyperCube.qSize.qcy`; `getDimensionInfos()` -> `qDimensionInfo`; `getMeasureInfos()` -> `qMeasureInfo`; `eachDataRow(cb)` -> loop over `qDataPages`.

### Which layout hook

| Hook | Behavior |
|---|---|
| `useLayout()` | Changes whenever the layout changes, including entering and leaving a modal selection (`qSelectionInfo.qInSelections`) |
| `useStaleLayout()` | Same layout, but does not change while the object is in a modal selection. Use it for charts that should not redraw while the user is selecting |

Qlik's own migrations ended up on `useStaleLayout` (sn-network-chart). If you use it, keep your own highlight state so the user still gets feedback (see below).

### Paging beyond the first page

`backendApi.getData(pages)` becomes `model.getHyperCubeData(path, pages)`:

```js
const model = useModel();
useEffect(() => {
  if (!model) return;
  const X = layout.qHyperCube.qSize.qcx;
  const Y = layout.qHyperCube.qSize.qcy;
  const height = Math.floor(10000 / X);                         // stay within 10,000 cells per page
  const pageCount = Math.min(10, Math.ceil(Y / height));        // cap what you fetch
  const pages = Array.from({ length: pageCount }, (_, i) => ({ qLeft: 0, qTop: i * height, qWidth: X, qHeight: height }));
  Promise.all(pages.map((p) => model.getHyperCubeData('/qHyperCubeDef', [p]))).then((result) => { /* render */ });
}, [model, layout]);
```

Do not fetch unbounded data. Pivot (`qMode: 'P'`) and stacked cubes return `qPivotDataPages` / `qStackedDataPages`, a different shape from `qDataPages`; port the reading code, do not reuse the straight-table loop. Other modes: `getHyperCubePivotData`, `getHyperCubeStackData`, `getHyperCubeReducedData`, `getHyperCubeBinnedData`, `getHyperCubeContinuousData`.

## Selecting values

There are two behaviors in the legacy API, and they map to two different nebula patterns.

| Legacy | Behavior | nebula.js |
|---|---|---|
| `this.backendApi.selectValues(dim, values, toggle)` | Instant: applies immediately | `model.selectHyperCubeValues(path, dim, values, toggle)` |
| `this.selectValues(dim, values, toggle)` | Modal: shows the confirm/cancel toolbar | `useSelections()` `begin` + `select` |
| `layout.selectionMode` = `CONFIRM` / `QUICK` | Chooses between the two | A design choice: use modal for CONFIRM, instant for QUICK |

Preserve the old behavior unless the user asks otherwise. The legacy `selectionMode` is a user-visible setting in many extensions; if the old code branched on it, keep a property for it and branch the same way.

### Modal selection

```js
const selections = useSelections();
const interactions = useInteractionState();

async function select(dim, values, toggle = true) {
  if (!selections.isActive()) await selections.begin(['/qHyperCubeDef']);   // array form is the documented one
  return selections.select({ method: 'selectHyperCubeValues', params: ['/qHyperCubeDef', dim, values, toggle] });
}
```

- `selectHyperCubeCells` is the alternative method: `params: [path, [rowIndexes], [colIndexes]]`.
- Confirm and cancel come from the selection toolbar. Listen with `selections.addListener('deactivated', fn)` (fires after confirm and after cancel) and `'cleared'` to reset local highlight state. Always remove the listeners in the effect cleanup.
- Do not select when `interactions.active === false` or `interactions.select === false`; this replaces `noInteraction` / `selectionsEnabled`.
- Legacy `clearSelectedValues()` has no hook. Reset your highlight state from the events above.

### Instant selection

```js
await model.selectHyperCubeValues('/qHyperCubeDef', 0, [qElemNumber], true);
```

Other engine selections (`selectHyperCubeCells`, `rangeSelectHyperCubeValues`, `resetMadeSelections`) are methods on the same model.

### List objects (`qListObjectDef`)

Extensions that bind to a field (filters, inputs) use a list object instead of a hypercube. The layout holds `layout.qListObject.qDataPages[*].qMatrix` (cells with `qText`, `qState`, `qElemNumber`). Page with `model.getListObjectData('/qListObjectDef', pages)`; select with `model.selectListObjectValues('/qListObjectDef', [qElemNumber], toggle)` (instant) or `selections.select({ method: 'selectListObjectValues', params: [...] })` after `selections.begin(['/qListObjectDef'])` (modal); search with `searchListObjectFor` then `acceptListObjectSearch`. The data target path is `/qListObjectDef`.

### Selections on fields, not on the object

`app.field('X').selectValues(...)` becomes `(await app.getField('X')).selectValues(...)` on `useApp()`. See `app-and-navigation.md`.

## Feedback while in a modal selection

With `useStaleLayout()` the layout does not change during a modal selection, so keep the highlight yourself: in a `useState` value, or on the DOM inside your effect (a class toggled on the clicked element; stardust's `useState` re-runs the component):

```js
const [selected, setSelected] = useState([]);
// toggle in your click handler; clear in the 'deactivated' / 'cleared' listeners
```

## Pitfalls

- Hooks run only at the top level of `component()`, never inside a condition, loop or callback, and not in `ext` or `qae`. "Invalid stardust hook call" (an error message in stardust 7.6) means a hook ran elsewhere, or the bundle contains its own copy of `@nebula.js/stardust`; it must stay a `peerDependency`.
- `useModel()` / `useApp()` can be `undefined` when there is no session (for example some embeds and tests). Guard them.
- The old `paint` might have called `self.backendApi.selectValues` from a click handler created on each paint. In nebula, create handlers inside the effect, and remove them when the effect re-runs.
- Selections touch the engine: do not trigger them from `useEffect` without a user action.
- `selections.select()` resolves to a value this skill has not verified; treat a rejection or `false` as "nothing selected" and do not depend on more (that worked in Qlik Cloud).
