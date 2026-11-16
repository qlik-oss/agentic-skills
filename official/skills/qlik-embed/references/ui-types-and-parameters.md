# qlik-embed UI types and parameters

Sources: <https://qlik.dev/embed/qlik-embed/parameters/>,
<https://qlik.dev/embed/foundational-knowledge/visualizations/>

## Conventions

- Web components use kebab-case attributes (`app-id`); React and Svelte use
  camelCase props (`appId`).
- JSON attributes take a `___json` suffix (`context___json`). In static HTML,
  wrap JSON in single quotes or use relaxed JSON (`"{interactions:{select:false}}"`).
- The element renders at its parent's size: give the parent a height.

## UI types

| UI | Embeds | Key attributes | Notes |
|---|---|---|---|
| `analytics/chart` | One chart, or a chart on the fly | `app-id` + `object-id`, or `app-id` + `type` + `dimensions`/`measures` | Default mode: nebula.js charts only, no context menu. |
| `analytics/sheet` | A sheet's content | `app-id`, `sheet-id` | Default mode: nebula.js charts only. |
| `analytics/field` | Listbox for one field | `app-id` + `field-id`, or `library-id` + `type` | |
| `analytics/selections` | Selections bar | `app-id` | |
| `classic/app` | Full Qlik Sense client | `app-id`, `sheet-id` | Navigation, editing, extensions. Alerts and subscriptions open the Qlik hub. |
| `classic/chart` | One chart, backwards-compatible | `app-id`, `object-id`, optional `iframe="true"` | Existing integrations only. |
| `insights/feed-cards` | Discovery Agent feed | optional `app-id` | Not "a chart from an analysis". |

React: `classic/app` props are `app`, `sheet`, `bookmark`, `select`,
`clearSelections`, not `appId`/`sheetId`.

## Parameters

*(context)* parameters go inside `context___json` (web components) or the
`context` prop (React, Svelte).

| Parameter | analytics/chart | analytics/field | analytics/selections | analytics/sheet | classic/app | classic/chart |
|---|---|---|---|---|---|---|
| `deviceType` *(context)* | ✔ | ✔ | ✔ | ✔ | ✖ | ✖ |
| `disableCellPadding` *(context)* | ✔ | ✔ | ✔ | ✔ | ✖ | ✖ |
| `identity` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `interactions` *(context)* | ✔ | ✔ | ✔ | ✔ | ✖ | ✖ |
| `keyboardNavigation` *(context)* | ✔ | ✔ | ✔ | ✔ | ✖ | ✖ |
| `language` | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ |
| `override-properties___json` | ✔ (needs `preview`) | ✖ | ✖ | ✖ | ✖ | ✖ |
| `preview` | ✔ | ✖ | ✖ | ✔ | ✖ | ✖ |
| `theme` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

- **`identity`**: embeds with the same string share a session and
  selections; different strings are isolated. Blank is the default session.
- **`interactions`**: `{active, passive, select, edit}`, all `true` by
  default. Read-only: `{interactions:{active:false, select:false}}`.
- **`override-properties___json`**: render-time patches to the chart's
  properties (`{title:'New title'}`); the app isn't changed. Patches apply to
  every instance of that object in the session; `{}` clears them.
- **`theme`**: a theme name available on the tenant (e.g. `breeze`).
- **`language`**: `classic/app` only (`en`, `de`, `fr`, `ja`, `zh-CN`, ...).

## Preview mode

`preview="true"` on `analytics/chart` or `analytics/sheet` renders **every
chart type except the write table**: legacy charts (text & image, map),
dashboard and visualization bundle charts, and extensions. It also brings
Qlik Sense themes, the native context menu (exploration, download, view data,
subscribe), and `override-properties___json`. qlik.dev labels it experimental.

