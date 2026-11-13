# Framework templates

Replace every `<PLACEHOLDER>`. Keep secrets out of browser code. Majors at the
time of writing: `@qlik/embed-web-components` 1, `@qlik/embed-react` 2,
`@qlik/embed-svelte` 1, `@qlik/api` 2. When the page also uses `@qlik/api`,
use the shared host config templates in `qlik-api.md` instead of these.

## Web components

`index.html` (OAuth2 SPA):

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Embedded analytics</title>
    <script
      crossorigin="anonymous"
      type="application/javascript"
      src="https://cdn.jsdelivr.net/npm/@qlik/embed-web-components@1/dist/index.min.js"
      data-host="https://<TENANT>.<REGION>.qlikcloud.com"
      data-client-id="<OAUTH_SPA_CLIENT_ID>"
      data-redirect-uri="https://<YOUR_APP_ORIGIN>/oauth-callback.html"
      data-access-token-storage="session"
      data-auth-type="Oauth2"
      data-auto-redirect="true"
    ></script>
    <style>
      .embed { width: 100%; height: 480px; }
      .embed qlik-embed { display: block; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div class="embed">
      <qlik-embed ui="analytics/chart" app-id="<APP_ID>" object-id="<OBJECT_ID>"></qlik-embed>
    </div>
  </body>
</html>
```

Add `oauth-callback.html` from `authentication.md`.

Other auth paths keep `crossorigin`, `type`, and `src`, and swap the `data-*`
attributes:

- **Impersonation / Web client:** `data-host`, `data-client-id`,
  `data-auth-type="Oauth2"`, `data-get-access-token="getAccessToken"`, plus:
  ```html
  <script>
    async function getAccessToken() {
      const res = await fetch("/qlik/access-token", { method: "POST", credentials: "include", mode: "same-origin" });
      if (res.status === 200) return res.text();
      throw new Error(`Could not get a Qlik access token: ${res.status}`);
    }
  </script>
  ```
- **Web integration:** `data-host`, `data-web-integration-id="<ID>"`,
  `data-cross-site-cookies="true"`.
- **Anonymous:** `data-host` (an `se` tenant), `data-client-id`,
  `data-access-code="<ACCESS_CODE>"`, `data-auth-type="anonymous"`.

UI snippets:

```html
<qlik-embed ui="analytics/sheet" app-id="<APP_ID>" sheet-id="<SHEET_ID>"></qlik-embed>
<qlik-embed ui="analytics/sheet" app-id="<APP_ID>" sheet-id="<SHEET_ID>" preview="true"></qlik-embed>
<qlik-embed ui="classic/app" app-id="<APP_ID>" sheet-id="<SHEET_ID>"></qlik-embed>
<qlik-embed ui="analytics/chart" app-id="<APP_ID>" type="barchart"
  dimensions='["[Region]"]' measures='["=Sum(Sales)"]'></qlik-embed>
<qlik-embed ui="analytics/chart" app-id="<APP_ID>" object-id="<OBJECT_ID>"
  context___json="{interactions:{active:false, select:false}}"></qlik-embed>
<qlik-embed ui="analytics/field" app-id="<APP_ID>" field-id="Region"></qlik-embed>
<qlik-embed ui="analytics/selections" app-id="<APP_ID>"></qlik-embed>
```

Chart on the fly with full objects, set from script:

```html
<qlik-embed id="chart" ui="analytics/chart" app-id="<APP_ID>" type="barchart"></qlik-embed>
<script>
  const fields = [
    { qDef: { qFieldDefs: ["Region"], qFieldLabels: ["Sales region"] } },
    { qDef: { qLabel: "Total sales", qDef: "Sum(Sales)" } },
  ];
  customElements.whenDefined("qlik-embed").then(() => {
    document.getElementById("chart").setAttribute("dimensions", JSON.stringify(fields));
  });
</script>
```

## React (`@qlik/embed-react`)

`src/qlik.ts`:

```ts
import type { HostConfig } from "@qlik/embed-react";

// OAuth2 SPA
export const hostConfig: HostConfig = {
  host: "https://<TENANT>.<REGION>.qlikcloud.com",
  clientId: "<OAUTH_SPA_CLIENT_ID>",
  redirectUri: `${window.location.origin}/oauth-callback.html`,
  accessTokenStorage: "session",
  autoRedirect: true,
};

// Impersonation / Web client instead:
// export const hostConfig: HostConfig = {
//   authType: "oauth2",
//   host: "https://<TENANT>.<REGION>.qlikcloud.com",
//   clientId: "<OAUTH_CLIENT_ID>",
//   getAccessToken: async () => {
//     const res = await fetch("/qlik/access-token", { method: "POST", credentials: "include" });
//     if (!res.ok) throw new Error(`Qlik token request failed: ${res.status}`);
//     return res.text();
//   },
// };
```

`src/App.tsx`:

```tsx
import { QlikEmbed, QlikEmbedConfig } from "@qlik/embed-react";
import { hostConfig } from "./qlik";

export default function App() {
  return (
    <QlikEmbedConfig.Provider value={hostConfig}>
      <div style={{ width: "100%", height: 480 }}>
        <QlikEmbed ui="analytics/chart" appId="<APP_ID>" objectId="<OBJECT_ID>" />
      </div>
    </QlikEmbedConfig.Provider>
  );
}
```

Other UIs: `<QlikEmbed ui="analytics/sheet" appId sheetId />`,
`<QlikEmbed ui="classic/app" app sheet />`, chart on the fly with
`type`, `dimensions={["[Region]"]}`, `measures={["=Sum(Sales)"]}`, read-only
with `context={{ interactions: { active: false, select: false } }}`.

Preview mode: the 2.x types don't declare `preview`, but the wrapper forwards
it. Use a stable props object with a narrow cast:

```tsx
import { QlikEmbed, type QlikEmbedReactProps } from "@qlik/embed-react";

const previewSheet = {
  ui: "analytics/sheet",
  appId: "<APP_ID>",
  sheetId: "<SHEET_ID>",
  preview: true,
} as QlikEmbedReactProps;

<QlikEmbed {...previewSheet} />
```

- Define props objects outside the component or with `useMemo`: a new object
  each render re-applies props in a loop.
- Put `oauth-callback.html` in `public/`.
- For the ref API, pass a state setter as `ref` (`ref={setApi}`): it's set
  once the API loads (template in `qlik-api.md`).
- Next.js: render in a client component (`"use client"`), with
  `dynamic(..., { ssr: false })` if a server render pulls it in.

## Svelte (`@qlik/embed-svelte`)

`src/main.ts`:

```ts
import { mount } from "svelte";
import { importRuntimeModule } from "@qlik/runtime-module-loader";
import type { HostConfig } from "@qlik/embed-runtime/auth";
import App from "./App.svelte";

const hostConfig: HostConfig = {
  host: "https://<TENANT>.<REGION>.qlikcloud.com",
  clientId: "<OAUTH_SPA_CLIENT_ID>",
  redirectUri: `${window.location.origin}/oauth-callback.html`,
  autoRedirect: true,
};

importRuntimeModule("auth@v1", hostConfig).then((authModule) => {
  authModule.setDefaultHostConfig(hostConfig);
});

export default mount(App, { target: document.getElementById("app")! });
```

`src/App.svelte`:

```svelte
<script lang="ts">
  import QlikEmbed from "@qlik/embed-svelte";
</script>

<div style="width: 100%; height: 480px">
  <QlikEmbed ui="analytics/chart" appId="<APP_ID>" objectId="<OBJECT_ID>" />
</div>
```

- Preview mode: `preview={true}`.
- The package has no type declarations: add `src/qlik-embed-svelte.d.ts` with
  `declare module "@qlik/embed-svelte";`.
- In Svelte 5, don't name a local variable `props` next to `$props()`.
- Add `oauth-callback.html` at the project root as a second
  `build.rollupOptions.input` in `vite.config.ts`. SvelteKit:
  <https://qlik.dev/embed/qlik-embed/quickstart/qlik-embed-sveltekit-quickstart/>.

## Backend token route

Use the Node.js route in `authentication.md`. Read `QLIK_TENANT_URL`,
`QLIK_OAUTH_CLIENT_ID`, and `QLIK_OAUTH_CLIENT_SECRET` from the environment,
generate a `.env.example` with empty values, and keep `.env` in `.gitignore`.
Other backends: `POST https://<TENANT>/oauth/token` with
`grant_type=urn:qlik:oauth:user-impersonation`, `client_id`, `client_secret`,
`user_lookup: {field: "subject", value: <subject>}`, `scope: "user_default"`.
