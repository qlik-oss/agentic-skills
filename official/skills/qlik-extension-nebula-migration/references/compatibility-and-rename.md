# Side-by-side naming, drop-in rename, saved-object compatibility

## Contents

- [Side-by-side id](#side-by-side-id)
- [Names](#names)
- [What decides a drop-in](#what-decides-a-drop-in)
- [Additive changes need fallbacks](#additive-changes-need-fallbacks)
- [Final rename procedure](#final-rename-procedure)
- [When not to rename](#when-not-to-rename)

The new extension is first installed as `<original-id>-nebula`, so old and new sit on one tenant and can be compared. The last step is to rename it to the original id so existing charts pick up the new code, but only if `check-compat.mjs` allows it.

## Side-by-side id

```bash
node <skill-dir>/scripts/nebula-id.mjs "Acme Sales Report"      # acme-sales-report-nebula
```

Rule: split camelCase and acronym boundaries, turn every run of other characters into `-`, lower-case, append `-nebula`. `SQLHelper` -> `sql-helper-nebula`, `AcmeChart_v2` -> `acme-chart-v2-nebula`, `com.example.wordcloud` -> `com-example-wordcloud-nebula`.

The result is always a valid lower-case npm name, sorts next to the original, and comes from the id the tenant shows rather than a repository name. It is not reversible (`Acme Sales Report` and `acme-sales-report` give the same id), so record the original id in MIGRATION.md.

## Names

The extension id is the shared base name of the zipped **folder**, the **`.qext`** file and the **entry JS**. The `.qext` `name` is only the display name. `nebula sense` takes the id from the last segment of the `package.json` name and names the folder `<id>-ext` unless told otherwise, so always pass `--output <id>`:

```json
{
  "name": "word-cloud-nebula",
  "main": "dist/word-cloud-nebula.js",
  "module": "dist/word-cloud-nebula.esm.js",
  "scripts": { "sense": "nebula sense --meta src/meta.json --output word-cloud-nebula" }
}
```

`check-package.mjs <folder> --expect-name <id>` verifies it.

| Stage | `package.json` name / id | `meta.json` name |
|---|---|---|
| Side by side | `<original-id>-nebula` | `Nebula <original display name>` |
| Final | `<original id>` exactly, same case | `<original display name>` |

Mixed-case ids and ids with dots built fine with `nebula create/build/sense` here. Other characters give a warning. If the id has a character npm rejects (a space), build under the side-by-side name and rename only the top-level `<id>.qext`, `<id>.js` and folder (leave `dist/` and the wrapper's `./dist/...` path), then run `check-package.mjs <folder> --expect-name "<id>"`. This is manual and fragile; keep the side-by-side id if that is unacceptable.

## What decides a drop-in

Saved objects keep their properties and a `visualization` value equal to the extension id. The new code must understand every object the old code saved.

```bash
node <skill-dir>/scripts/check-compat.mjs <legacy-dir> <nebula-project-dir> [--accept-dropped ref1,ref2]
node <skill-dir>/scripts/check-panel.mjs <nebula-project-dir>
```

`check-compat` compares statically:

| Check | Fails when |
|---|---|
| Property refs | An old `ref` is missing in the new `ext.definition` (saved values would be ignored) |
| Data path | The old `qHyperCubeDef` / `qListObjectDef` is not a data target |
| Dimension/measure limits | New limits are stricter (old objects render as a placeholder) |
| New `layout.*` reads (warning) | New code reads a path old objects may lack |
| New refs (info) | A property was added; old objects lack it, so add a fallback |
| Option values (warning) | A dropdown/radio `value` of the legacy panel appears nowhere in the new source |
| `support` flags, import/export (warning) | They changed (the legacy `snapshot: { canTakeSnapshot }` form counts as `support.snapshot`) |

`check-panel` fails when the extension declares data targets but `ext.definition` has no `data: { uses: 'data' }` section. Sense then shows the sheet's panel instead of the object's, with no console error (verified in Qlik Cloud).

**It does not see:** `show` conditions, `defaultValue`s, what the code does with a value, and behavior changes such as sanitized HTML, dropped features or different defaults. Compare those by hand and list them; they can make a rename unsafe even when the check passes.

Verdicts:

- No failures: the rename is reasonable. Say "no blocking difference found by static checks"; the host check below is still required.
- Any failure: keep the side-by-side id, list each failure, say users would have to re-create or re-point charts, and offer to fix the cause.

Reading the tool:

- **Point it at readable sources.** If the original ships a built `dist/`, pass the repo root with `src/`. A minified folder shows only part of the refs and warns (`minified-legacy`).
- **`nothing-to-compare`** means no literal refs or data path were found. It is not evidence of compatibility.
- **Dynamic refs** (`ref: 'tab' + i + 'Title'`) are listed as a warning, not guessed. Compare them by hand.
- **Data path** comes from `qHyperCubeDef:` / `qListObjectDef:` keys in the old source and from `targets` in the new one; `getHyperCubeData('/qHyperCubeDef')` strings are ignored.
- **Deliberate drops** (for example a setting that restyled the Sense page): `--accept-dropped`. Saved objects keep working, the setting does nothing; list each one in MIGRATION.md. Never use it to hide an accidental rename.
- Keep a `defaultValue` that differs between the panel and `initialProperties` as it was in each place, and mention it in the report. An expression default (`="..."`) that works in the panel may not behave the same in `initialProperties` (inferred): keep it where the original had it and add a fallback in code.

## Additive changes need fallbacks

Both qlik-oss migrations kept property names and only added new ones. Old saved objects lack every added property and every `defaultValue` moved into initial properties, so read each with a fallback. Use what the legacy code did with a missing value: its own default if it applied one, otherwise `undefined` handled the same way. Any other default is a behavior change to report.

```js
const color = layout.barColor ?? '#3b82f6';   // the legacy code applied this default
```

`ext.migrate` (for example `migrate: { properties(props) {...} }` in sn-org-chart) is honored by the Sense client but is not part of the stardust API. Use it only if a rename is unavoidable, and verify it in your host.

## Final rename procedure

1. `check-compat.mjs` and `check-panel.mjs` have no failures, and the list of changes `check-compat` cannot see has been reviewed with the user.
2. Copy the project **without** `node_modules` and the old build output (for example `rsync -a --exclude node_modules --exclude /dist --exclude /<nebula-id> project/ dropin/`; an unanchored `--exclude dist` also strips `node_modules/**/dist` and breaks the build). Reinstall with `npm ci`.
3. `package.json`: `name` = original id, update `main`, `module` and the `--output` of the `sense` script; update the name in `package-lock.json` (`npm install --package-lock-only`). Fix tests that mention the old folder name. Rebuild.
4. `src/meta.json`: original display name. Version at or above the original `.qext` version; map a non-semver original (`1`) to `1.0.0`.
5. Check the generated `.qext` (`author` is copied from `package.json`), and copy `LICENSE.txt` into the new output folder.
6. Run `check-package.mjs <folder> --expect-name <Original>` and `check-no-host-apis.mjs <project> --bundle <folder>`; zip the folder. Keep both zips.
7. Keep the original extension's zip for rollback, then replace the old extension on the tenant (Cloud: Management console, Extensions; client-managed: Extensions folder or QMC). In Qlik Cloud, `qlik extension patch <id> --file <zip>` replaced four legacy extensions in place, and existing objects with the original id rendered with the new code (October 2026). The record becomes `supernova: true` and patching cannot undo that: roll back by deleting the extension and creating it again from the original zip.
8. Open a chart **saved by the old extension**; confirm it renders, selects and exports as before.
9. Delete the `<original-id>-nebula` test extension. Charts created during testing store that id and do not follow the rename; recreate or discard them.

## When not to rename

Keep the side-by-side id when `check-compat` fails, when no old saved chart could be tested in the host, or when the user wants a gradual rollout. Say so in the report.
