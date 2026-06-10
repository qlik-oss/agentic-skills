# Skill Specification

This directory documents the `SKILL.md` frontmatter format used in this repository.

## Required frontmatter fields

| Field | Type | Description |
|---|---|---|
| name | string | Unique identifier. Lowercase, hyphens only. Must match folder name. |
| description | string | Trigger description the agent uses to decide when to load this skill. |
| license | string | SPDX identifier (e.g. `Apache-2.0`). |
| metadata.author | string | Skill author (use your GitHub username for contributions). |
| metadata.version | string | Semver string e.g. `1.0.0`. |

## Optional frontmatter fields

| Field | Type | Description |
|---|---|---|
| metadata.tags | list | Searchable tags e.g. `["qlik", "analytics"]`. |
| allowed-tools | string | Space-separated list of required tools (e.g. `read bash`). |
| min_sdk_version | string | Minimum compatible agent SDK version. |
| deprecated | boolean | Set to true to mark the skill as deprecated. |

For the upstream Agent Skills spec, see https://agentskills.io/specification.
