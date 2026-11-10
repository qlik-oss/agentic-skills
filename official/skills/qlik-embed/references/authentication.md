# Authentication for qlik-embed (Qlik Cloud)

Sources:
- <https://qlik.dev/embed/qlik-embed/authenticate/connect-qlik-embed/>
- <https://qlik.dev/authenticate/oauth/>
- <https://qlik.dev/embed/foundational-knowledge/best-practice-auth/>

With OAuth2 SPA, OAuth2 impersonation, the OAuth2 Web client, and the web
integration ID, Qlik sees each viewer as their own user. Space permissions and
section access apply as in Qlik Cloud. Creating OAuth clients and web
integrations needs the **Tenant Admin** role.

## Choosing a path

| Path | Use when | Secret on a backend? | User sees Qlik login? |
|---|---|---|---|
| **OAuth2 SPA** (default) | Web app and tenant share one identity provider | No | Yes (once, often silent with SSO) |
| **OAuth2 M2M impersonation** | Different identity provider, or no redirects allowed; app has a backend that knows who the user is | Yes | No |
| **OAuth2 Web client** | App has a backend and wants the OAuth exchange server-side; users still sign in through the tenant's identity provider | Yes | Yes |
| **Web integration ID** | Qlik and the web app share a parent domain; cookies acceptable | No | Yes (Qlik session cookie) |
| **Anonymous embed** | Public website, no sign-in; tenant in the `se` region | No | No |

Do not use API keys for embedding. The key is visible in the page, carries its
creator's full permissions, and does not support browser WebSocket connections.

## OAuth2 SPA (recommended)

**Tenant setup** (Administration → **OAuth** → **Create new**):
1. **Client type:** `Single-page app`.
2. **Scopes:** `user_default`.
3. **Redirect URLs:** one absolute callback URL, e.g.
   `https://portal.example.com/oauth-callback.html`. Use a single callback page
   rather than registering every route.
4. **Allowed origins:** the web app's origin, e.g. `https://portal.example.com`
   (add `http://localhost:<port>` for local development).
5. **Create** → copy the **Client ID**. There is no secret.

Source: <https://qlik.dev/authenticate/oauth/create/create-oauth-client-spa/>

**Web app:**
- Script attributes: `data-host`, `data-client-id`, `data-redirect-uri`,
  `data-access-token-storage="session"`, `data-auth-type="Oauth2"`. Optionally
  add `data-auto-redirect="true"` to skip the consent prompt and redirect
  straight to login.
- Callback page using the `@qlik/api` handler, with the same `data-host`:

  ```html
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <script
        crossorigin="anonymous"
        type="application/javascript"
        data-host="https://<TENANT>.<REGION>.qlikcloud.com"
        src="https://cdn.jsdelivr.net/npm/@qlik/api@2/oauth-callback.iife.js"
      ></script>
    </head>
  </html>
  ```


The redirect URI must match exactly, and the callback's `data-host` must match
the embed page's. `@qlik/api` on the same page reuses this client and callback
page.

## OAuth2 M2M impersonation

The backend asks Qlik Cloud for an access token on behalf of the signed-in user
and hands it to the browser.

Sources: <https://qlik.dev/authenticate/oauth/implement-oauth-impersonation/>,
<https://qlik.dev/authenticate/oauth/guiding-principles-oauth-impersonation/>

**Tenant setup** (Administration → **OAuth** → **Create new**):
1. **Client type:** `Web`.
2. **Scopes:** `user_default` (set scopes explicitly; keep them minimal).
3. **Allowed origins:** the web app's origin (the browser uses the token).
4. Tick **Machine-to-machine impersonation**.
5. **Authentication method:** client secret, or Private Key JWT.
6. **Create** → store the Client ID and secret in the backend's secret store.
7. **…** → **Change consent method** → **Trusted**.

Use a **separate** M2M client (without impersonation) for any admin tasks such as
creating users or groups. Don't give the impersonation client admin scopes.

**Backend:** a route that only signed-in users can call:

