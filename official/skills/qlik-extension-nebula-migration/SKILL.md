---
name: qlik-extension-nebula-migration
description: >-
  Migrates a Qlik Sense visualization extension built on the legacy Extension API / Capability APIs
  (AMD define(), .qext, paint($element, layout), backendApi, qlik.currApp, AngularJS template/controller)
  to a nebula.js visualization (supernova: qae + component + ext, built with nebula build and nebula sense).
  Use when asked to migrate, convert, port, modernize or replace a Qlik Sense extension, Capability API
  extension or AngularJS extension with nebula.js; to map paint/resize/backendApi/qlik.currApp to stardust
  hooks; or to make a nebula extension a drop-in replacement for an existing one. Builds the new extension
  side by side under the original id plus the suffix -nebula, then recommends renaming it to the original name. The result must not use
  APIs or frameworks from the host (Sense client) page. Optional React renderer.
license: Apache-2.0
allowed-tools: read write edit bash
metadata:
  author: withdave
  version: 1.0.0
  tags:
    - qlik
    - nebula
    - extensions
    - migration
---

# Migrate a Qlik Sense extension to nebula.js

Turns a legacy visualization extension into a nebula.js extension packaged by `nebula sense`, in a new project folder. The original is never edited in place.

Designed for Qlik Cloud and Qlik Sense client-managed; test in the exact environment you run ([`references/host-differences.md`](references/host-differences.md)). The scripts check source and build output statically and never run the extension in a Sense host, so any claim of "works" must come from host testing.

## Usage

Ask for a migration in plain words, for example "migrate the extension in `~/ext/ShowHide` to nebula.js" or "make a nebula version that can replace the old one". Give the path to the legacy extension folder (the one with the `.qext`). The skill inventories it, builds a side-by-side nebula project, runs the checks, and ends with a report and a rename recommendation. Follow the Workflow below in order, and stop at the points listed in "Stop and ask".

## Rules that always apply

1. **No host-page APIs or frameworks.** The migrated extension uses only `@nebula.js/stardust` hooks, the `galaxy` argument, and npm packages it bundles itself. No `qlik` global or `define(['qlik'])`, no AngularJS (`template`, `controller`, `$scope`, `ng-*`), no `qvangular` or other internal modules, no host jQuery/underscore through `require`, no `.qv-*` or `lui-*` classes, no DOM or CSS outside the extension's own element. The only host objects allowed are `galaxy.anything.sense.theme` and `.navigation`, guarded so the extension still renders without them, plus a guarded fallback to `handler.app` in property-panel callbacks. Details and replacements: [`references/host-isolation.md`](references/host-isolation.md).
2. **Side-by-side name first.** Build and install the new extension under the original id plus `-nebula` (derive it with [`scripts/nebula-id.mjs`](scripts/nebula-id.mjs); for example `WordCloud` becomes `word-cloud-nebula`) so old and new can be compared on the same tenant. The final step is to recommend renaming to the original name, so existing charts pick up the new code (silent drop-in), **unless** [`scripts/check-compat.mjs`](scripts/check-compat.mjs) shows property names, the data path or limits changed, or the drop-in otherwise cannot work. In that case keep the side-by-side name and say why. See [`references/compatibility-and-rename.md`](references/compatibility-and-rename.md).
3. **Preserve behavior and saved data.** Keep every property name and path, `support` flags, data limits, and selection behavior (instant vs modal) unless the user asks for a change. Read a property that old saved objects lack the way the legacy code treated it (often its own default); any other default is a change. Every change goes in the report.
4. **Report what ran.** Never write "compatible", "works" or "verified" for something you did not run in a host; write "no blocking difference found by static checks". Mark inferred mappings (tag `I` in [`references/api-mapping.md`](references/api-mapping.md)) as inferred. Limits, versions and statements about what Qlik Cloud supports are dated: where a reference gives one, confirm it on the linked Qlik page before relying on it ([`references/sources.md`](references/sources.md), "Facts that go stale").
5. **Ask before side effects.** `npx`, `npm install` and any upload to a tenant (`POST /api/v1/extensions`, `qlik extension create`, Management console) need the user's go-ahead. Never upload, delete or replace an extension on a tenant yourself.
6. **Ship everything inside the extension.** Bundle libraries (exact versions, lockfile committed) and inline fonts and images (data URIs or SVG); do not load scripts, styles, fonts or data from another origin at run time. Qlik Cloud blocks such a request unless the tenant admin adds a CSP entry, and the extension then fails without an error in the UI. It also keeps code you have not reviewed, from CDNs and other repositories, out of the user's signed-in session. List any origin you cannot avoid, with its directive, in the report (a tenant has only 256 CSP entries and a 6,144-character header, shared by everything on it) ([`references/external-resources.md`](references/external-resources.md)).
7. **No secrets.** Do not put tokens, tenant URLs with credentials or personal data in files. The scaffold fills `author` (name and email) from git config and `nebula sense` copies it into the `.qext`; show it to the user and set it deliberately.

