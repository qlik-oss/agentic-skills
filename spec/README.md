# Skill Specification

This directory documents the `SKILL.md` frontmatter format used in this repository.

## Required frontmatter fields

| Field | Type | Description |
|---|---|---|
| name | string | Identifier unique across all canonical skill roots. Lowercase alphanumeric with hyphens. Must match folder name. |
| description | string | Trigger description the agent uses to decide when to load this skill. |
| license | string | SPDX identifier (e.g. `Apache-2.0`). |
| metadata.author | string | Skill author (use your GitHub username for contributions). |
| metadata.version | string | Semver string e.g. `1.0.0`. Must increase whenever any file in the skill changes — see [Versioning](../CONTRIBUTING.md#versioning). |

## Optional frontmatter fields

| Field | Type | Description |
|---|---|---|
| allowed-tools | string | Space-separated list of required tools (e.g. `read bash`). |
| metadata.tags | list | Searchable tags e.g. `["qlik", "analytics"]`. |
| metadata.deprecated | boolean | Set to true to mark the skill as deprecated. |

For the upstream Agent Skills spec, see https://agentskills.io/specification.

## Skill location

Skills live in `<area>/skills/<name>/SKILL.md`. Qlik Answers skills live in `answers/skills/<name>/SKILL.md`. See [CONTRIBUTING.md](../CONTRIBUTING.md#choose-a-location).
