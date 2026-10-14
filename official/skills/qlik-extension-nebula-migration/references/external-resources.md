# External resources and the content security policy

**Rule:** the migrated extension ships everything it needs to run inside its own archive, for reliability (Qlik Cloud blocks anything else unless the tenant allows it) and for security (no code or data path outside the review and control of the people who deploy it). Do not load scripts, stylesheets, fonts or data from another origin at run time. Where one is unavoidable, list the origin and the directive it needs in the report so the tenant admin can allow it.

## Why: a run-time request to another origin is blocked unless the tenant allows it

Qlik documents it, and it was reproduced on a Qlik Cloud tenant in October 2026.

- Qlik's help and developer pages say that if an extension requests resources from external origins, those origins must be added to the tenant's content security policy (CSP), otherwise the extension does not render. A CSP entry is a tenant-admin task (Tenant Admin, or a role with CSP permission), holds one origin per entry, and sets directives (`script-src`, `style-src`, `font-src`, `img-src`, `connect-src`). The developer guidelines add that blocked requests show no error in the Qlik UI; only the browser console shows the violation.
- The developer portal says a CSP is "only required if your extension utilizes external (not bundled in the extension archive) assets". That is the basis for bundling. It never states "bundle libraries" as a recommendation in so many words: the help page tells developers to allow-list origins, and the community advice is to find the blocked origin in the browser tools and add it. Bundling is this skill's choice, and it avoids a tenant change that the person installing the extension may not be able to make.
- Observed with a legacy extension and a probe page on the tenant:

| Request from an extension | Result |
|---|---|
| Script from `cdn.qlikcloud.com` (Qlik's own) | loaded |
| Script from `www.gstatic.com`, `cdnjs.cloudflare.com` | blocked (`script-src-elem`) |
| `fetch`/XHR to another origin (`gstatic.com`, `api.github.com`) | blocked (`connect-src`) |
| `<img>` from `upload.wikimedia.org` | blocked (`img-src`) |
| `data:` image, `blob:` worker, inline `<style>`, `style` attribute, inline `<script>`, `eval`, `new Function` | allowed |
| Scripts, CSS and images inside the extension archive | allowed (extensions that bundled everything ran on a tenant with no CSP entry added for them; image files in the archive loaded from `/extensions/<id>/...`, but that URL contains the extension id, which changes at the rename, and Qlik's help page advises against shipping image files, so inline them instead) |

Allowed or blocked can differ by tenant (the test tenant had an unrelated Google entry, and Google Fonts CSS loaded), by deployment (client-managed) and when the extension is embedded in another site. Check your own host.

## Security: code from another origin runs with the page's privileges

A script loaded from a CDN or another repository executes inside the Qlik page, in the user's signed-in session. It can read the page, call the tenant's APIs as that user, and reach whatever the page can reach (data on screen, tokens held in script-readable storage). The extension's author does not control that code, and a mutable URL can change what it does without any change to the extension; CDN and third-party script compromises have happened (the 2024 polyfill.io takeover is one example). An allow-list entry makes it worse: a CSP entry is tenant-wide, so it opens that origin to every extension and app on the tenant, not only yours.

Bundling does not make a dependency trustworthy. It moves the risk to build time, where it can be controlled:

- Pin exact versions in `package.json` and commit the lockfile; install with `npm ci`.
- Install third-party packages with `--ignore-scripts`, run `npm audit`, and read what a new dependency pulls in.
- List every bundled library and version in the report (`report-template.md`), so a reviewer can check the same list the browser will run.
- Do not copy a minified file from a CDN into the project without knowing its version and source; take it from the package so the version is recorded.

## The CSP budget is small and shared

Qlik Cloud caps the number of CSP entries per tenant and the length of the generated CSP header. The limits are built in and cannot be raised; the Managing Content Security Policy help page has the current values (256 entries and 6,144 characters in October 2026) and says to remove unused entries when one is reached. Every origin is written into the header once per directive it is allowed for, so an origin allowed for five directives costs about five times its length. The budget also has to cover every other extension, theme and embedding site on the tenant, so each origin an extension asks for is a cost to the admin, which is one more reason to bundle:

- Count the origins you ask for, name the directives each one needs, and ask for the fewest (`script-src` alone is cheaper than all five).
- Put the directives for one origin in one entry rather than creating several entries for it.
- Prefer a short host over a long one where there is a choice.
- To see current usage: `qlik csp-origin generate-header --context <tenant>` prints the header; compare its length with the current limit.

## What it looks like in practice

Most legacy extensions vendor their libraries inside the archive (d3, select2, moment, exceljs and others). The ones that load code from a CDN at run time failed on the test tenant:

- A timeline extension loads Google Charts from `www.gstatic.com`; the chart stayed blank.
- A tabbed-container extension points a `require.config` path at `cdnjs.cloudflare.com` (FileSaver). Its own files loaded, the request to cdnjs was blocked, and Sense reported "Invalid visualization".

Rebuilt versions that bundle FileSaver from npm and redraw the timeline in plain SVG render without any CSP entry.

## What to do with each kind of resource

| Resource | Do |
|---|---|
| JavaScript library (CDN, `require.config` path, `define(['https://...'])`, `<script src>`) | `npm install` it at the version its header or URL states and bundle it (`packaging-and-deploy.md`). A loader that fetches code at run time (`google.charts.load`) cannot be bundled: re-implement, or keep the origin and report it |
| Stylesheet (`@import url(http...)`, `<link href>`) | Install from npm and `import` it, or copy the rules into your own scoped CSS |
| Web font | Embed the glyphs you use as inline SVG or a `data:` URI (`styling-and-assets.md`), or bundle the font file |
| Image or icon | Inline SVG, or a `data:` URI. `nebula build` has no image loader (its plugins are babel, postcss, json, node-resolve, commonjs and terser), so `import './logo.png'` fails: turn the file into a JS module once, `node -e "console.log('export default ' + JSON.stringify('data:image/png;base64,' + require('fs').readFileSync(process.argv[1]).toString('base64')))" logo.png > src/logo.js`, and import that. Base64 adds about a third, so shrink or compress first |
| Image too large to inline (hundreds of KB or more) | Resize or compress first. If it really must stay large, Qlik's help page says to host it outside the archive and allow-list the origin: keep it out of the extension only then, and report the origin and `img-src` |
| Data or API request (`fetch`, `$.ajax`, host-relative `/api/...`) | Prefer the engine (`useModel`, `useApp`). A call to another origin needs `connect-src`; a call to the tenant's own REST API is not available outside Sense (`host.relative-fetch`) |
| A link the user clicks (`<a href="https://...">`, `window.open`) | No CSP entry needed: navigation is not a subresource request |

Do not ask the admin for broad entries (`*`, a whole CDN domain) as a shortcut: a bundled copy needs none, and each entry is one origin.

## Finding them

- `node <skill-dir>/scripts/inventory.mjs <legacy-dir>` reports AMD dependencies that are URLs (`amd.external-url`) and URL literals used to load something (`host.external-url`, `cdn.google-charts`). Link-only URLs are not reported.
- `check-no-host-apis.mjs` warns on the same patterns in the new source. After the build, `check-package.mjs` lists every host name that appears in the output files: most are strings inside bundled libraries, so read the list rather than allow-listing it.
- In a host, open the browser console and the Network tab, or run this before loading the object; it prints the directive and URL for each blocked request:

```js
document.addEventListener('securitypolicyviolation', (e) => console.log(e.effectiveDirective, e.blockedURI));
```

Put the result in the report under "External origins needing a tenant CSP entry", with the directive for each.