## Scope

In scope: visualization extensions (`.qext` with `"type": "visualization"`) written for the Extension API, with or without AngularJS.
Out of scope: extensions of another type (widgets, custom components, themes), mashups that use the Capability API to embed content (that is a qlik-embed migration), and Qlik's own bundled charts. If the `.qext` is another type, stop and say so.

## Inputs to gather

- Path to the legacy extension folder (the one containing the `.qext`).
- The original extension id (the `.qext` file base name) and display name (`name` in the `.qext`).
- Target hosts: Qlik Cloud, client-managed, or both.
- Ask only when the code cannot answer: renderer (plain DOM by default, React optional), whether to keep instant or confirm/cancel selections, whether unsupported features may be dropped.

`<skill-dir>` below is the folder containing this `SKILL.md`.

## Workflow

### 1. Inventory and plan

```bash
node <skill-dir>/scripts/inventory.mjs <legacy-dir>
```

The script is a regex work list, not a parser: read the entry file(s) completely. Buckets: **direct** (has a mapping row), **rewrite** (redesign), **host** (must not survive), **review** (check context). Present a short plan: size of the work, what cannot be migrated, libraries to map to npm, decisions needed. Stop and ask (see "Stop and ask") before continuing when the inventory shows AngularJS templates ([`references/angularjs-rewrite.md`](references/angularjs-rewrite.md)), `qlik.table`, client-only `qlik.*` calls, QVisualization export calls, run-time CDN loading, or `getDrop*Options` and other members not in the public reference.

### 2. Scaffold

Needs the Node.js version that `@nebula.js/cli` requires (24 or newer when this was tested; see `engines` in its `package.json`). With the user's approval:

```bash
node <skill-dir>/scripts/nebula-id.mjs "<original id>"        # prints <nebula-id>
npx @nebula.js/cli create <nebula-id> --picasso none --pkgm npm
```

Then in the new project:

- `package.json` script: `"sense": "nebula sense --meta src/meta.json --output <nebula-id>"` (the folder, `.qext` and entry JS must share one name).
- `src/meta.json`: `name` = `Nebula <original display name>` and a valid `icon`. Set the `.qext` description in `package.json` (`nebula sense` ignores a `description` in `meta.json`).
- Third-party code keeps its licence as `LICENSE.txt` (a file without an extension is ignored by Qlik Cloud); the licences of bundled libraries go in it too. `nebula sense` does not copy it: see "Licence, preview, author" in [`references/packaging-and-deploy.md`](references/packaging-and-deploy.md).
- Remove the scaffold leftovers ([`references/testing-without-sense.md`](references/testing-without-sense.md)), and set `author` deliberately.
- Add the libraries the legacy code needs to `dependencies` (not `peerDependencies`, which are not bundled) at the major version the legacy code expects, except d3 v3, which becomes the modular `d3-*` packages ([`references/styling-and-assets.md`](references/styling-and-assets.md)).

Layout and commands: [`references/packaging-and-deploy.md`](references/packaging-and-deploy.md).

### 3. Port the properties, data and panel (always)

