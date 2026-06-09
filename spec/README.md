# Skill Specification

This directory contains the Agent Skills specification for this repository.

## Required frontmatter fields

| Field | Type | Description |
|-------|------|-------------|
| name | string | Unique identifier. Lowercase, hyphens only. Must match folder name. |
| description | string | Trigger description the agent uses to decide when to load this skill. |
| trust_tier | enum | official, partner, or community |
| author | string | Name or organisation of the skill author. |

## Optional frontmatter fields

| Field | Type | Description |
|-------|------|-------------|
| version | string | Semver string e.g. 1.0.0 |
| tags | list | Searchable tags e.g. [qlik, analytics] |
| min_sdk_version | string | Minimum compatible agent SDK version |
| deprecated | boolean | Set to true to mark the skill as deprecated |

For the full specification, see skill-spec.md.
