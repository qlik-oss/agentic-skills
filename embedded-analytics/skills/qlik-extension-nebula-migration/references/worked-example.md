# Worked example: `BarList`

## Contents

- [0. The legacy extension](#0-the-legacy-extension)
- [1. Scaffold under the side-by-side name](#1-scaffold-under-the-side-by-side-name)
- [2. Stage 1: port with the shim](#2-stage-1-port-with-the-shim)
- [3. Stage 2: idiomatic nebula](#3-stage-2-idiomatic-nebula)
- [4. Drop-in rename](#4-drop-in-rename)

A small extension that lists one dimension with a bar per measure value and selects on click. Built with `@nebula.js/cli` 7.6.0 (current in October 2026); it passed `check-package.mjs` and `check-no-host-apis.mjs` and was not run in a Sense host.

## 0. The legacy extension

`BarList.qext` (id `BarList`, display name "Bar list"), `barlist.css`, and:

```js
define(['jquery', 'qlik', 'css!./barlist.css'], function ($, qlik) {
  'use strict';

  return {
    initialProperties: {
      qHyperCubeDef: {
        qDimensions: [],
        qMeasures: [],
        qInitialDataFetch: [{ qWidth: 2, qHeight: 500 }],
      },
      barColor: '#3b82f6',
    },
    definition: {
      type: 'items',
      component: 'accordion',
      items: {
        dimensions: { uses: 'dimensions', min: 1, max: 1 },
        measures: { uses: 'measures', min: 1, max: 1 },
        sorting: { uses: 'sorting' },
        settings: {
          uses: 'settings',
          items: {
            barColor: { ref: 'barColor', label: 'Bar color', type: 'string', defaultValue: '#3b82f6' },
          },
        },
      },
    },
    support: { snapshot: true, export: true, exportData: true },
    paint: function ($element, layout) {
      var self = this;
      var rows = layout.qHyperCube.qDataPages[0].qMatrix;
      var max = Math.max.apply(null, rows.map(function (r) { return r[1].qNum; }).concat([1]));

      $element.empty().addClass('barlist');
      rows.forEach(function (row) {
        var $row = $('<div class="barlist-row"></div>');
        $row.append($('<span class="barlist-label"></span>').text(row[0].qText));
        $row.append(
          $('<span class="barlist-bar"></span>').css({ width: (row[1].qNum / max) * 100 + '%', background: layout.barColor })
        );
        $row.append($('<span class="barlist-value"></span>').text(row[1].qText));
        $row.on('click', function () {
          self.backendApi.selectValues(0, [row[0].qElemNumber], true);
        });
        $element.append($row);
      });
      return qlik.Promise.resolve();
    },
  };
});
```

`node scripts/inventory.mjs legacy-BarList` reports:

- direct: `ext.initialProperties`, `ext.definition`, `ext.support`, `ext.paint`, `dom.$element` (3), `backendApi.selectValues`, `qlik.Promise`
- rewrite: `lib.jquery` (4), `amd.plugin:css`
- host: `amd.host-dep:jquery`, `amd.host-dep:qlik`

No AngularJS, so a port is feasible. The two host dependencies (`jquery`, `qlik`) must not survive.

## 1. Scaffold under the side-by-side name

The side-by-side id is the original id, split into words, lower-cased, plus `-nebula` (`BarList` -> `bar-list-nebula`).

```bash
node scripts/nebula-id.mjs BarList                                  # bar-list-nebula
npx @nebula.js/cli create bar-list-nebula --picasso none --pkgm npm
cd bar-list-nebula
# package.json: "sense": "nebula sense --meta src/meta.json --output bar-list-nebula"
# src/meta.json: { "name": "Nebula Bar list", "icon": "bar-chart-vertical", "preview": "" }
```

## 2. Stage 1: port with the shim

Goal: a working build with the old code almost untouched. Copy `assets/compat-shim.js` to `src/`, move the old `paint` to `src/legacy-paint.js` with only two edits (jQuery imported from npm instead of the host, `qlik.Promise.resolve()` -> `Promise.resolve()`), copy `barlist.css`, and write the properties, data target and `ext` (section 3 files below).

```bash
npm install jquery@3        # bundled; the host's jQuery is not used
```

`src/legacy-paint.js` is the old `paint` body verbatim, with `import $ from 'jquery'` at the top and `export default function paint($element, layout)` as its signature.

`src/index.js`:

```js
import $ from 'jquery';
import { useElement, useStaleLayout, useModel, useSelections, useInteractionState, useEffect } from '@nebula.js/stardust';
import './barlist.css';
import properties from './object-properties';
import data from './data';
import ext from './ext';
import { createLegacyContext } from './compat-shim';
import legacyPaint from './legacy-paint';

export default function supernova(galaxy) {
  return {
    qae: { properties, data },
    ext: ext(galaxy),
    component() {
      const element = useElement();
      const layout = useStaleLayout();
      const model = useModel();
      const selections = useSelections();
      const interaction = useInteractionState();

      useEffect(() => {
        if (!layout || !model || !selections) return;
        const ctx = createLegacyContext({ layout, model, selections, interaction });
        legacyPaint.call(ctx, $(element), layout);
      }, [element, layout, model, selections, interaction]);
    },
  };
}
```

Checks at this stage (stage-1 flag only):

```bash
npm run build && npm run sense
node scripts/check-package.mjs bar-list-nebula --expect-name bar-list-nebula     # pass
node scripts/check-no-host-apis.mjs . --bundle bar-list-nebula --allow-shim    # pass, with warnings for $element / backendApi
```

Without `--allow-shim` this fails on `dom.$element` and `backendApi.selectValues`: that is the work list for stage 2.

## 3. Stage 2: idiomatic nebula

Remove `compat-shim.js`, `legacy-paint.js` and the jQuery dependency (`npm uninstall jquery`).

`src/object-properties.js` (the old `initialProperties`, plus the `defaultValue` of `barColor` moved here):

```js
const properties = {
  showTitles: true,
  title: '',
  subtitle: '',
  footnote: '',
  qHyperCubeDef: {
    qInitialDataFetch: [{ qWidth: 2, qHeight: 500 }],
  },
  barColor: '#3b82f6',
};

export default properties;
```

`src/data.js` (the old `min`/`max` of the dimension and measure sections):

```js
export default {
  targets: [
    {
      path: '/qHyperCubeDef',
      dimensions: { min: 1, max: 1 },
      measures: { min: 1, max: 1 },
    },
  ],
};
```

`src/ext.js` (the old `definition`; the two data sections became `data: { uses: 'data' }`; `support` copied):

```js
export default function ext(/* galaxy */) {
  return {
    definition: {
      type: 'items',
      component: 'accordion',
      items: {
        data: { uses: 'data' },
        sorting: { uses: 'sorting' },
        settings: {
          uses: 'settings',
          items: {
            barColor: { ref: 'barColor', label: 'Bar color', type: 'string', defaultValue: '#3b82f6' },
          },
        },
      },
    },
    support: { snapshot: true, export: true, exportData: true },
  };
}
```

`src/render.js` (no jQuery, only the element it is given, text via `textContent`):

```js
// Pure DOM rendering. No jQuery, no host page APIs; everything is scoped to the element it is given.
const DEFAULT_COLOR = '#3b82f6';

export default function render({ element, layout, canSelect, onSelect }) {
  const rows = layout.qHyperCube?.qDataPages?.[0]?.qMatrix ?? [];
  const max = Math.max(1, ...rows.map((r) => r[1].qNum));

  element.textContent = '';
  element.classList.add('nebula-barlist');

  rows.forEach((row) => {
    const [dim, measure] = row;
    const item = document.createElement('div');
    item.className = 'nebula-barlist-row';

    const label = document.createElement('span');
    label.className = 'nebula-barlist-label';
    label.textContent = dim.qText;

    const bar = document.createElement('span');
    bar.className = 'nebula-barlist-bar';
    bar.style.width = `${(measure.qNum / max) * 100}%`;
    // Objects saved by the old extension may not have barColor, so fall back instead of trusting the layout.
    bar.style.background = layout.barColor ?? DEFAULT_COLOR;

    const value = document.createElement('span');
    value.className = 'nebula-barlist-value';
    value.textContent = measure.qText;

    item.append(label, bar, value);
    if (canSelect) item.addEventListener('click', () => onSelect(dim.qElemNumber));
    element.append(item);
  });
}
```

`src/index.js`:

```js
import { useElement, useLayout, useModel, useInteractionState, useEffect } from '@nebula.js/stardust';
import './barlist.css';
import properties from './object-properties';
import data from './data';
import ext from './ext';
import render from './render';

const PATH = '/qHyperCubeDef';

export default function supernova(galaxy) {
  return {
    qae: { properties, data },
    ext: ext(galaxy),
    component() {
      const element = useElement();
      const layout = useLayout();
      const model = useModel();
      const interactions = useInteractionState();

      useEffect(() => {
        if (!layout) return;
        const canSelect = !!model && interactions.active !== false && interactions.select !== false;
        render({
          element,
          layout,
          canSelect,
          // instant selection, as the legacy backendApi.selectValues(0, [n], true)
          onSelect: (elemNumber) => model.selectHyperCubeValues(PATH, 0, [elemNumber], true),
        });
      }, [element, layout, model, interactions]);
    },
  };
}
```

`src/barlist.css` (class names prefixed so they do not collide on the page):

```css
.nebula-barlist { overflow: auto; font-family: sans-serif; }
.nebula-barlist-row { display: flex; align-items: center; gap: 8px; padding: 2px 4px; cursor: pointer; }
.nebula-barlist-label { flex: 0 0 30%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nebula-barlist-bar { flex: 1 1 auto; height: 14px; }
.nebula-barlist-value { flex: 0 0 auto; }
```

What changed and why:

| Legacy | Now | Reference |
|---|---|---|
| `define(['jquery','qlik','css!...'])` | ES imports; CSS imported; no host modules | `host-isolation.md` |
| `paint($element, layout)` | `component()` -> `useElement`, `useLayout`, `useEffect` | `api-mapping.md` |
| `$(...)` building DOM | `document.createElement` in `render.js` | `angularjs-rewrite.md` (same approach) |
| `self.backendApi.selectValues(0, [n], true)` (instant) | `model.selectHyperCubeValues(path, 0, [n], true)` (instant, same behavior) | `selections-and-data.md` |
| `qlik.Promise.resolve()` | not needed | |
| `layout.barColor` | `layout.barColor ?? DEFAULT_COLOR`: objects without the property are fine | `compatibility-and-rename.md` |
| Always clickable | `canSelect` from `useInteractionState()` (respects embeds that disable interaction) | `selections-and-data.md` |

The legacy chart selected instantly, so this one does too. Switching to modal selection is a behavior change: use `selections-and-data.md` and put it in the report.

```bash
npm run build && npm run sense
node scripts/check-package.mjs bar-list-nebula --expect-name bar-list-nebula     # pass
node scripts/check-no-host-apis.mjs . --bundle bar-list-nebula                 # pass, no flag
node scripts/check-compat.mjs legacy-BarList .                               # no blocking difference; id differs (expected)
```

## 4. Drop-in rename

`check-compat` found no blocking difference: the one custom property (`barColor`) keeps its `ref`, the data path is still `/qHyperCubeDef`, and the limits are unchanged. So the final step is the rename:

```bash
# package.json: name "BarList"; main "dist/BarList.js"; module "dist/BarList.esm.js";
#               sense script "--output BarList"
# src/meta.json: { "name": "Bar list", "icon": "bar-chart-vertical", "preview": "" }
npm run build && npm run sense
node scripts/check-package.mjs BarList --expect-name BarList     # pass
node scripts/check-compat.mjs legacy-BarList .                    # same id, no blocking difference
```

Output: `BarList/BarList.qext`, `BarList/BarList.js`, `BarList/dist/BarList.js`. Zip the `BarList` folder; `compatibility-and-rename.md` covers replacing the old extension.
