# AGENTS.md

This repository is the source for Qlik Agent Skills content and Claude plugin metadata.

## Operating principles

- Prefer evidence-based changes over aspirational wording.
- Keep repo-local validation scoped to the files and paths that are actually checked by CI.
- Do not claim cross-runtime compatibility unless it is verified in that runtime.
- Do not require personal Claude or other vendor account access for routine repository validation.
- Separate required repo-local checks from optional host-specific runtime verification.

## Required validation

Run these before considering a change ready for review:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run validate:spec
corepack pnpm run validate:claude
```

## CI scope

The repo’s automated validation is intentionally scoped to the relevant repo paths.

- Skill spec validation is defined in `.github/workflows/validate-skill-spec.yml`
- Claude plugin validation is defined in `.github/workflows/validate-claude-plugin.yml`

Do not widen those workflows unless the repo policy explicitly changes.

## Documentation standards

When editing docs or repo messaging:

- avoid broad claims like “works everywhere” or “fully supported across all tools” unless the support is explicitly validated per host runtime
- prefer language like “designed for Agent Skills-compatible runtimes” or “should be verified in the consuming host environment”
- keep PR and review guidance aligned with the repo’s actual validation gates

## Review expectations

- Required for routine repo changes: the repo-local validation commands above
- Optional and host-specific: runtime checks that depend on a specific agent or Claude installation flow
- Personal vendor account access should not be required for normal contribution and review flow
- If a change introduces scripts, network access, file I/O, or external dependencies, document the need, keep the scope narrow, and prefer least-privilege permissions
- Never add secrets, credentials, user data, or tokens to skills, examples, or docs

## Files to check when editing repo guidance

- `README.md`
- `CONTRIBUTING.md`
- `.github/pull_request_template.md`
- `.github/workflows/validate-skill-spec.yml`
- `.github/workflows/validate-claude-plugin.yml`
- `.claude-plugin/marketplace.json`