- `initialProperties` -> `src/object-properties.js`; move each `defaultValue` from `definition` there too.
- `dimensions` / `measures` min/max -> `src/data.js` targets (same `path` as before).
- `definition` -> `src/ext.js` as `ext.definition`; the data sections become `data: { uses: 'data' }`; copy `support`. **Keep the Data section whenever targets are declared**: without it Sense silently shows the sheet's panel instead of the object's.

Rules and examples: [`references/properties-and-data.md`](references/properties-and-data.md).

### 4. Stage 1 - get a working build with the old rendering code (only when it fits)

Use stage 1 only for extensions that paint from a hypercube or list object with `$element` and `backendApi`. **Skip it** for AngularJS templates, for code that uses `eval`/`new Function` or implicit globals (it breaks once the bundle is minified), for code that works through `qlik.currApp`/the engine instead of a hypercube (the shim supplies none of that), and for extensions small enough to port directly. Then go straight to stage 2.

Copy `assets/compat-shim.js` into `src/`, move the old `paint` into `src/legacy-paint.js` with only these edits: libraries imported from npm, `qlik.Promise` -> `Promise`. Call it from `component()` with `createLegacyContext(...)`. The shim covers `$element`-style code, `backendApi` and `this.selectValues`; it supplies nothing from the host. If the old code used jQuery on `$element`, bundle jQuery and pass `$(element)` as a temporary step.

```bash
npm run build && npm run sense
node <skill-dir>/scripts/check-no-host-apis.mjs . --bundle <nebula-id> --allow-shim
```

Do not skip stage 2: `--allow-shim` is only for this stage. Walkthrough: [`references/worked-example.md`](references/worked-example.md).

### 5. Stage 2 - make it idiomatic

Replace the shim and legacy names one area at a time using the references, then delete `compat-shim.js` and `legacy-paint.js`:

| Area | Reference |
|---|---|
| paint/resize/lifecycle, `$element`, jQuery, Promises | [`references/api-mapping.md`](references/api-mapping.md) |
| selections (instant vs modal), data paging | [`references/selections-and-data.md`](references/selections-and-data.md) |
| `qlik.currApp`, fields, variables, session objects, navigation, theme | [`references/app-and-navigation.md`](references/app-and-navigation.md) |
| jQuery calls (`$element.find`, `.on`, `$.ajax`, ...) | [`references/jquery-to-dom.md`](references/jquery-to-dom.md) |
| AngularJS `template`/`controller`/`$scope` | [`references/angularjs-rewrite.md`](references/angularjs-rewrite.md) |
| CSS, LESS, `text!`/`css!`, d3/jQuery libraries, fonts, images | [`references/styling-and-assets.md`](references/styling-and-assets.md) |
| CDN or other run-time external resources, CSP | [`references/external-resources.md`](references/external-resources.md) |
| snapshots, export, "finished rendering" | [`references/snapshots-and-export.md`](references/snapshots-and-export.md) |
| optional React renderer | [`references/react-renderer.md`](references/react-renderer.md) |

Offer React once (best for large conditional templates); default to plain DOM. Before packaging, write a jsdom smoke test against a fixture layout ([`references/testing-without-sense.md`](references/testing-without-sense.md)). If the user supplies a throwaway tenant, [`references/host-testing.md`](references/host-testing.md) is the smallest real host test (each tenant change needs their approval).

### 6. Package and run the checks

```bash
npm run build && npm run sense
node <skill-dir>/scripts/check-package.mjs <nebula-id> --expect-name <nebula-id>
node <skill-dir>/scripts/check-no-host-apis.mjs . --bundle <nebula-id>      # no --allow-shim
node <skill-dir>/scripts/check-panel.mjs .
node <skill-dir>/scripts/check-compat.mjs <legacy-dir-or-its-src> .      # --accept-dropped ref1,ref2 for deliberately removed settings
zip -r <nebula-id>.zip <nebula-id>
```

`check-package`, `check-no-host-apis` and `check-panel` must pass. Fix failures instead of weakening a check.

### 7. Drop-in decision and rename (last step)

