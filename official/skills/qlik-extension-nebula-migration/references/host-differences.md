# Qlik Cloud and client-managed: what differs

Qlik documents nebula.js extensions for both products. This skill assumes a client-managed release recent enough to support them: confirm the minimum version in the release notes of the one you target. Recommend testing in the exact environment the user runs and report per host; do not claim parity.

| Topic | Qlik Cloud | Client-managed |
|---|---|---|
| Upload | Management console > Extensions, or REST/CLI; roles and size limits in `packaging-and-deploy.md` | Extensions folder, Dev Hub (legacy workflow), or QMC import |
| Content security policy | Tenant CSP allowlist (`external-resources.md`); a blocked request fails silently and the extension may not render | Depends on the deployment's web security configuration; not covered by this skill |
| Export (as documented in October 2026; recheck) | Data export to XLSX works with a hypercube; image, PDF and PowerPoint export are not supported for extensions; third-party extensions are not exported in Qlik Cloud Analytics | Image/PDF/PowerPoint export are available, and fail for extensions that use external resources or undocumented modules |
| AngularJS | The capability and extension APIs in Qlik Cloud do not expose several methods (`sessionApp`, `getGlobal`, `callRepository`, `getExtensionList`, `exportData/Img/Pdf`) | AngularJS support is provided by the platform for client-managed; irrelevant after migration, because this skill does not use it |
| Download of extension archives | Tenant Admin or Analytics Admin only | Files live on the server |
| `galaxy.anything.sense` | Present in the Sense client | Present in the Sense client |
| Dev tooling | `nebula serve` against a tenant | `nebula serve` against a local or remote engine; Dev Hub for legacy extensions |

## Test plan to hand to the user

For each host they use (and a copy of production data):

1. Install the side-by-side build (`<original-id>-nebula`) next to the old extension.
2. Create the same chart with both and compare: data, empty/undersized states, long labels, themes (default and a custom or dark theme), resize, mobile/touch if used.
3. Selections: single, multiple, confirm, cancel, clear, and behavior in edit mode.
4. Property panel: every setting, expressions in settings, show conditions.
5. Snapshot, story, data export, and any reporting/export workflow the legacy chart was used in.
6. Open a chart that was saved by the old extension (before the rename step).
7. Content security policy: any external origin the extension needs.
