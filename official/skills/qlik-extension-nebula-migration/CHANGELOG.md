# Changelog

## 1.0.0

- Initial version.
- Workflow: inventory the legacy extension, scaffold a `<original-id>-nebula` side-by-side build (`scripts/nebula-id.mjs`), port with a compatibility shim, make it idiomatic, package, check drop-in compatibility, then recommend renaming to the original id.
- Hard rule: the migrated extension uses no APIs or frameworks from the host (Sense client) page, enforced by `scripts/check-no-host-apis.mjs`.
- Optional React renderer.
- jQuery to native DOM cheat-sheet (`references/jquery-to-dom.md`) for stage 2.
- Read-only scripts, no dependencies: `nebula-id`, `inventory`, `check-no-host-apis`, `check-package`, `check-panel`, `check-compat`.
- Tested on real open-source legacy extensions and in a Qlik Cloud tenant: side-by-side builds rendered with no console errors, opened their own property panel, and passed the selection and variable checks run (`references/sources.md`).
- Rebuilt several extensions from scratch using only the skill, then replaced the originals on a Qlik Cloud tenant with the renamed builds: existing objects rendered with the new code. The findings changed the scripts (optional chaining, `qlik` identifier, `document.body` appends, host-relative requests, `lui-` strings versus classes, legacy `snapshot` form, removed option values) and the docs (ESLint command, licence and preview handling, stage 1 criteria, rename procedure, host styles the legacy code relied on).
- Rule 6 and `references/external-resources.md`: ship everything inside the extension (libraries, fonts, images); what Qlik Cloud blocks and allows (tested); the security and CSP-budget reasons; detection of run-time loads from other origins in `inventory.mjs` and `check-no-host-apis.mjs`.
- Gap review: attribute expressions, calculation condition, master-library items, alternative dimensions and measures, alternate states, hook rules, pivot shapes and snapshot format. The panel patterns were verified in Qlik Cloud (October 2026); the inventory flags the legacy data-model features.
