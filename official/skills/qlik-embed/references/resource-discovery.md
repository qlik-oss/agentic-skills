# Resource discovery

Source: <https://qlik.dev/embed/foundational-knowledge/find-ids/>

## IDs

| Resource | Format | Notes |
|---|---|---|
| App | GUID (`b0702f9b-46a3-46ff-8c8e-3a5f83a9b898`) | The **resource ID**. A 24-char hex catalog item ID can't be embedded. |
| Sheet, chart, bookmark | Short ID (`NHnMB`) or GUID | Unique only within the app. |
| Field | Field name | `analytics/field` `field-id`. |
| Master item | Library ID | `analytics/field` `library-id` + `type`. |

## With the Qlik MCP server

1. `qlik_search` (`resourceType="app"`, the app name). If several match, show
   name, space, and owner, and ask. Check the `id` is a GUID.
2. `qlik_list_sheets(appId)`, then `qlik_get_sheet_details(appId, sheetId)`
   for each object's ID, type, and title.
3. `qlik_get_chart_info(appId, chartId)` for one chart.
4. Filters and definitions: `qlik_get_fields`, `qlik_list_dimensions`,
   `qlik_list_measures`. Starting state: `qlik_list_bookmarks`,
   `qlik_get_current_selections`.

Keep searches narrow. Confirm with the user before generating code.

## Manual lookup

- **App ID:** the GUID after `/sense/app/` in the URL.
- **Sheet ID:** the value after `/sheet/` in the URL.
- **Chart ID:** chart **…** → **Share** → **Embed** → **Object ID**, or append
  `/options/developer` to the sheet URL, then chart **…** → **Developer**.
- **Bookmark ID:** Assets → Bookmarks → **…** → **Copy link**, after
  `/bookmark/`.

IDs that differ per environment can be looked up by name at runtime ("Look up
IDs by name" in `qlik-api.md`).

## Rebuilding a chart from an analysis

MCP session objects (`qlik_create_data_object`) live in the agent's engine
session and can't be embedded by ID. Rebuild the definition.

### Option A: chart on the fly (no write)

Source: <https://qlik.dev/embed/qlik-embed/customize/qlik-embed-custom-dimensions-and-measures/>

| Analysis (MCP) | `analytics/chart` |
|---|---|
| `chartType` | `type` (see `ui-types-and-parameters.md`). `_calc` has no visual: ask. `heatmap`: use Option B. |
| dimension `{field, label}` | `{"qDef":{"qFieldDefs":["<field>"],"qFieldLabels":["<label>"]}}` |
| dimension `{libraryId}` | `{"qLibraryId":"<id>","type":"dimension"}`. Not the `"[Title]"` string: it's evaluated as an expression. |
| measure `{expression, label}` | `{"qDef":{"qLabel":"<label>","qDef":"<expression>"}}` |
| measure `{libraryId}` | `{"qLibraryId":"<id>","type":"measure"}` (master measures can't be referenced by name) |
| `stateName` | `state-name` |

Rules:

- Full objects go in **one ordered array** in `dimensions`: dimensions first,
  then measures. `measures` only takes expression strings.
- Don't set `properties` with a `qHyperCubeDef`: its dimensions get prepended.
- In HTML, set JSON from script after `customElements.whenDefined("qlik-embed")`
  (template in `frameworks.md`), or wrap it in single quotes.
- React types declare `dimensions` as `string[]`; full objects need a cast.

**Sort and top-N** go on the dimension object:

```json
{
  "qDef": {
    "qFieldDefs": ["Region"],
    "qFieldLabels": ["Sales region"],
    "qSortCriterias": [{ "qSortByExpression": -1, "qExpression": { "qv": "Sum(Sales)" } }]
  },
  "qOtherTotalSpec": {
    "qOtherMode": "OTHER_COUNTED",
    "qOtherCounted": { "qv": "5" },
    "qSuppressOther": true,
    "qOtherSortMode": "OTHER_SORT_DESCENDING"
  }
}
```

`qSortByExpression: 1` is ascending (bottom N); `qSuppressOther: false` keeps
an "Others" bar. Measure modifiers (accumulation, moving average) aren't
covered: prefer Option B. Reproduce selections with
`<qlik-initial-selections>` or a bookmark.

### Option B: save as a chart (writes to the app)

1. Get explicit approval, naming the app and sheet. The user needs edit rights;
   published base sheets usually aren't editable.
2. `qlik_add_chart(appId, sheetId, chartType, title, dimensions, measures, sort, limit)`.
3. `qlik_get_sheet_details` for the new object ID, then embed it with
   `analytics/chart`.

### Option C: raw data (no write)

A hypercube session object with `@qlik/api`, rendered by the host app
(`qlik-api.md`).
