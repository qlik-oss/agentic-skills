# Testing in a Qlik Cloud tenant

Static checks and a jsdom test (`testing-without-sense.md`) do not show that an extension works in Sense. This is the smallest host test that does. It changes a tenant: **use a throwaway tenant, get the user's explicit approval for each kind of change, and pass the context explicitly on every command** (the CLI's current context may be production).

| Step | Changes | Notes |
|---|---|---|
| `qlik extension create` | Adds a **tenant-wide** extension | Upload only the side-by-side build (`<original-id>-nebula`), never a drop-in that could replace an existing id. Check `qlik extension ls` for collisions first |
| `qlik app create` | One app in the personal space | Name it as disposable; do not edit existing apps |
| Opening the app | Nothing persistent | The user signs in; never enter credentials |

## Steps

```bash
CTX=<context-name>
qlik extension ls --context $CTX --json
qlik extension create --file <nebula-id>.zip --supernova --context $CTX --json
qlik app create --attributes-name "Nebula migration test - safe to delete" --context $CTX --quiet   # prints the app id
qlik app script set script.qvs --app <app-id> --context $CTX    # small INLINE data that the extension needs
qlik app reload --app <app-id> --context $CTX
qlik app object set objects.json --app <app-id> --context $CTX  # a sheet plus one object per extension
```

API-created objects get no initial properties. Set `qInfo.qType` and `visualization` to the extension id, the hypercube or list definition, and the contents of `src/object-properties.js`. A missing nested default breaks `show` callbacks and rendering (`data.props` undefined). List each object in the sheet's `cells` with `type` = the extension id. Open `https://<tenant>/sense/app/<app-id>/sheet/<sheet-id>/state/analysis`.

## What to check

1. **Renders.** Screenshot each sheet. A blank object or placeholder means an unmet data target or a bundle that did not load.
2. **Property panel.** Open `.../state/edit`, click the object, and read the right-hand panel: it must show the object's own sections. If it shows "Sheet properties", the definition has no Data section while targets are declared (`check-panel.mjs` catches this; no console error is raised).
3. **Interaction.** Click a selectable element and watch the selection bar and toolbar. Edit a setting. Hidden-in-analysis controls should appear in edit mode.
4. **Blocked requests.** A request to an origin the tenant has not allowed fails silently in the UI. Add `document.addEventListener('securitypolicyviolation', e => console.log(e.effectiveDirective, e.blockedURI))` before the object loads (`external-resources.md`).
5. **Console.** Read errors and attribute them before blaming the extension. The `jquery` warning is the host's own (`host-isolation.md`). A `show` callback that throws on `undefined` data means the test object lacks properties.
6. **Not covered:** export, snapshots, stories, and an object saved by the *original* extension. They stay on the user's checklist.

## Browser automation notes

- The extension's content can sit inside a shadow root, so `document.querySelector` finds nothing. Walk `element.shadowRoot` recursively when probing for inputs or text.
- Edit mode puts a `qv-ui-blocker` over objects. Dispatch events on the target element, or leave edit mode.
- Real clicks through a browser harness can degrade partway through a session; synthetic `pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click` events dispatched on the element are a reliable fallback.
- Two tabs on one app slow rendering; use one.

## Clean-up

Tell the user what was created (extension ids, app id) and how to remove it (Management console > Extensions; delete the app). Delete nothing they did not ask you to delete.
