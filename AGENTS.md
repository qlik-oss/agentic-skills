# AGENTS.md

This repository is the source for task-focused Qlik Agent Skills, portable Agent Plugins packages and Claude plugin metadata.

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
corepack pnpm run validate:versions
corepack pnpm run validate:claude
corepack pnpm run validate:plugins
corepack pnpm run test:scripts
```

`validate:versions` compares your working tree with the merge base of `origin/main` (or `main`).

## Skill versioning

- Any change to a file inside an existing skill folder (`<category>/skills/<skill>/`) must increase that skill's `metadata.version`. Patch, minor, and major bumps are all accepted.
- Each changed skill needs its own bump; one PR can touch several skills.
- New skills, fully deleted skills, and `template/` are exempt.
- Rollbacks roll forward: revert the content, but set a version above the current one on `main`.

## CI scope

The repo’s automated validation is intentionally scoped to the relevant repo paths.

- Skill spec validation is defined in `.github/workflows/validate-skill-spec.yml`. It triggers on any file inside any `<category>/skills/` folder and, on pull requests, also runs the skill version-bump check.
- Claude plugin validation is defined in `.github/workflows/validate-claude-plugin.yml`.
- Portable package and selection validation is defined in `.github/workflows/validate-agent-plugins.yml`. This workflow uses category-independent paths (`*/skills/**`, `*/plugin.json`, `*/.claude-plugin/**` and package notices), both catalogues and packaging tooling. Answers skill changes can trigger it, but Answers remains excluded from plugin membership.
- Skill lint remains advisory in `.github/workflows/lint-skills.yml`.

These are not required status checks in branch protection: a failure is shown on the PR but does not block merging, so reviewers should treat a failing check as blocking.

Do not widen those workflows unless the repo policy explicitly changes.

## Organisation and ownership

- Each skill has one canonical location by task area. Preserve attribution, licences and applicable support notices.
- Maintenance review is routed through `.github/CODEOWNERS`; package inclusion does not create a Qlik Support commitment.
- Category packages use `<category>/` as their root and contain `plugin.json`, `.claude-plugin/plugin.json` and `skills/`. Keep manifest identities, descriptions and versions aligned.
- Increase plugin versions when packaged content or membership changes, including affected legacy entries. This release decision is reviewed separately from automated skill-version checks.
- Discover categories from the shared folder convention; do not add category allowlists to tooling or CI. Version comparisons discover skill locations from each Git revision, including removed categories.
- The legacy Claude plugins `qlik-cloud-skills` and `qlik-cloud-community-skills` keep their original membership until they are removed after 30 November 2026. Do not add skills to them.
- Generated/custom bundles must not introduce a second editable skill copy.

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
- `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`
- `INSTALLATION.md`
- Area `README.md` and both plugin manifests
- `.github/workflows/validate-agent-plugins.yml`
