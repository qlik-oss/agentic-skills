# Service calls: use `@qlik/api` (Qlik Cloud)

Legacy extensions reach Qlik services other than the engine (users, spaces, items, apps, automations, reloads and so on) with `$.ajax`, AngularJS `$http`, `fetch('/api/v1/...')` or `fetch('../api/v1/...')`, often with a CSRF token they fetch themselves, or with `qlik.callRepository` and `qlik.getAppList`. In the migrated extension, make these calls through [`@qlik/api`](https://github.com/qlik-oss/qlik-api-ts), bundled into the extension. Together with the Qlik runtime of the page it runs in, it takes care of the host, authentication and CSRF header, and the extension contains no URLs or credentials.

Engine data still comes from the hooks (`useModel`, `useApp`, `useGlobal`). Do not open a second engine session with `@qlik/api`'s `qix.openAppSession` (`host-isolation.md`).

## When this applies

| Host | Do |
|---|---|
| Qlik Cloud | Use `@qlik/api` for every REST call the extension needs |
| Client-managed | Usually not needed. `@qlik/api`'s REST modules target the Qlik Cloud APIs; the repository service (`/qrs/...`, `qlik.callRepository`) has no equivalent in this skill. Do not add `@qlik/api` for client-managed unless a feature needs it and you have tested it there. Otherwise keep that feature in the legacy extension or drop it, and report it |

## Set it up

1. Add it to `dependencies` (not `peerDependencies`) so `nebula build` bundles it. With the user's approval: `npm install --save-exact @qlik/api@latest`. Any version that has the functions you call works; take the latest when you add it. Do not rely on a copy on the host page.
2. Build with `--inlineDynamic`. `@qlik/api` loads parts of itself with dynamic `import()`, and a plain `nebula build` then fails with rollup's "when building multiple chunks, the "output.dir" option must be used" error. Set the script to `"build": "nebula build --inlineDynamic"` (observed with `@nebula.js/cli` 7.8.0 and `@qlik/api` 2.20.0, October 2026).
3. Import from the package root, as Qlik's own action button does: `import { spaces } from '@qlik/api'`. Type-only imports from subpaths (`@qlik/api/qix`) are fine.

With `spaces` the bundle was about 110 KB (minified); `check-package.mjs` and `check-no-host-apis.mjs --bundle` both pass, and the bundle's only AMD dependency is still `@nebula.js/stardust`.

## How the bundled copy reaches the tenant

In a browser, `@qlik/api` 2.x does not send REST requests itself. It loads the Qlik runtime (`window.QlikMain`) and hands each call to it; the runtime does authentication and the request. The runtime is shared on the page, so every bundled copy uses the same one (read from the `@qlik/api` 2.20.0 source and observed with stardust 7.8.0 in jsdom, October 2026):

| Page | What happens |
|---|---|
| A page that already has the runtime (the Qlik Cloud client, qlik-embed) | The bundled copy uses it. No host config is needed in the extension |
| A nebula.js mashup | The embedder passes `embed(app, { hostConfig })`. Stardust hands it to the chart as `galaxy.hostConfig` and loads the runtime from `https://<host>/qlik-embed/main.js`. The extension passes the host config on with each call (below). Write this requirement into `MIGRATION.md` |
| No runtime and no host config (`nebula serve` without a tenant, a jsdom test) | The call **never settles**: no request, no rejection (`timeoutMs` does not help); after 5 seconds the console says "Waiting for a host parameter pointing to a Qlik runtime system" |

That the Qlik Cloud client page provides the runtime, and what qlik-embed puts in `galaxy.hostConfig`, comes from the nebula.js maintainers; this skill has not observed it in a tenant. Confirm it in the user's host.

Never put a tenant URL, API key, client id or web integration id in the extension (Rule 7). Pass `galaxy.hostConfig` with each call when the host provides one, and put a time limit on the call so the chart still renders where no runtime is available:

```js
import { useElement, useEffect, usePromise } from '@nebula.js/stardust';
import { spaces } from '@qlik/api';
import properties from './object-properties';
import data from './data';
import ext from './ext';

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

export default function supernova(galaxy) {
  const options = galaxy.hostConfig ? { hostConfig: galaxy.hostConfig } : undefined;
  return {
    qae: { properties, data },
    ext: ext(galaxy),
    component() {
      const element = useElement();
      const [result, error] = usePromise(() => withTimeout(spaces.getSpaces({ limit: 10 }, options), 10000), []);
      useEffect(() => {
        if (error) {
          element.textContent = 'Spaces are not available here.';
          return;
        }
        if (result) element.textContent = result.data.data.map((s) => s.name).join(', ');
      }, [result, error]);
    },
  };
}
```

- The host config passed in a call's options reaches the runtime with that call. `auth.setDefaultHostConfig(galaxy.hostConfig)`, which `@nebula.js/sn-action-button` uses, also passes it to the runtime, but as the default for the runtime that the whole page shares, not only for this extension. Prefer the per-call option.
- Responses are `{ data, headers, status }`; the payload is in `data`.
- Render response values with `textContent` or by creating elements, never `innerHTML` (`dom.html-injection`), and do not `console.log` responses that hold user data.
- Give the call a state for "not available here" (no runtime, no permission, network error). The chart must still render.

## Mapping

| Legacy | Migrated |
|---|---|
| `$.ajax` / `$.get` / `$http.get` / `fetch` to `/api/v1/<service>/...` or `../api/v1/<service>/...` | The matching module function, for example `users.getMyUser()`, `spaces.getSpaces(query)`, `apps.getAppInfo(appId)`, `items.getItems(query)`, `automations.getAutomation(id)`, `automations.queueAutomationRun(id, body)`, `reloads.queueReload({ appId })` |
| Fetching `/api/v1/csrf-token` and setting `qlik-csrf-token` | Remove it for calls made through `@qlik/api`; the Qlik runtime handles authentication for them. Keep it only for a `fetch` you keep (next row) |
| `qlik.getAppList(cb)` | Qlik Cloud: `items.getItems({ resourceType: 'app' })`. Not available in Qlik Cloud through the Capability API anyway |
| `qlik.callRepository('/qrs/...')` | Repository service, client-managed only. No Qlik Cloud equivalent: drop the feature, or find the Qlik Cloud service that answers the same question and call it through `@qlik/api` |
| An endpoint that `@qlik/api` does not cover | Keep a `fetch` for that one call: build the URL from `galaxy.hostConfig?.host` or the page origin, and send the `qlik-csrf-token` header on modifying requests. `check-no-host-apis` warns about it (`host.relative-fetch`); record it in the report. Qlik's action button does this for the automation `actions/execute` endpoint |
| A call to another origin (not Qlik) | Not an `@qlik/api` case: needs a `connect-src` CSP entry (`external-resources.md`) |

Check the function names and arguments in the `@qlik/api` typings or the REST reference on qlik.dev; this table is a starting point, not an API list.

## Permissions and side effects

- Calls run as the signed-in user, with that user's permissions. A user who could not reach a service in the legacy extension cannot reach it now either; handle the error state.
- Calls that change something (queue a reload, run an automation, create or update items) must happen only on an explicit user action, as they did in the legacy extension. List each one in the report.
- Read only what the chart needs. Do not add calls that the legacy extension did not make.

## Testing

- Keep the calls in a small module (`src/services.js`) that takes the `@qlik/api` functions or a fake as an argument, so the jsdom test can pass a stub instead of reaching the network (`testing-without-sense.md`). Test the success, empty, error and timeout paths: a real call in jsdom never settles.
- In a host, check the Network tab: requests go to the tenant's own `/api/v1/...` and need no CSP entry. Then test in each host the user embeds into: the Qlik Cloud client, and a nebula.js mashup with a host config if they have one (`host-testing.md`).
