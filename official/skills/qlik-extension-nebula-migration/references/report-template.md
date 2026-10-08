# Migration report template

Write this at the end of every run as `MIGRATION.md` next to the new project and summarize it in chat. Replace every placeholder. Report what was run, not what was intended.

```markdown
# <Original name> -> nebula.js migration report

## Result
- Original extension: <original id> (<display name>), <version>
- New extension id: <original-id>-nebula (side by side) | <original id> (after the rename); display name <display name>; version <version>
- Renderer: <plain DOM | React>
- Status: <side-by-side build ready | renamed to original id>

## Checks run (local, repeatable)
| Check | Command | Result |
|---|---|---|
| Inventory of legacy extension | `node scripts/inventory.mjs <legacy-dir>` | <counts: direct / rewrite / host / review> |
| Host-API check (source + bundle) | `node scripts/check-no-host-apis.mjs <project> --bundle <folder>` | <pass / n failures> |
| Package check | `node scripts/check-package.mjs <folder> --expect-name <id>` | <pass / failures> |
| Panel check | `node scripts/check-panel.mjs <project>` | <pass / failure> |
| Compatibility check | `node scripts/check-compat.mjs <legacy-dir> <project>` | <no blocking difference found / NOT a drop-in> |
| Build | `npm run build && npm run sense` | <pass / fail> |

Repeat the table for the drop-in build (`--expect-name <original id>`) after the rename, and keep both zips. Run the host-API check twice when useful: without `--bundle` (source) and with it (built output).

## What changed
- Mapped directly: <list>
- Rewritten: <list, with the reason (for example AngularJS template)>
- Dropped or unsupported: <list, with the reason>
- Libraries now bundled: <name@version, ...> (previously provided by the host or a CDN: <...>)
- External origins needing a tenant CSP entry, with the directive for each (`script-src`, `style-src`, `font-src`, `img-src`, `connect-src`): <list or none>. Anything you could have bundled but did not: <reason>

## Drop-in decision
- <Renamed to the original id | Kept as <original-id>-nebula>
- Reason: <check-compat result; list each failure (property renamed, data path changed, limits changed)>
- Saved-object handling: <properties unchanged / added with fallbacks: ... / migration needed: ...>

## Known behavior differences
- <export / snapshot / navigation / keyboard / theme differences>

## Verification still required in your host (not performed by this skill)
Qlik Cloud:
- [ ] Upload `<zip>` (needs Tenant Admin, Analytics Admin or "Manage extensions")
- [ ] Property panel: every setting, expressions, show conditions
- [ ] Selections: single, multiple, confirm, cancel, clear; edit mode
- [ ] Chart saved by the old extension opens and behaves the same
- [ ] Snapshot, story, data export; image/PDF/PPT export is unsupported for extensions in Qlik Cloud
- [ ] CSP entries added for: <origins>
Client-managed (<version>):
- [ ] Same checklist, plus image/PDF/PPT export where the legacy chart supported it

## Rollback
- Original extension archive kept at: <path or "not kept">
```

Notes: write "no blocking difference found by static checks", never "compatible", for a passing `check-compat`; state the `author` set in the `.qext`; mark inferred mappings (tag `I`) under "Known behavior differences".
