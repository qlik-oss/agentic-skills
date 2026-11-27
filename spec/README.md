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
| metadata.provenance | string | Contribution origin: `qlik` or `community`. |
| metadata.tags | list | Searchable tags. Must contain `qlik-contributed` or `community-contributed`, matching `metadata.provenance`, and not both. |

## Optional frontmatter fields

| Field | Type | Description |
|---|---|---|
| allowed-tools | string | Space-separated list of required tools (e.g. `read bash`). |
| metadata.deprecated | boolean | Set to true to mark the skill as deprecated. |

## Contribution provenance

`qlik` means the skill originated as a Qlik contribution. `community` means it originated as a community contribution. Provenance records origin and primary stewardship; it does not determine licence, package membership or Qlik Support coverage.

Keep the structured field and its matching discovery tag aligned:

```yaml
metadata:
  provenance: qlik
  tags:
    - qlik-contributed
```

or:

```yaml
metadata:
  provenance: community
  tags:
    - community-contributed
```

For the upstream Agent Skills spec, see https://agentskills.io/specification.

## Skill location

Skills live in `<area>/skills/<name>/SKILL.md`. Qlik Answers skills live in `answers/skills/<name>/SKILL.md`. See [CONTRIBUTING.md](../CONTRIBUTING.md#choose-a-location).
