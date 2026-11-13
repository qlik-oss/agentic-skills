# Contributing to Qlik Agent Skills

Anyone can contribute to any area. All contributions follow the same review process.

## Choose a location

Put each skill in `<area>/skills/<skill-name>/`, choosing the area that matches the task. Every area uses this layout:

```text
<area>/
  README.md
  plugin.json
  .claude-plugin/plugin.json
  LICENSE
  NOTICE
  skills/
    <skill-name>/
      SKILL.md
      references/           # Optional
      scripts/              # Optional
      assets/               # Optional
```

`answers/skills/` uses the same skill layout for Qlik Answers and is not part of any plugin. `template/skill/` is a starter, not an area.

Search for an existing skill before adding one. Each skill has one location; link to related skills instead of copying them.

## Write a skill

Start from [template/skill](template/skill/). Frontmatter fields are defined in [spec/README.md](spec/README.md).

- The directory name must match the frontmatter `name`, and names must be unique across the repository.
- Write a `description` that states the task and when to use the skill. Avoid broad triggers.
- Include your authorship and an SPDX licence identifier.
- Keep `SKILL.md` focused. Put supporting detail in `references/`, helpers in `scripts/` and output resources in `assets/`.
- Keep required resources inside the skill directory. If a skill depends on another skill, name it and make sure both are in the same plugin.
- Document prerequisites, file writes, external dependencies and network access. Request the least tool access needed.
- Include a realistic example. Update the area README when its skills change.

Adding a skill to an area adds it to that area's plugin, so increase the plugin version. Do not add skills to the legacy `qlik-cloud-skills` or `qlik-cloud-community-skills` plugins.

## Versioning

Every skill has a semver `metadata.version`. Any change to a file in an existing skill directory requires a higher version than on `main`. Patch, minor and major increases are all accepted.

- Each changed skill needs its own bump, including changes to references, scripts or assets only.
- Moving a skill without renaming it keeps its version history and requires a bump.
- New skills, deleted skills and `template/` are exempt. A renamed skill counts as a new skill.
- To roll back, revert the content and set a version above the one on `main`.

Plugin versions are separate from skill versions. Increase a plugin's version when its content or membership changes, and keep `plugin.json` and `.claude-plugin/plugin.json` aligned.

## Validate before review

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run validate:spec
corepack pnpm run validate:versions
corepack pnpm run validate:claude
corepack pnpm run validate:plugins
corepack pnpm run test:scripts
```

These checks need no Claude, Codex, Kiro or Qlik account. `validate:spec` checks skill frontmatter and locations, and `validate:versions` checks version increases against `main`. `validate:claude` and `validate:plugins` check the manifests and marketplaces.

You can also run the upstream validator: `skills-ref validate <area>/skills/<skill-name>/`.

## Review and CI

Open a PR that describes the task, the affected skills and plugins, and your validation results. [CODEOWNERS](.github/CODEOWNERS) assigns reviewers.

- [Skill validation](.github/workflows/validate-skill-spec.yml) runs on `*/skills/**`, the spec and validation scripts. On PRs it also checks version increases.
- [Claude validation](.github/workflows/validate-claude-plugin.yml) runs on the Claude marketplace and manifests.
- [Package validation](.github/workflows/validate-agent-plugins.yml) runs on package files, both marketplaces and packaging scripts.
- [Skill lint](.github/workflows/lint-skills.yml) is advisory.

Treat any failing validation as blocking.

## Add an area

1. Create `<area>/` using the layout above, with a README describing what the plugin does and its prerequisites.
2. Set the plugin identifier as `name` in both manifests.
3. Add the plugin to `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`.
4. Add `/<area>/` to `.github/CODEOWNERS` with the base and community maintainers, as for the other areas. Without it, only the base maintainers are asked to review.

Validation and CI pick up new areas automatically.

## Security

Never add secrets, credentials, personal tenant data or instructions that bypass host controls. Explain why a skill needs scripts, file access or external resources. Changes that fetch external content need maintainer review.

Report vulnerabilities privately to `security@qlik.com` with the subject `[Agent Skills] Vulnerability Report`. Use issues for bugs and suggestions, and discussions for design questions. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
