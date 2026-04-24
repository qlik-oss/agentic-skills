# Official Skills

Skills in this directory are owned and maintained by Qlik engineering. They are the only skills enabled by default in Qlik's production agent environments and represent the canonical way to interact with the Qlik platform through an AI agent.

---

## Who maintains these skills

Official skills are authored and reviewed by members of the Qlik AI Platform team (`@qlik/ai-platform`). Every change goes through a pull request, passes automated spec validation and security scanning, and requires at least one team member review before merging.

If you find a bug or want to suggest an improvement to an official skill, open a GitHub issue — do not open a PR directly against this directory unless you are a member of `@qlik/ai-platform`.

---

## Available skills

| Skill | Description | Trigger phrases |
|---|---|---|
| [`qlik-ai-readiness-optimizer`](./qlik-ai-readiness-optimizer/) | Analyze and optimize a Qlik app for AI readiness (Qlik Answers and Qlik MCP) using the 6-Layer Model | "AI-ready", "optimize for Answers/MCP", "Qlik AI Health Check", "prepare app for AI" |

---

## Install

```bash
# Install all official skills
npx skills add qlik/agent-skills --skill '*' --agent '*'

# Install a specific official skill
npx skills add qlik/agent-skills --skill qlik-app-analysis
```

---

## Structure

Each official skill follows this layout:

```
skill-name/
├── SKILL.md            # Required — frontmatter + activation instructions
├── scripts/            # Optional — executable scripts (output only enters context)
├── references/         # Optional — detailed docs loaded on demand
└── assets/             # Optional — templates and static resources
```

All official skills:

- Keep `SKILL.md` under 300 lines, with detailed material in `references/`
- Declare `allowed-tools` explicitly in the frontmatter
- Use Qlik's canonical product terminology
- Include at least one worked example in `SKILL.md` or `references/`
- Are versioned using semver in `metadata.version`

---

## Versioning

Official skills follow semantic versioning:

- **Patch** (`1.0.x`) — wording fixes, clarifications, minor instruction improvements
- **Minor** (`1.x.0`) — new steps, new reference files, expanded coverage
- **Major** (`x.0.0`) — breaking changes to skill behavior, renamed trigger phrases, structural rewrites

The version is set in the `metadata.version` field of `SKILL.md`. Changelog entries are maintained in each skill's directory as `CHANGELOG.md`.

---

## Suggesting changes

To propose a change to an official skill:

1. Open a GitHub issue describing the problem or improvement.
2. A member of `@qlik/ai-platform` will triage and, if approved, either implement it or invite you to submit a PR.
3. PRs against `skills/official/` from non-team members will be closed and converted to issues.

For net-new workflows that don't fit an existing skill, consider contributing to [`skills/community/`](../community/) first. Community skills can be promoted to official if they see significant adoption and meet quality standards.
