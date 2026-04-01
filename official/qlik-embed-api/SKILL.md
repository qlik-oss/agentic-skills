---
name: qlik-embed-api
description: >-
  Build production-ready HTML pages that embed Qlik Sense objects using
  @qlik/embed-web-components (OAuth2 SPA) with custom D3/JavaScript
  charts powered by live Qlik hypercubes. ALWAYS use this skill when the
  user wants to embed Qlik with OAuth2, use qlik-embed web components,
  build a custom dashboard with live Qlik data, add interactive D3 or JS
  charts driven by Qlik's associative engine, create an embedded analytics
  page with custom interactivity beyond standard iframes, or needs
  SSO-style token-based embedding without third-party cookies. Triggers on
  phrases like "qlik-embed web components", "OAuth2 embed", "embed with
  OAuth", "custom D3 chart from Qlik", "@qlik/api", "hypercube in HTML",
  "qlik embed API", "custom dashboard with Qlik data", "embed Qlik
  without iframes", "interactive Qlik embed", or any request to build an
  embedded Qlik page with custom interactivity.
license: Apache-2.0
metadata:
  author: JoshQlikDesign
  version: 1.0.0
  tags:
    - qlik
    - embed
    - oauth2
    - d3
    - web-components
allowed-tools: read
---

# Qlik Embed API Skill

Generates production-ready HTML pages using **@qlik/embed-web-components** with **OAuth2 SPA** authentication — the modern alternative to iframe + Web Integration ID embedding.

Also covers **@qlik/api** for fetching live hypercube data to power custom D3.js or other JavaScript visualizations alongside embedded Qlik objects.

For design standards (CSS variables, typography, sizing), see [references/design-reference.md](references/design-reference.md).
For D3 chart templates and reactive redraw patterns, see [references/d3-templates.md](references/d3-templates.md).
For reactive selections, Clear All HUD, and error handling, see [references/advanced-patterns.md](references/advanced-patterns.md).

> **Last validated:** June 2025 · `@qlik/api@2` · `@qlik/embed-web-components` (unversioned CDN per Qlik recommendation)

## When to Use This Skill vs. qlik-embed (iframe)

| Scenario | Use This Skill | Use qlik-embed (iframe) |
|---|---|---|
| OAuth2 SPA authentication | ✅ | ❌ |
| Custom D3/JS charts from live Qlik data | ✅ | ❌ |
| Web component `<qlik-embed>` tags | ✅ | ❌ |
| Simple iframe embed, no custom charts | ❌ | ✅ |
| Web Integration ID auth | ❌ | ✅ |

---

## MANDATORY FIRST STEP — Prerequisites

**BEFORE generating any code**, walk the user through all four steps below. Do not skip any.

> **NEVER use `YOUR_CLIENT_ID` as a placeholder.** The error `"OAuth client is not authorized" (OAUTH-14)` is the immediate result. Walk through setup, then ask the user to paste their real Client ID.

### Step 1: Create the OAuth2 SPA Client in Qlik MC

Navigate to **MC → Integrations → OAuth**, click **Create New**:

| Field | Value |
|---|---|
| **Client type** | Single-Page Application (SPA) |
| **Allowed origins** | Your hosting domain (e.g. `https://qlikdork.com` — no trailing slash, no path) |
| **Redirect URIs** | Full callback URL (e.g. `https://qlikdork.com/oauth_callback.html`) |

> **Allowed origins ≠ Redirect URIs** — these are two separate fields. Missing either causes silent auth failure.

### Step 2: Add Required OAuth Scopes

Ensure `user_default` scope is enabled. Without it, auth completes but the engine returns "No permission to open app."

### Step 3: Assign User Roles in Qlik MC

Minimum role: **Analyzer** (can view and interact with apps).

### Step 4: Deploy the OAuth Callback Page

Host `oauth_callback.html` at the exact redirect URI registered:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Authenticating...</title>
  <script crossorigin="anonymous" type="application/javascript"
    data-host="https://{TENANT}"
    src="https://cdn.jsdelivr.net/npm/@qlik/embed-web-components/dist/oauth-callback.js">
  </script>
</head>
<body>
  <p style="font-family:monospace;color:#888;padding:40px;">Completing authentication...</p>
</body>
</html>
```

Use `oauth-callback.js` — NOT `index.min.js`. `data-host` must match the tenant URL exactly.

### Collect Before Generating Code

- Tenant URL (e.g. `https://partner-engineering-saas.us.qlikcloud.com`)
- OAuth2 Client ID (**wait for the user to paste the real ID**)
- Redirect URI (full URL to the callback page)
- Allowed origin (domain only)
- App ID (UUID)
- Object IDs to embed (and optionally their titles)

---

## Session Lifetime — No Refresh Token for SPA Clients

- Access token valid for **6 hours**, no refresh token (public client)
- After 6 hours, user must re-authenticate
- For unattended dashboards: reload the page on a timer or use server-side OAuth

---

## Main Page — Script Loading

```html
<!-- D3 (if using custom charts) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>

<!-- qlik-embed web components — OAuth2 SPA -->
<script crossorigin="anonymous" type="application/javascript"
  src="https://cdn.jsdelivr.net/npm/@qlik/embed-web-components"
  data-host="https://{TENANT}"
  data-auth-type="Oauth2"
  data-client-id="{CLIENT_ID}"
  data-redirect-uri="https://{YOUR_DOMAIN}/oauth_callback.html"
  data-auto-redirect="true">
</script>
```

