# Replacing jQuery with native DOM

Stage 1 may bundle jQuery (`npm install jquery@3`) so the old `paint` runs unchanged. Stage 2 removes it. Never use the host's jQuery (`host-isolation.md`). Native DOM is the default here; keep a bundled jQuery only when the rewrite is not worth the risk, and say so in the report.

## Rules for every replacement

- Scope all lookups to the extension's element (`useElement()`), never `document`. `$('.row')` becomes `element.querySelectorAll('.row')`.
- Query once per render and keep the references. Do not re-query inside loops or event handlers.
- Build text with `textContent`, never HTML strings from layout or cell data (`dom.html-injection` in `check-no-host-apis`).
- Remove listeners on teardown: return a cleanup function from the hook, or use an `AbortController` signal.

## Cheat-sheet

`el` is the extension element; `$el` was `$element`.

| jQuery | Native |
|---|---|
| `$el` / `$element[0]` | `el` (from `useElement()`) |
| `$el.find('.x')` | `el.querySelectorAll('.x')` (one match: `el.querySelector('.x')`) |
| `$('<div class="a"/>')` | `Object.assign(document.createElement('div'), { className: 'a' })` |
| `$el.empty()` | `el.replaceChildren()` |
| `$el.append(child)` | `el.append(child)` (accepts nodes and strings; a string becomes text, not HTML) |
| `$x.remove()` | `x.remove()` |
| `.text(v)` / `.text()` | `x.textContent = v` / `x.textContent` |
| `.html(v)` | Do not port. Build nodes with `createElement` and `textContent`. If markup is unavoidable, sanitize with a bundled library |
| `.attr('a', v)` / `.removeAttr('a')` | `x.setAttribute('a', v)` / `x.removeAttribute('a')` |
| `.data('k')` / `.data('k', v)` | `x.dataset.k` / `x.dataset.k = v`. Strings only: jQuery also turned `"5"` into `5` and JSON text into an object, so convert explicitly. Keep objects in a `Map` or closure |
| `.val()` | `x.value`. A `<select multiple>` gave an array: use `[...x.selectedOptions].map(o => o.value)` |
| `.prop('checked')` | `x.checked` |
| `.addClass` / `.removeClass` / `.toggleClass` / `.hasClass` | `classList.add` / `.remove` / `.toggle` / `.contains` |
| `.parent()` / `.parents()` / `.children()` / `.next()` / `.prev()` / `.siblings()` / `.index()` | `parentElement` / `closest(sel)` / `children` / `nextElementSibling` / `previousElementSibling` / `[...parent.children].filter(n => n !== x)` / `[...parent.children].indexOf(x)`. **Never climb out of the extension's element**: `$element.parent().parent().prev()` reaches Sense's own header (common in legacy code); there is no replacement, so drop the feature or move it into your element |
| `.is(':checked')`, `:visible`, `:hidden`, `:first`, `:eq(n)` | `x.checked` or `x.matches(':checked')`. `:visible`, `:hidden`, `:first`, `:last`, `:eq()` are jQuery-only: test `x.hidden`/a class, or index into the result list |
| `x.appendTo(target)` / `.prependTo` / `.insertBefore(ref)` / `.insertAfter(ref)` | `target.append(x)` / `target.prepend(x)` / `ref.before(x)` / `ref.after(x)` |
| `.replaceWith(y)` / `.wrap(w)` | `x.replaceWith(y)` / `x.before(w); w.append(x)` |
| `.clone()` | `x.cloneNode(true)` (jQuery's `.clone(true)` also copied handlers; native never does) |
| `.click(fn)`, `.keyup(fn)`, `.mouseenter(fn)`, `.focus(fn)`, `.bind('x', fn)`, `.unbind('x')` | `addEventListener('click', fn)` ... / `removeEventListener`. `mouseenter`/`mouseleave` exist natively and do not bubble, like jQuery's |
| `.stop()` / `.fadeOut()` / `.slideUp()` | Cancel the `Animation` returned by `el.animate(...)`, or remove the CSS class that drives the transition |
| `$('<style>').html(css).appendTo('head')` | Do not port. Put the CSS in a file and `import './x.css'`, scoped to your element (`styling-and-assets.md`) |
| `$el.appendTo('body')`, `$('body')`, `$(document)` | Do not port: render inside `el` (`host.dom-outside` in `check-no-host-apis`) |
| `.css({ width: 10 })` | `x.style.width = '10px'` (jQuery added `px` for numbers, except unitless properties such as `opacity`, `z-index`, `line-height`; native adds nothing). Prefer a class |
| `.width()` / `.height()` / `.outerWidth()` / `.outerHeight()` | `.width()` excluded padding and border: `clientWidth` includes padding, `offsetWidth` also includes border, `getBoundingClientRect()` is the transformed box. Pick the one that matches what the old code meant and compare on screen |
| `.show()` / `.hide()` | Toggle a class that sets `display`. `x.hidden = true` is **not** equivalent: a class that sets `display: flex` or `block` overrides the `hidden` attribute (verified in Chrome). If you use `hidden`, add `[hidden] { display: none }` to your CSS |
| `.on('click', fn)` | `x.addEventListener('click', fn)` |
| `.on('click', '.row', fn)` (delegated) | One listener on `el`: `el.addEventListener('click', e => { const row = e.target.closest('.row'); if (row && el.contains(row)) fn(e, row); })` |
| `.off(...)` | `removeEventListener`, or abort the controller passed as `{ signal }` |
| `.trigger('click')` | `x.click()`; other events `x.dispatchEvent(new Event(name, { bubbles: true }))`; or call the function directly |
| `.each(function (i, n) { ... this ... })` | `for (const n of nodes) ...` (use `n`, not `this`) |
| `$.each(arr, (i, v) => ...)` | `arr.forEach((v, i) => ...)` (note the argument order is swapped) |
| `$.map` / `$.grep` | `$.map` flattened one level and dropped `null`/`undefined` results: use `arr.flatMap(fn)` (return `[]` to drop); `arr.map` keeps both. `$.grep` is `arr.filter` |
| `$.extend({}, a, b)` | `{ ...a, ...b }` (shallow). Deep merge: `structuredClone` plus an explicit merge, or write the few keys you need |
| `$.extend(true, ...)` | Same as above; check whether you really need a deep merge |
| `$.proxy(fn, ctx)` | Arrow function, or `fn.bind(ctx)` |
| `$.isArray` / `$.trim` / `$.inArray` | `Array.isArray` / `str.trim()` / `arr.includes` |
| `$.Deferred()` / `$.when(...)` | `new Promise(...)` / `Promise.all([...])` |
| `$.ajax` / `$.get` / `$.getJSON` | `fetch`. Extensions should not call host-relative URLs or external origins without a reason (`host.relative-fetch`, `host.external-url`) |
| `.fadeIn` / `.animate` / `.slideToggle` | CSS transitions on a class, or `el.animate(...)` (Web Animations API) |
| `$(document).ready(fn)` | Not needed: `component()` already runs when the element exists |
| `$(window).on('resize', fn)` | Not needed: the render hook reruns on size change (`useRect()`); remove the handler |
| `$(document).on(...)` / `$('body')...` | Scope to `el`. Anything that needed `document` or `body` (dropdowns, tooltips) should be rendered inside `el`, positioned with CSS |

## Markup built from strings (most of the work)

The dominant pattern in legacy jQuery extensions is HTML assembled from strings (`$('<div class="x">')`, `.append('<tr><td>' + text + '</td></tr>')`, template literals), far more than `.css(...)` calls or global selectors (`$('#id')`). Port these first:

1. Add a small helper once, for example `el(doc, tag, className, text)` that calls `createElement`, sets `className` and `textContent`, and returns the node (this worked well for ports with well over a hundred `$()` calls).
2. Rewrite each string as nested helper calls and `append`. Data only ever reaches the DOM through `textContent` or `setAttribute`.
3. For long static chunks, a `<template>` element cloned with `cloneNode(true)` and filled in by `textContent` keeps the markup readable.
4. Replace `$('#id' + n)` lookups with references you already hold, or classes plus `el.querySelector`. Ids collide when two copies of the extension are on one sheet.

## Differences that cause bugs

- **Collections:** jQuery methods act on every matched node and are silent on an empty match. `querySelectorAll` returns a `NodeList`: loop it explicitly, and guard `querySelector(...)` against `null`.
- **Chaining:** native methods mostly return `undefined`. Do not carry `$x.addClass(...).on(...)` chains over line by line.
- **`this` in handlers:** jQuery set `this` to the element; native handlers do too only for `function`, not arrow functions. Use `e.currentTarget`.
- **Event data:** `e.data` and namespaced events (`click.myext`) do not exist. Use closures, and an `AbortController` to remove a group.
- **`.css()` numbers and `.width()` on hidden elements** behave differently. Re-check any layout code after the rewrite.
- **Strings passed to `.append()`:** jQuery parsed `.append('<b>x</b>')` as HTML. Native `append('<b>x</b>')` inserts the text `<b>x</b>` (verified), so a mechanical `$el.append` to `el.append` rewrite renders markup as visible text.
- **`.html()` on trusted-looking text:** Qlik field values are user data. Porting `.html(value)` to `innerHTML` keeps the injection risk; use `textContent`.

## When bundling jQuery is acceptable

- The code uses a jQuery plugin (a date picker, a sortable list) with no maintained native equivalent.
- The extension is large, has no tests, and the visible behavior cannot be compared before and after.

In practice bundling jQuery was not needed: extensions with a datepicker, a sortable list and a date-range picker were all ported to native DOM. Plugin replacements that worked: jQuery UI datepicker -> `<input type="date">` (convert the date format yourself), jQuery UI `sortable` -> native HTML5 drag and drop plus keyboard buttons, a forked date-range picker -> a small calendar module of its own.

In both cases: `jquery` in `dependencies` (not `peerDependencies`), imported, never taken from `window`; pass it the extension's element only; list it in the migration report as remaining work.

## Verifying

```bash
node <skill-dir>/scripts/check-no-host-apis.mjs . --bundle <nebula-id>
```

`lib.jquery` findings should be gone, and `jquery` should no longer be in `package.json` (`npm uninstall jquery`). Then run the jsdom smoke test (`testing-without-sense.md`): jsdom supports `querySelector`, `closest`, `classList`, `dispatchEvent`, `append` and `replaceChildren`, so the same fixture covers the rewritten code. It has no layout (sizes are 0) and no `el.animate`.