```html
<qlik-embed ui="analytics/sheet" app-id="<APP_ID>" sheet-id="<SHEET_ID>" preview="true"></qlik-embed>
<qlik-embed ui="analytics/chart" app-id="<APP_ID>" object-id="<OBJECT_ID>" preview="true"></qlik-embed>
```

React and Svelte: see `frameworks.md` (React needs a cast).

### Which mode for each `type`

MCP tools return engine IDs, and `qlik_list_sheets` and
`qlik_get_sheet_details` can disagree (`gridchart` vs `sn-grid-chart`).

| `type` value(s) | Mode |
|---|---|
| `barchart`, `linechart`, `combochart`, `piechart`, `scatterplot`, `treemap`, `kpi`, `gauge`, `boxplot`, `distributionplot`, `histogram`, `waterfallchart`, `mekkochart`, `bulletchart`/`sn-bullet-chart`, `action-button`/`sn-action-button`, `filterpane`/`listbox`, `table`, `sn-table`, `pivot-table`, `sn-pivot-table`, `container`/`sn-tabbed-container`, `gridchart`/`sn-grid-chart`, `sn-funnel-chart`, `sn-org-chart`, `sn-sankey-chart`, `sn-text`, `sn-shape`, `sn-nlg-chart`, `sn-nav-menu` | Default ✔ |
| `sn-layout-container` | Default only if every nested chart is ✔ |
| `sn-network-chart`, `sn-word-cloud` | Default on `analytics/sheet`; preview on `analytics/chart` |
| `text-image`, `map`, `sn-video-player`, `auto-chart`, any `qlik-*` bundle chart | Preview |
| `writetable`, `sn-writetable` | Unsupported everywhere |
| Anything else | An extension: preview |

When unsure, use preview: its only cost is the native context menu. KPIs need
a UTF-8 page.

### Caveats (observed in testing, not documented)

- Preview-mode embeds render only once scrolled into view; default-mode
  embeds render off-screen too. No per-page limit was seen.
- Charts draw only while the window is painted: a hidden, minimized, or
  covered window shows titles only.
- The second copy of the same Extension API extension on a page drew only its
  title. Embed each extension object once.
- `qlik-embed:ready` also fires for "Unknown chart" and empty tiles: check
  what rendered.
- The download dialog's PDF preview needs HTTPS.

## Chart on the fly (`analytics/chart`)

- `type`: `barchart`, `linechart`, `piechart`, `scatterplot`, `kpi`,
  `combochart`, `treemap`, `pivot-table`, `table`, `sn-table`, and the other
  default ✔ IDs above. No on-the-fly `heatmap` or write table.
- `dimensions`: `["[Field]"]`, or full objects in **one ordered array**,
  dimensions first, then measures (`resource-discovery.md`).
- `measures`: expression strings only (`["=Sum(Sales)"]`).
- `properties`: presentation only; never `qHyperCubeDef`.
- `state-name`: an alternate state that exists in the app.

## Starting state

`<qlik-initial-selections>` (analytics UIs) sets selections for every embed on
that app and `identity`. Master dimensions aren't supported as `name`.

```html
<qlik-initial-selections app-id="<APP_ID>" clear-all>
  <field name="Region" values="North;South"></field>
</qlik-initial-selections>
<qlik-initial-selections app-id="<APP_ID>" bookmark-id="<BOOKMARK_ID>"></qlik-initial-selections>
```

`classic/app`: `sheet-id` (required, or the selection attributes are
ignored), `clear-selections="true"`, `select="[{field:'Region',values:['North']}]"`,
and `bookmark-id` (React: `bookmark`).

## Events and ref API

- `qlik-embed:ready` (React `onReady`); `classic/app` also has
  `qlik-embed:sheet-changed` and `qlik-embed:sheet-ready`.
- `element.getRefApi()` (React: `ref`) → `getDoc()` for the app, `getObject()`
  for the chart or sheet, `getField()` for `analytics/field`. `classic/*` UIs
  have none. Templates in `qlik-api.md` ("An embed already on the page").