**CDN rules:** Use **unversioned** CDN (`@qlik/embed-web-components` — no version pin). Pinned versions often resolve to non-existent paths.

## Embedding Qlik Objects — Web Components

```html
<qlik-embed ui="analytics/chart" app-id="{APP_ID}" object-id="{OBJECT_ID}"></qlik-embed>
<qlik-embed ui="classic/chart" app-id="{APP_ID}" object-id="{OBJECT_ID}"></qlik-embed>
<qlik-embed ui="analytics/app" app-id="{APP_ID}" sheet-id="{SHEET_ID}"></qlik-embed>
```

Always wrap in a sized div (shadow DOM blocks CSS attribute selectors):

```html
<div class="embed-wrap chart-size">
  <qlik-embed ui="analytics/chart" app-id="..." object-id="..."></qlik-embed>
</div>
```

See [references/design-reference.md](references/design-reference.md) for size classes and CSS definitions.

---

## Custom Charts — @qlik/api + D3

Use `@qlik/api` for custom JS charts. It **shares the OAuth session** with `@qlik/embed-web-components`.

> Do NOT use enigma.js + WebSocket with `?access_token=` — Qlik Cloud SaaS rejects this.

```html
<script type="module">
  import { auth, qix } from 'https://cdn.jsdelivr.net/npm/@qlik/api@2/index.min.js';

  auth.setDefaultHostConfig({
    host:               'https://{TENANT}',
    authType:           'Oauth2',
    clientId:           '{CLIENT_ID}',
    redirectUri:        'https://{YOUR_DOMAIN}/oauth_callback.html',
    accessTokenStorage: 'session',
    autoRedirect:       false,
  });
</script>
```

`auth.setDefaultHostConfig()` must match the qlik-embed config exactly. `autoRedirect: false` — let qlik-embed handle the redirect.

### Timing — Waiting for qlik-embed Auth

**Simple (default):** `setTimeout(initCustomChart, 2000);`

**Robust alternative (slow connections):**
```javascript
async function initWithRetry(maxAttempts = 5, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const appSession = qix.openAppSession({ appId: APP_ID });
      return await appSession.getDoc();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise(r => setTimeout(r, baseDelay * attempt));
    }
  }
}
```

## Hypercube Data Fetch Pattern

```javascript
const sessionObj = await app.createSessionObject({
  qInfo: { qType: 'MyCustomChart' },
  qHyperCubeDef: {
    qDimensions: [{ qDef: { qFieldDefs: ['[{DIMENSION_FIELD}]'] } }],
    qMeasures: [{ qDef: { qDef: '{MEASURE_EXPRESSION}', qLabel: '{LABEL}' } }],
    qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 20, qWidth: 2 }],
    qSuppressZero: true, qSuppressMissing: true
  }
});

const layout = await sessionObj.getLayout();
const rows   = layout.qHyperCube.qDataPages[0].qMatrix;

const data = rows
  .filter(row => row[0].qText && row[0].qText !== '-')
  .map(row => ({
    label:    row[0].qText,
    value:    row[1].qNum,
    selected: row[0].qState === 'S',
    excluded: row[0].qState === 'X' || row[0].qState === 'XS'
  }))
  .filter(d => d.value > 0)
  .sort((a, b) => b.value - a.value);
```

For reactive selections, the persistent reference pattern, `toggleSelection()`, Clear All HUD, error handling, and debugging, see [references/advanced-patterns.md](references/advanced-patterns.md).

For D3 chart templates and reactive in-place redraw, see [references/d3-templates.md](references/d3-templates.md).

---

## Output Checklist

Before presenting the final files, verify:

- [ ] OAuth setup steps presented BEFORE any code written
- [ ] Real Client ID obtained from user — no `YOUR_CLIENT_ID` placeholder
- [ ] `oauth_callback.html` uses `oauth-callback.js` (not `index.min.js`)
- [ ] `data-host` in callback matches tenant URL exactly
- [ ] Main page CDN is unversioned (no version pin)
- [ ] `auth.setDefaultHostConfig()` called before any `qix` operations
- [ ] `@qlik/api` config exactly matches qlik-embed config
- [ ] Web components wrapped in sized divs
- [ ] Filter panel divs are minimum 200px height
- [ ] All CSS uses `var()` custom properties — no hardcoded colors outside `:root`
- [ ] D3 init uses either `setTimeout(2000)` or retry-with-backoff
- [ ] X-axis uses `d3.format(',d')` not `d3.format(',s')` for integer data
- [ ] Null/missing rows filtered from hypercube results
- [ ] Field names verified against actual app fields
- [ ] `selObj` (SelectionObject) created for app-wide selection tracking
- [ ] `sessionObj.on('changed')` wired to D3 redraw
- [ ] Every D3 click handler calls `toggleSelection(fieldName, value)`
- [ ] D3 visual state reflects `qState` from hypercube layout
- [ ] Clear All HUD is `position: fixed; top: 18px; right: 24px`
- [ ] `appDoc.clearAll(false)` used for clearing
- [ ] Both files presented: `oauth_callback.html` + main HTML page