```js
import { auth } from "@qlik/api";

const qlikConfig = {
  authType: "oauth2", // in TypeScript, write "oauth2" as const
  host: process.env.QLIK_TENANT_URL,
  clientId: process.env.QLIK_OAUTH_CLIENT_ID,
  clientSecret: process.env.QLIK_OAUTH_CLIENT_SECRET,
};
auth.setDefaultHostConfig(qlikConfig);

app.post("/qlik/access-token", requireSignedInUser, async (req, res) => {
  try {
    const token = await auth.getAccessToken({
      hostConfig: { ...qlikConfig, userId: req.user.qlikUserId, noCache: true },
    });
    res.send(token);
  } catch {
    res.status(401).send("No access");
  }
});
```

Use `subject` instead of `userId` to look the user up by identity provider
subject. `qlik-api.md` ("Backend") adds calls as the same user.

**Web app:** script attributes `data-host`, `data-client-id` (the impersonation
client's ID), `data-auth-type="Oauth2"`, and `data-get-access-token="getAccessToken"`,
where `getAccessToken` is a global async function that `POST`s to the route
above with `credentials: "include"` and returns the token text. In React and
Svelte, pass `getAccessToken` as a function in the host config.

**Gotchas:** tokens last 6 hours by default. Never let the browser choose
`userId`; take it from the server-side session. The user must exist in the
tenant (create them ahead of time with an admin client, or on first request).

## OAuth2 Web client (confidential, authorization code)

The user signs in through the tenant's identity provider, but the code-for-token
exchange happens on the backend with the client secret. The backend then gives
the browser an access token the same way as impersonation.

qlik.dev has no end-to-end qlik-embed tutorial for this; tell the user to
verify it in their tenant.

**Tenant setup:** client type `Web`, scopes `user_default`, redirect URL pointing
at a **backend** callback route (e.g. `https://portal.example.com/auth/qlik/callback`),
allowed origin set to the web app, authentication by client secret or Private
Key JWT. Do **not** tick the machine-to-machine options.

**Backend:**
1. Redirect the user to `https://<TENANT>/oauth/authorize` with `client_id`,
   `redirect_uri`, `response_type=code`, `scope=user_default`, and a `state`
   value (plus PKCE if your OAuth library supports it).
2. On the callback, check `state`, then `POST` to `https://<TENANT>/oauth/token`
   with the code, client ID, and secret.
3. Keep tokens (and the refresh token) in the server-side session. Expose
   `POST /qlik/access-token` that returns the current access token, refreshing it
   if needed.

Use a maintained OAuth2 client library for the exchange.

**Web app:** same as impersonation (`data-get-access-token`).

## Web integration ID (cookie, not recommended)

Works only where the browser sends Qlik's session cookie to the tenant. In
practice that means the web app and tenant are same-site (for example a custom
domain on the same parent domain), or the browser allows third-party cookies.
Many browsers block those by default.

**Tenant setup:** Administration → **Web** → create a web integration and add
the web app's origin. Copy the ID.

**Web app:** `data-web-integration-id="<ID>"` and `data-cross-site-cookies="true"`
(or `false` if same domain). Users must have signed in to the tenant in the same
browser.

## Anonymous embed

**Limits:** Europe (Stockholm) `se` region only; not in Qlik Cloud Government;
visualization extensions are not supported.

**Tenant setup:**
1. Administration → **OAuth** → **Create new** → **Client type:**
   `Anonymous embed` → add the web app's allowed origin → **Create** → copy the
   Client ID.
2. Share the app with anonymous users ("anyone with the link") and copy the
   **access code**.

**Web app:** `data-auth-type="anonymous"`, `data-client-id`, and
`data-access-code`.

Sources: <https://qlik.dev/authenticate/oauth/create/create-oauth-client-anonymous/>,
<https://qlik.dev/embed/qlik-embed/quickstart/qlik-embed-anonymous-tutorial/>

## Roles and access for end users

- End users need at least view access to the space holding the app.
- For `classic/app`, alerts, subscriptions, and monitored charts open the Qlik
  Cloud hub. To keep users inside the web app, turn those features off and
  assign the **Embedded Analytics User** role.
