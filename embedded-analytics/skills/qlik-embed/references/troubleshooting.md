# Troubleshooting embedded content

Ask for the browser console and network errors; don't guess past them.

| Symptom | Likely cause | Fix |
|---|---|---|
| Nothing renders, no errors | Container has zero height | Give the parent a height; make `qlik-embed` `display:block; height:100%`. |
| Redirect loop or OAuth error | Redirect URI mismatch | Match `data-redirect-uri` / `redirectUri` exactly (scheme, host, port, path). |
| CORS error, `origin not allowed` | Missing allowed origin | Add the web app origin to the OAuth client (or web integration for non-oauth). |
| Callback page stays blank | Different `data-host`, or callback script didn't load | Same tenant host on both pages; check the script URL. |
| 401 from the token route | Wrong secret, impersonation off, user missing, scope missing | Check **Machine-to-machine impersonation**, `user_default`, the user exists, `QLIK_TENANT_URL`. |
| Fails after hours | Token expiry (6 hours by default) | Return a fresh token on every `getAccessToken` call (`noCache: true`). |
| "App not found" / access denied | No space access, or the item ID was used | Check space membership; use the app's resource ID (GUID). |
| Tiles empty or "Unknown chart" | Non-nebula chart or extension in default mode | Add `preview="true"`. In React, check the prop reaches the embed (cast in `frameworks.md`). |
| Titles but no charts, no errors | Window hidden, minimized, or covered | Expected; charts draw once the window is visible. |
| Preview embeds lower on the page stay empty | Preview mode renders only once scrolled into view | Expected; scroll to them first for screenshots or checks. |
| Second copy of an extension is empty | Same extension object twice on a page | Embed each extension object once. |
| `qlik-embed:ready` fired but nothing drew | It also fires for placeholders and empty tiles | Check the rendered content. |
| Write table empty or errors | Unsupported in every embed UI | Expected; it has to be used in Qlik Cloud. |
| Chart on the fly: master dimension shows one total row | `"[Title]"` string form | Use `{"qLibraryId":"<id>","type":"dimension"}`. |
| Chart on the fly: doubled dimensions | `properties` has a `qHyperCubeDef` | Remove it; define fields in `dimensions`. |
| KPI charset error | Page isn't UTF-8 | Add `<meta charset="utf-8">`. |
| Custom theme fonts missing | Cross-domain font loading | `iframe="true"` on `classic/chart`, or accept fallback fonts. |
| Selections leak between embeds (or don't sync) | Shared vs separate sessions | Same `identity` shares; different values isolate. |
| `classic/app` ignores `select` | No `sheet-id` | Add `sheet-id`, or use `<qlik-initial-selections>`, @qlik/api or refApi on host page. |
| Web integration works in one browser only | Third-party cookies blocked | Move to OAuth2 SPA or impersonation. |
| Own list ignores the embed's selections | Different `identity`, or not re-read | Use the embed's `identity` or the ref API; re-read on `changed`. |
| Export fails for a chart on the fly | The Reports API doesn't document exporting them | Save the chart and export by object ID. |
| Exported PDF or PNG ignores the user's selections | No selections in the report request | Pass a temporary bookmark or `selectionsByState` (`qlik-api.md`, Export). |
| Report fails with `REP-429014` | Export deadline exceeded (10 minutes by default) | Raise `meta.exportDeadline`, or export less. |
| `exportData` fails | Not supported in Qlik Cloud | Use the Reports API (`qlik-api.md`). |
| `429 Too Many Requests` | Per-user rate limits | Wait for `Retry-After`; poll less often. |
| Anonymous embed fails | Tenant not in `se`, no access code, or extension | Check region, the app's anonymous share, native charts only. |
| Subscription shows a next run but never sends | It's paused (`enabled` missing) | Treat a missing `enabled` as paused. |
| "My subscriptions" empty | Repeated array query parameter | Pass arrays to `@qlik/api`, or join with commas. |

Further reading:
<https://qlik.dev/embed/foundational-knowledge/troubleshooting-developer-mashups-cloud/>
