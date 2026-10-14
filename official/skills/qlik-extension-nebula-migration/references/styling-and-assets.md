# Styling, libraries and assets

## CSS

- `css!./style.css` (RequireJS plugin) becomes `import './style.css';` in `src/index.js`. `nebula build` bundles CSS through postcss (also `*.module.css` as CSS modules) and injects it when the extension loads.
- **LESS is not configured.** Convert `.less` to plain CSS (variables, nesting and mixins have to be expanded), or add your own build step. Both qlik-oss migrations converted LESS to CSS.
- There is no shadow DOM, so injected CSS is global to the page. Prefix every class with something unique to the extension (`nebula-barlist-row`, not `row`), or use CSS modules. Never select by element name alone.
- Scope everything to the extension's own root: `element.classList.add('my-ext-root')` and write `.my-ext-root .row`.
- Do not target host classes (`.qv-*`), use host-provided classes (`lui-*` come from the Sense page's Leonardo UI stylesheet), or use `!important` against host styles. See `host-isolation.md`. Re-create the few `lui-*` look-alikes you need in your own CSS.
- **About `import './x.css'`:** `nebula build` injects imported CSS into `document.head` when the extension loads. That is how Qlik's own charts ship styles, and it is acceptable here only because every selector is namespaced to your extension. If you want no global injection at all, keep the CSS in a JS string and append a `<style>` inside the extension's own element (this has been done in practice); both approaches keep the rule that nothing may target host elements. `check-no-host-apis` does not flag the build's injection.
- Never write your own `document.head.appendChild(style)` or `$('head').append(...)`; the checker fails it.

## Colors, fonts, themes

Read them from the active theme, which also covers custom and dark themes:

```js
const theme = useTheme();
const color = theme.getStyle('object.myExtension', 'label.value', 'color');
```

Do not hard-code Qlik's default palette. A `color-picker` in the property panel should take its default from `galaxy.anything.sense?.theme` (guarded), or a fixed fallback.

## Libraries

| Legacy | nebula.js |
|---|---|
| `define(['jquery', ...])` using the host's jQuery | Prefer DOM APIs (`jquery-to-dom.md`). If you keep jQuery, `npm install jquery` and import it so it is bundled (`dependencies`, not `peerDependencies`) |
| host underscore | Native array/object methods, or bundle `lodash-es` |
| `define(['d3'], ...)` with `require.config` paths to a bundled file | `npm install d3` and `import * as d3 from 'd3'` (or specific `d3-*` packages). Check the version the legacy code expects: d3 v3 and v7 have different APIs (`d3.scale.linear()` vs `d3.scaleLinear()`) |
| A vendored `lib/foo.js` copied into the extension | Replace with the npm package at the same major version, or keep the file and `import` it |
| CDN URL in `define` or `require.config` | npm dependency + bundle (`external-resources.md`). Left as is, Qlik Cloud blocks it unless the tenant allows the origin, and the extension may not load at all |

Only `@nebula.js/stardust` is external; everything in `dependencies` is bundled.

### d3 and other libraries written for AMD hosts

- **d3 v3:** use the modular packages and match behavior deliberately. A bundled v3 can also register itself as an AMD module through `define.amd` (not observed in a rollup build, but a hazard on a page that has `define`). Prefer the modern modular packages (`d3-scale`, `d3-selection`, `d3-cloud`, ...). Rewrite API differences deliberately: `d3.scale.linear()` is `scaleLinear()`, `d3.layout.cloud()` is `d3-cloud`, and the v3 `category10/20/20b/20c` palettes no longer exist (copy them as data). A scale with an equal or empty domain, a log scale over zero or negative values, and `interpolateHcl` (small per-channel differences) behave differently between v3 and v4+. Measure the difference you care about instead of assuming parity.
- **Google Charts / other loaders:** a loader that fetches code from a CDN at run time (`google.charts.load`, `gstatic.com`) cannot be bundled from npm and needs a tenant CSP entry (observed: a legacy timeline extension stayed blank on a tenant without one). Either declare the origin and handle load failure, or re-implement (one rebuild drew plain SVG instead).

- **d3-cloud** measures words with its own default font (`serif`); set `.font(...)` to the font you actually draw with, or words overlap (the original and both rebuilds overlapped in Qlik Cloud).

## Styling the legacy code left to the host

Legacy extensions often looked right only because the Sense page supplied styles. Check for and replace these with your own scoped CSS:

- **Table resets:** the host sets `border-collapse: collapse` on tables. A table that gives cells large borders (`border: 10px solid`) looks 50% taller with the default `separate` model. Set `border-collapse` and `border-spacing` yourself.
- **Form controls:** `lui-input`, `lui-select` and `lui-button` fill their container and have a size; plain `<input>` does not. Set width, height and padding.
- **State classes:** the legacy code toggles `selected`/`active` and relies on a host rule for the color. Style your own prefixed state class. Adding visible selection feedback the legacy chart did not have is a reported change, not a blocker.
- **Icon fonts** (Font Awesome, Leonardo UI): embed the glyphs you use as inline SVG or a data-URI font. A data-URI font in the bundle worked (about 170 KB of CSS); rollup injects it with `@font-face`, so give it a private `font-family` name.
- **Page-wide rules:** legacy CSS such as hiding every `.qv-object header` changes other objects; do not port it.

## Untrusted data and HTML

Cell text, field names, URLs and property values are untrusted. Never assign them to `innerHTML`, `outerHTML` or `insertAdjacentHTML`; use `textContent`, `createElement` and `setAttribute`. If the extension must render HTML a user supplied (for example a "raw HTML" option), sanitize it with a bundled library such as DOMPurify with an explicit tag/attribute allow-list, restrict links to `http(s)`, add `rel="noopener noreferrer"` to `target="_blank"` links, and say in MIGRATION.md which markup the legacy version allowed that the new one drops (scripts, iframes, event handlers, `javascript:` and `data:` URLs). `check-no-host-apis` warns on HTML injection sinks. Recipe that worked with DOMPurify: set `ALLOWED_TAGS` and `ALLOWED_ATTR` explicitly, `ALLOWED_URI_REGEXP` to `http(s)` only (the default also allows `mailto:`, `tel:` and `data:` images), add an `afterSanitizeAttributes` hook that forces `rel="noopener noreferrer"` on links, and use `RETURN_DOM_FRAGMENT` to avoid a second `innerHTML`. **Sanitizing changes what existing charts can show** (embedded iframes and inline styles disappear) and `check-compat` cannot see it: report it and ask before recommending the rename.

`text!./template.html` becomes a function that builds elements; never concatenate data into `innerHTML`.

## Images and fonts

- Keep images inside the extension: inline SVG or a `data:` URI (both load in Qlik Cloud; how to turn a file into an importable module is in `external-resources.md`). Only an image too large to inline is worth hosting externally, which needs an `img-src` CSP entry.
- A `preview` image in the `.qext` is the one image `nebula sense` copies; `scripts/check-package.mjs` does not flag it.

## Resize and layout

`resize($element, layout)` becomes an effect depending on `useRect()` (`rect.width`, `rect.height`). Use CSS (flex, grid, percentages) wherever the old code measured and set pixel sizes by hand.