- `check-compat.mjs` reports **no blocking difference**: recommend the rename. Do it with the user's agreement by following the procedure in [`references/compatibility-and-rename.md`](references/compatibility-and-rename.md) (package name, `main`, `module`, `--output`, display name, version, author), rebuild, rerun the checks with `--expect-name <original id>`. Keep both zips (side by side and drop-in). If the new code changes what existing charts can show or do (sanitized HTML, dropped options or features), `check-compat` cannot see it: list those changes and ask before recommending the rename.
- `check-compat.mjs` reports a failure: keep `<nebula-id>`. List each failure and what would need to change (restore a property name or data path, add a migration) in the report. Offer to fix the cause and re-run.
- Either way, state that the final proof is opening a chart that was saved by the old extension in the user's host.

### 8. Report

Write `MIGRATION.md` from [`references/report-template.md`](references/report-template.md) and summarize it in chat: commands run and results, what was mapped, rewritten and dropped, libraries bundled, CSP origins, the drop-in decision and reason, and the host checklist the user still has to do. Remind them to keep the original extension for rollback.

## Scripts and permissions

Scripts in `scripts/` need only Node.js (no dependencies) and are **read-only: they read the paths you pass and print results; no network calls, nothing written.**

| Script | Purpose |
|---|---|
| `nebula-id.mjs "<original id>"` | Derives the side-by-side id (the original id plus `-nebula`) |
| `inventory.mjs <legacy-dir> [--json]` | Work list of legacy API use, host dependencies, AMD dependencies, assets |
| `check-no-host-apis.mjs <project> [--bundle <folder>] [--allow-shim]` | Fails on host-page APIs/frameworks in source and in the built bundle |
| `check-package.mjs <folder> [--expect-name <id>]` | Validates the `nebula sense` output: names, `.qext`, files, limits, external origins |
| `check-panel.mjs <project>` | Fails when data targets are declared but the panel has no Data section |
| `check-compat.mjs <legacy-dir> <project> [--accept-dropped refs] [--json]` | Static drop-in check for the rename decision; says when there is nothing to compare |

`bash` is for these scripts, `npm run`, `zip` and, with approval, `npx @nebula.js/cli`. Network access happens only through npm/npx in the user's project; nothing here calls a tenant.

## Stop and ask

- The `.qext` is not a visualization, or the code is a mashup rather than an extension.
- A feature has no replacement (AngularJS UI, `qlik.table`, client-only APIs, QVisualization export, search helpers). Offer: drop it, redesign it, or keep the legacy extension for that feature.
- `check-compat.mjs` fails and the user wants the original name anyway: explain that existing charts would lose settings or data, and let them decide.
- The original id contains characters npm rejects in a package name (see [`references/compatibility-and-rename.md`](references/compatibility-and-rename.md)).
- Anything that would upload to, replace on, or delete from a tenant.

When the user cannot be asked (unattended run), take the conservative default and record question and default in `DECISIONS.md`: plain DOM renderer, legacy behavior kept, features without a replacement dropped and documented, no rename if behavior changed.

## References

All in `references/`:

- [angularjs-rewrite.md](references/angularjs-rewrite.md)
- [api-mapping.md](references/api-mapping.md)
- [app-and-navigation.md](references/app-and-navigation.md)
- [compatibility-and-rename.md](references/compatibility-and-rename.md)
- [external-resources.md](references/external-resources.md)
- [host-differences.md](references/host-differences.md)
- [host-isolation.md](references/host-isolation.md)
- [host-testing.md](references/host-testing.md)
- [jquery-to-dom.md](references/jquery-to-dom.md)
- [packaging-and-deploy.md](references/packaging-and-deploy.md)
- [properties-and-data.md](references/properties-and-data.md)
- [react-renderer.md](references/react-renderer.md)
- [report-template.md](references/report-template.md)
- [selections-and-data.md](references/selections-and-data.md)
- [snapshots-and-export.md](references/snapshots-and-export.md)
- [sources.md](references/sources.md)
- [styling-and-assets.md](references/styling-and-assets.md)
- [testing-without-sense.md](references/testing-without-sense.md)
- [worked-example.md](references/worked-example.md)
