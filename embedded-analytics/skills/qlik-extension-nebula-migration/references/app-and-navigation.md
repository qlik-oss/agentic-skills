# App, fields, variables, navigation, theme

## Contents

- [Edit mode versus analysis mode](#edit-mode-versus-analysis-mode)
- [Property-panel callbacks that need the app](#property-panel-callbacks-that-need-the-app)
- [Fields and selections on the app](#fields-and-selections-on-the-app)
- [Alternate states](#alternate-states)
- [Variables](#variables)
- [Session objects (replaces app.createCube, createList, createGenericObject, createTable, qlik.table)](#session-objects-replaces-appcreatecube-createlist-creategenericobject-createtable-qliktable)
- [Replacing modal dialogs (luiDialog)](#replacing-modal-dialogs-luidialog)
- [Embedding another object](#embedding-another-object)
- [Navigation (sheets, stories)](#navigation-sheets-stories)
- [Theme](#theme)
- [Locale and translations](#locale-and-translations)

Legacy extensions reach the app through `qlik.currApp(this)`, which returns the capability `QApp` wrapper. In nebula, `useApp()` returns the **raw engine `Doc`** (and `useModel()` the raw `GenericObject`, `useGlobal()` the raw `Global`). Method names and promises follow the engine API, not the capability wrappers. Method reference: https://qlik.dev/apis/json-rpc/qix/doc/.

All three hooks may return `undefined` when there is no session. Guard them.

## Edit mode versus analysis mode

Replace `qlik.navigation.getMode()` and host edit-state checks with `useInteractionState()`: `edit` is true in edit mode, `active === false` means interactions are off. Verified in Qlik Cloud (October 2026): a control tied to `interactions.edit === true` was hidden at `.../state/analysis` and shown at `.../state/edit`. Fail safe when the state is unknown. Outside Sense (for example `nebula serve`) `edit` is not true.

## Property-panel callbacks that need the app

Dropdown `options`, `action` and `show` functions in `ext.definition` run in the Sense client and are not hooks, so `useApp()` is not available there. Qlik's own charts receive the app on a callback argument, but where it sits is **not documented**, and in Sense it may be a wrapper rather than a raw engine `Doc`. Log the callback arguments in your host to find it (candidates: the third argument's `app`, `handler.app`). If you need it:

1. Resolve defensively: accept an object that has `createSessionObject`, otherwise look at a documented-nowhere wrapper shape only as a guarded fallback (`app.model`, `app.model.enigmaModel`). Say in MIGRATION.md that this is a guarded fallback; `check-no-host-apis` reports it as a warning.
2. Offer a fallback that does not need it: a free-text field bound to the same property, or a picker rendered inside the chart (which can use `useApp()`).
3. Remember the app the chart last rendered (`useApp()` in `component()`, kept in module state) and use that when the handler has none.
4. Never let an empty list block saving: a typed value must still work.

## Fields and selections on the app

```js
// legacy
qlik.currApp(this).field('Region').selectValues(['EMEA'], false, true);

// nebula
const app = useApp();
const field = await app.getField('Region');
await field.selectValues([{ qText: 'EMEA' }], false, true);   // engine form: array of { qText } / { qNumber }
```

Pitfall: the capability wrapper accepted plain strings in some calls; the engine takes `FieldValue` objects. Check each call against the engine reference.

Prefer `useSelections()` and the object's own hypercube for selections coming from your chart (`selections-and-data.md`). Use field selections only for actions that are not tied to a data cell (for example a button).

## Alternate states

`app.field(name, stateName)` maps to the engine call `Doc.getField(name, stateName)`; keep the state argument. A property-panel dropdown that lists the app's states cannot use `useAppLayout` (no hooks in `ext`): use the guarded callback app above, or a free-text field.

## Variables

Legacy `app.variable.getContent(name)` / `setContent(name, value)` map to the raw engine variable: read `await variable.getLayout()` (`qText`, `qNumber`), write with `setStringValue` / `setNumValue`. `setContent` is deprecated in the capability API; mapping it to `setStringValue` is an inference (tag I), so check numeric and expression values in your host.

```js
const variable = await app.getVariableByName('vSelectedYear');   // GenericVariable
await variable.setStringValue('2025');                           // or setNumValue(...)
const layout = await variable.getLayout();                       // read qText / qNumber
```

## Session objects (replaces `app.createCube`, `createList`, `createGenericObject`, `createTable`, `qlik.table`)

There is no table helper: create a hypercube session object over the fields you need, page it with `getHyperCubeData`, and render `qDataPages` yourself.

```js
const obj = await app.createSessionObject({ qInfo: { qType: 'my-cube' }, qHyperCubeDef: { /* ... */ } });
const layout = await obj.getLayout();
// ... and ALWAYS clean up
return () => app.destroySessionObject(obj.id);   // returned from the useEffect that created it
```

Call `destroySessionObject` on unmount (qlik.dev). Do not open a second connection with `enigma.create`.

## Replacing modal dialogs (`luiDialog`)

`luiDialog`, `luiPopover` and `luiTooltip` are host (Leonardo UI) services. Build the dialog inside your own element (a `<dialog>` with `showModal()` or an absolutely positioned overlay). It cannot cover the Sense page, so the object must be big enough; a full-screen toggle on your own element helps. Close on Escape and restore focus.

## Embedding another object

`app.getObject(id)` / `app.visualization.get(id)` rendered into your element map to `useEmbed().render({ element, id })` (sn-filter-pane). Tested in Qlik Cloud (October 2026) with a tabbed container that embeds other objects: it embedded a nebula table, a nebula variable and an export panel, and a legacy extension embedded the same objects. In early tests the embedded objects showed only their frame and title, with an empty content area, over five page loads; after the embedded extensions were re-uploaded they rendered, and the tabbed container's own code had not changed. The cause of the empty content is unknown. Test embedding in your host after every upload, and report it as host-verified only when content appears.

## Navigation (sheets, stories)

`qlik.navigation.gotoSheet(id)` and friends have no stardust equivalent that works outside Sense. Two optional routes, both Sense-only and both must be guarded:

```js
// in ext(galaxy) or component()
const nav = galaxy.anything?.sense?.navigation;   // getCurrentSheetId and goToSheet are in the 7.6 typings; goToStory, nextSheet, prevSheet, getUrlForSheet are used by Qlik's own charts but are not typed: guard each call with typeof === 'function'
// or, inside component():
const navigation = useNavigation();               // experimental when this was written; check the stardust API reference: getCurrentSheetId, goToSheet
```

If the extension is *about* navigation (a button or menu), document that it works only in Sense and disable the control when `nav` is undefined.

**Sheet lists.** `app.getSheetList()` is not a public engine `Doc` method (Qlik's own charts call it on an app object that Sense supplies, which is host-provided). Use a session object over the app's sheets, and destroy it afterwards:

```js
const list = await app.createSessionObject({
  qInfo: { qType: 'SheetList' },
  qAppObjectListDef: { qType: 'sheet', qData: { title: '/qMetaDef/title', rank: '/rank', thumbnail: '/qMetaDef/thumbnail' } },
});
const layout = await list.getLayout();
const sheets = layout.qAppObjectList.qItems;          // { qInfo: { qId }, qData: { title, rank } }
await app.destroySessionObject(list.id);
```

`getAppObjectList(type, callback)` is likewise a capability-wrapper method, not an engine method. `qAppObjectListDef` covers app objects such as `sheet`, `story` and `masterobject` (set `qType`). Dimensions, measures, variables and bookmarks have their own list definitions (`qDimensionListDef`, `qMeasureListDef`, `qVariableListDef`, `qBookmarkListDef`); fields use `qFieldListDef` (which flags reproduce the legacy `FieldList` is unverified: start with `{}` and report it as inferred); see https://qlik.dev/apis/json-rpc/qix/schemas/.

## Theme

```js
const theme = useTheme();
theme.getStyle('object.myExtension', 'label.name', 'color');
theme.getDataColorPickerPalettes();
theme.getDataColorSpecials().primary;
```

Re-run your effect when `theme.name()` changes. In the property panel use `galaxy.anything.sense?.theme` (guarded). Replaces `app.theme.getApplied()`.

## Locale and translations

`useAppLayout().qLocaleInfo` for number and date formatting. `useTranslator().get(key)` in `component()`; `galaxy.translator.get(key)` in `ext` / `qae`.
