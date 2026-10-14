# Testing a migrated extension without Sense

A jsdom smoke test runs the rendering code and catches exceptions, wrong DOM and broken selections before upload. It does not run the stardust hooks unless you stub them and does not prove the extension works in Sense. Report it as "builds, passes static checks, passes smoke test".

## Structure the code so it can be tested

- Keep drawing and interaction logic in plain modules (`src/render.js`, `src/engine.js`) that take `element`, `layout` and callbacks as arguments.
- Keep `src/index.js` thin: it reads hooks and calls those modules.
- Pass engine objects in (a fake `Doc`/`model`), so no module creates its own connection.

## Node specifics the scaffold does not cover

- Node's ES module loader needs file extensions and cannot import `.css` or (without import attributes) `.json`. Either write `./x.js` imports and keep CSS/JSON out of the modules you test, or test the **built bundle** (below).
- Run tests with `node --test test/*.test.mjs` (a bare `test/` is resolved as a file on Node 24).
- `npm install --save-dev jsdom --ignore-scripts` (add `--ignore-scripts` for any third-party package). jsdom has no layout engine: sizes are 0, so give your code explicit sizes or stub `getBoundingClientRect`.
- A canvas-based library needs a canvas package such as `@napi-rs/canvas`, and a way to plug it in (d3-cloud: `layout.canvas(() => createCanvas(1, 1))`).
- **Testing the built bundle.** The UMD file only calls `define(['@nebula.js/stardust'], factory)` when `define.amd` is truthy; otherwise it assigns a global and the factory result is lost. Set `globalThis.define = Object.assign((deps, factory) => { exported = factory(stubStardust); }, { amd: true })` before importing it, with `stubStardust` an object of small hook stubs (`useElement`, `useLayout`, `useEffect`, ...) that runs effects immediately. Say which parts the stubs hide.

## What to assert

1. Build a realistic synthetic layout in `test/fixture.layout.json`: `qHyperCube` or `qListObject` with `qDimensionInfo`, `qMeasureInfo`, `qDataPages` and `qSize`, plus every custom property from the original `initialProperties`. Also test a layout from an old saved object: missing the properties you added.
2. Render, then assert concrete DOM facts (number of rows, text, classes), not just "no error".
3. Click paths: the selection method is called with the right arguments, and nothing is selected when `useInteractionState` says interaction is off.
4. Cleanup: session objects are destroyed, listeners removed.
5. Empty data, huge data (paging cap), and untrusted text (`<img onerror=...>` must come out as text).
6. Property panel: every `ref` is present, options functions return sane values with and without an app, and `show` callbacks tolerate the properties object lacking nested objects.

## Scaffold clean-up

`nebula create` leaves things to deal with:

- `test/component/hello.fix.js`, `test/integration/hello.e2e.js`, `playwright.config.js`, the `@playwright/test` dev dependency and the `test:e2e` scripts belong to the "Hello!" template and fail after your first change. Delete them or write real fixtures.
- The generated `README.md` and `.eslintrc.json` describe the template; the project name also sits in `package-lock.json` (update it, or run `npm install --package-lock-only`, after any rename).
- `ext.support` in the scaffold has `export: true` and `viewData: true`. Copy the legacy flags instead; with no legacy flags, write the documented defaults (`snapshot`, `export`, `viewData` false, `exportData` true).
- `package.json` `author` contains your git name **and email**, and `nebula sense` copies it into the `.qext`. Set it deliberately (`packaging-and-deploy.md`).
- `npm uninstall <pkg>` can remove the `@nebula.js/stardust` entry from `peerDependencies`; check it afterwards.
- `nebula sense` warns that output files should be listed in `package.json` `files`. That is about publishing to npm and can be ignored here.
