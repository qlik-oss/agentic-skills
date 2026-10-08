# Sources and evidence

## Contents

- [Qlik documentation (D)](#qlik-documentation-d)
- [Facts that go stale](#facts-that-go-stale)
- [Source code (E)](#source-code-e)
- [Observed by running the tools (E)](#observed-by-running-the-tools-e)
- [Where public documentation was inconsistent on the access date](#where-public-documentation-was-inconsistent-on-the-access-date)
- [Evidence from testing (E)](#evidence-from-testing-e)

Accessed 2026-10-06. Re-check these when Qlik ships a new nebula.js major version: the mapping tags in `api-mapping.md` (D/E/I) refer to this list.

## Qlik documentation (D)

Migration and guidance:

- Migrate an existing visualization extension to nebula.js: https://qlik.dev/extend/extensions/nebula-js/quickstart/migrate-vis-extension-nebula/
- Extensions overview (nebula.js recommended for new work; Extension API "supported but no longer the recommended path"): https://qlik.dev/extend/extensions/
- Extension guidelines (supported APIs, five anti-patterns, packaging, CSP): https://qlik.dev/extend/extensions/extension-guidelines/
- Extension API (legacy framework; Qlik Cloud export limits): https://qlik.dev/extend/extensions/extension-api/
- Capability API (qlik-embed recommended for embedding; AngularJS prerequisite; unsupported methods in Qlik Cloud): https://qlik.dev/embed/capability-api/

Building with nebula.js:

- Core principles (`qae`, `component`, `ext`, hooks, data targets, selections): https://qlik.dev/extend/extensions/nebula-js/nebula-stardust-core-principles/
- First extension tutorial: https://qlik.dev/extend/extensions/nebula-js/quickstart/first-extension/
- Load an extension into Qlik Sense (`galaxy` argument): https://qlik.dev/extend/extensions/extension-api/build-extension/in-qlik-sense/
- `nebula create`, `nebula serve`, `nebula build`, `nebula sense`: https://qlik.dev/extend/extensions/nebula-js/set-up-nebula-environment/nebula-create/ , https://qlik.dev/extend/extensions/nebula-js/set-up-nebula-environment/nebula-serve/ , https://qlik.dev/extend/extensions/nebula-js/deploy-extension/nebula-build/ , https://qlik.dev/extend/extensions/nebula-js/deploy-extension/nebula-sense/
- QEXT file: https://qlik.dev/extend/extensions/qext-file-overview/
- Themes in nebula: https://qlik.dev/embed/nebula/render/applying-themes/

References:

- nebula.js (stardust) API: https://qlik.dev/apis/javascript/nebula-js/
- Extension API reference: https://qlik.dev/apis/javascript/extension/
- Capability API reference: https://qlik.dev/apis/javascript/capability/
- Engine (QIX) methods: https://qlik.dev/apis/json-rpc/qix/doc/ , https://qlik.dev/apis/json-rpc/qix/genericobject/

Deployment:

- Upload and manage extensions in Qlik Cloud (roles, limits, CSP): https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/mc-extensions.htm
- Extensions REST API: https://qlik.dev/apis/rest/extensions/
- Add themes and extensions across tenants: https://qlik.dev/manage/platform-operations/add-custom-themes-and-extensions/
- Changelog: https://qlik.dev/changelog/92-nebula-v5-typings/ (nebula v5), https://qlik.dev/changelog/70-extension-theme-update/ (upload limits), https://qlik.dev/changelog/106-api-updates-extensions-themes/ (download roles)

Client-managed help (May 2026 docs):

- Extension API: https://help.qlik.com/en-US/sense-developer/May2026/Subsystems/APIs/Content/Sense_ClientAPIs/extensions-api-reference.htm
- AngularJS in extensions: https://help.qlik.com/en-US/sense-developer/May2026/Subsystems/Extensions/Content/Sense_Extensions/extensions-angular-introduction.htm

Migration notes (the sections on attribute expressions, calculation condition, master items, alternate states, hook rules and snapshot format rest on current references and on tests in Qlik Cloud in October 2026, not on older threads):

- Engine API (`Doc.getField` with a state name, `getMeasure`/`getDimension`, pivot and stacked data): https://qlik.dev/apis/json-rpc/qix/doc/
- Stardust API reference (`useKeyboard`, `useDeviceType`, hooks) and core principles (hooks only at the top level of `component`): https://qlik.dev/apis/javascript/nebula-js/ , https://qlik.dev/extend/extensions/nebula-js/nebula-stardust-core-principles/
- Snapshot format option added to nebula.js `takeSnapshot` (PR 2247, merged October 2026): https://github.com/qlik-oss/nebula.js/pull/2247

Content security policy and external resources (the basis for `external-resources.md`):

- Managing Content Security Policy (Qlik Cloud help; directives, tenant-admin roles, and the limits of 256 entries per tenant and a 6,144-character header, both fixed): https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/mc-administer-content-security-policy.htm
- Extension guidelines ("Declare all external origins in the tenant CSP"; blocked requests show no error in the Qlik UI): https://qlik.dev/extend/extensions/extension-guidelines/
- Add custom themes and extensions (a CSP "is only required if your extension utilizes external (not bundled in the extension archive) assets"; one origin per entry): https://qlik.dev/manage/platform-operations/add-custom-themes-and-extensions/
- Content security policy (the browser console shows the missing directive): https://qlik.dev/authenticate/content-security-policy/
- Manage extensions help page (do not put image files in the archive; allow-list external origins; "If an origin is not allowlisted, your extension will not render"): https://help.qlik.com/en-US/cloud-services/Sense_Hub/Admin/mc-extensions.htm
- Support article on finding the blocking origin with the browser developer tools: https://community.qlik.com/t5/Official-Support-Articles/How-to-determine-string-policy-for-Content-Security-Policy/ta-p/1715491

Community (context, not normative):

- Third-party extensions cannot be exported in Qlik Cloud Analytics: https://community.qlik.com/t5/Official-Support-Articles/Qlik-Cloud-Analytics-Third-party-extensions-cannot-be-exported/ta-p/1755264
- Why you should stop using Qlik's Capability API (opinion, not a deprecation notice): https://community.qlik.com/t5/Qlik-Design-Blog/Why-you-should-stop-using-Qlik-s-Capability-API/ba-p/1797582

There is no published end-of-life date for the Extension API or the Capability APIs in the pages above. Use Qlik's wording: legacy, supported, not the recommended path. jQuery and underscore are described as being deprecated as libraries that extensions can load through `require()`, with no date.

## Facts that go stale

Do not copy these into a report as current. Re-check them at the source before relying on them; each is dated October 2026 where it appears.

| Fact | Where it appears | Re-check at |
|---|---|---|
| `@nebula.js/cli` and stardust versions, Node requirement, `nebula create`/`sense` options, generated files | `packaging-and-deploy.md`, `worked-example.md`, evidence tags in `api-mapping.md` | `npx @nebula.js/cli --version` and `--help`; nebula.js releases on GitHub |
| Hook status (`useNavigation` experimental, `useConstraints` deprecated), `galaxy.anything.sense` members | `api-mapping.md`, `app-and-navigation.md`, `selections-and-data.md` | stardust API reference on qlik.dev |
| Upload limits, blocked file types, roles that can upload or download | `packaging-and-deploy.md`, `check-package.mjs` | Managing extensions help page |
| CSP entry and header limits, directives, who can add entries | `external-resources.md` | Managing Content Security Policy help page; `qlik csp-origin generate-header` |
| Export, snapshot and print support in Qlik Cloud | `snapshots-and-export.md`, `host-differences.md` | Extension API page; Qlik support articles |
| Capability API methods unsupported in Qlik Cloud | `api-mapping.md`, `scripts/lib/rules.mjs` | Capability API page |
| Deprecation of jQuery and underscore for extensions | `api-mapping.md`, `jquery-to-dom.md` | Extension guidelines page |
| Valid `.qext` icon names | `check-package.mjs` | QEXT file page |
| Minimum client-managed version for nebula extensions | `host-differences.md` | Release notes of the target version |
| Observed Qlik Cloud behavior: sheet panel without a Data section, `useInteractionState().edit`, the console `jquery` warning, `useEmbed`, what CSP blocks, `extension patch` setting `supernova` | `properties-and-data.md`, `app-and-navigation.md`, `host-isolation.md`, `external-resources.md`, `compatibility-and-rename.md` | repeat the checks in `host-testing.md` |
| Behavior of third-party packages named in the docs (DOMPurify options, d3 modular packages, jsdom, ESLint 8 flags) | `styling-and-assets.md`, `testing-without-sense.md`, `host-isolation.md` | each package's own documentation |

## Source code (E)

- qlik-oss/nebula.js at v7.6.0 (commit `0e1a785`): hooks (`apis/supernova/src/hooks.js`), `useObjectSelections`, `nebula sense` (`commands/sense/lib/build.js`: wrapper, qext, `--legacy` removed in 4.0), `nebula create` templates, `nebula build` (rollup, peer dependencies as externals, postcss).
- qlik-oss/nebula.js-examples: `simple-chart` (legacy and nebula versions side by side), `chart-custom-prop`, `react-table-chart`.
- Real capability to nebula migrations in qlik-oss (both archived): sn-network-chart (commit `955d954`, "feat: add conversion to nebula"; PR 27) and sn-word-cloud (commit `c5aee38`, "feat: convert to nebula"). Both kept property names and the data path, moved definition `defaultValue`s into initial properties, and first ran the old paint code through a small adapter.
- sn-org-chart: `onTakeSnapshot`, `ext.migrate`, paging with `getHyperCubeData`. sn-action-button and sn-treemap: guarded use of `anything.sense`.

## Observed by running the tools (E)

With `@nebula.js/cli` 7.6.0 on Node 24: `nebula create <Name> --picasso none --pkgm npm` writes the files listed in `packaging-and-deploy.md`; `nebula build` writes `dist/<Name>.js` (UMD with `@nebula.js/stardust` as the only AMD dependency); `nebula sense --meta src/meta.json --output <Name>` writes `<Name>/<Name>.qext`, `<Name>/<Name>.js` (`define(['./dist/<Name>'], (supernova) => supernova);`) and `<Name>/dist/<Name>.js`. A mixed-case package name worked. The `.qext` includes `author` from `package.json`.

## Where public documentation was inconsistent on the access date

Settle these with the source or by testing; the skill makes these choices:

| Topic | Choice made here | Basis |
|---|---|---|
| `selections.begin(paths)`: string or array | Array in new code; a string also works | nebula.js wraps a string into an array (`useAppSelections.js`) |
| `nebula sense --legacy` | Not used | Removed in nebula.js 4.0; the CLI exits with an error |
| `nebula create --type extension` | Not used | The option does not exist; the project is a visualization by default |
| Where the theme lives on `galaxy` | `galaxy.anything.sense?.theme` in the property panel; `useTheme()` in `component()` | Spec has top-level `galaxy.theme`, which is the nebula app theme; Qlik's charts read `anything.sense.theme` for the Sense theme |
| `support.export: true` in templates | Copy the legacy value; warn about Cloud | Qlik Cloud does not export extensions to image/PDF/PPT |
| `ext` in the `VisualizationDefinition` type | Used | Every doc and Qlik's own charts use it; it is absent from the generated spec |
| Stardust version | `>=7.0.0` as in the scaffold | Public API page showed 7.5.0 while the repository was at 7.6.0 |

## Evidence from testing (E)

The skill was exercised on real open-source legacy extensions (jQuery, AngularJS, d3 and Google Charts based), built with the CLI version above and tested in a Qlik Cloud tenant in October 2026. Findings that contradict a plausible assumption, so they are written down:

- `app.getSheetList()` is supplied by the Sense client, not the engine. The docs use a session object with `qAppObjectListDef`.
- `nebula sense` takes the `.qext` description from `package.json`, not `meta.json`.
- An extension that declares data targets but has no Data section silently shows the sheet's panel (`check-panel.mjs`). The `jquery` console warning is emitted by the host, not by extensions (`host-isolation.md`). Edit mode is `useInteractionState().edit`. Nebula content can sit in shadow roots when probing the DOM (`host-testing.md`).
- Replacing a legacy extension with a renamed nebula build (`qlik extension patch`) rendered existing objects with the new code, opened the extension's own property panel and kept modal selection working. Rebuilds made from the skill alone passed every script; the differences found were cosmetic (host styles the legacy code relied on, word placement).
- Legacy extensions that loaded code from a CDN at run time failed on the tenant, one rendering blank and one failing to load, while extensions that bundled everything did not (`external-resources.md`). Qlik's pages say external origins need a CSP entry; none says "bundle your libraries", and the help page tells developers to host images externally. Keeping everything inside the extension is this skill's choice, backed by the statement that a CSP is only needed for assets not bundled in the archive, by the fixed CSP budget, and by keeping unreviewed third-party code out of the user's session.
- What Qlik Cloud blocked and allowed from an extension (October 2026): scripts from `gstatic.com` and `cdnjs.cloudflare.com`, an image from another origin and a `fetch` to another origin were blocked (`script-src-elem`, `img-src`, `connect-src`); a script from Qlik's own CDN, `data:` images, `blob:` workers, inline styles and scripts, `eval` and `new Function` were allowed, and image files inside the extension archive loaded from `/extensions/<id>/...`.
