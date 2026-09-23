# Official Skills

Skills in this directory are owned and maintained by Qlik engineering. They represent the standard, versioned way to interact with the Qlik platform through an AI agent.

---

## Who maintains these skills

Official skills are authored and reviewed by members of the `@qlik-oss/agentic-skills-official-maintainers` team. Every change goes through a pull request, passes automated spec validation in CI, is checked with a local security scan before merge, and requires at least one team member review before merging.

If you find a bug or want to suggest an improvement to an official skill, open a GitHub issue — do not open a PR directly against this directory unless you are a member of `@qlik-oss/agentic-skills-official-maintainers`.

---

## Available skills

| Skill | Author | Description |
|---|---|---|
| [qlik-ai-readiness-optimizer](qlik-ai-readiness-optimizer/) | JoshQlikDesign | Analyzes a Qlik app via MCP and optimizes it for AI use (Qlik Answers and Qlik MCP) using a 5-Layer Model. |
| [qlik-automation-builder](qlik-automation-builder/) | yeshQ | Builds Qlik Automate automations — translates natural-language requests into automation workspace JSON and can create, update, or delete automations via qlik-mcp. |

Each folder contains a `SKILL.md` with the full description and trigger phrases.

---

## Install

```bash
# Install all official skills
npx skills add qlik-oss/agentic-skills --skill '*' --agent '*'

# Install a specific official skill
npx skills add qlik-oss/agentic-skills --skill <skill-name>

# Install to a specific agent
npx skills add qlik-oss/agentic-skills --skill <skill-name> -a claude-code
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
- Use Qlik's official product terminology
- Include at least one worked example in `SKILL.md` or `references/`
- Are versioned using semver in `metadata.version`

---

## Versioning

Official skills follow semantic versioning:

- **Patch** (`1.0.x`) — wording fixes, clarifications, minor instruction improvements
- **Minor** (`1.x.0`) — new steps, new reference files, expanded coverage
- **Major** (`x.0.0`) — breaking changes to skill behavior, renamed trigger phrases, structural rewrites

The version is set in the `metadata.version` field of `SKILL.md`. Skills are encouraged to track changelog entries in a `CHANGELOG.md` in their own directory; this is not yet enforced for existing skills.

---

## Suggesting changes

To propose a change to an official skill:

1. Open a GitHub issue describing the problem or improvement.
2. A member of `@qlik-oss/agentic-skills-official-maintainers` will triage and, if approved, either implement it or invite you to submit a PR.
3. PRs against `/official/` from non-team members will be closed and converted to issues.

For net-new workflows that don't fit an existing skill, consider contributing to [`/community/skills/`](../../community/skills/) first. Community skills can be promoted to official if they see significant adoption and meet quality standards — see [Getting promoted to official](../../community/skills/README.md#getting-promoted-to-official) for the criteria.

---

## Security

Because official skills go through mandatory maintainer review and a security scan before merging, they carry a lower risk profile than community skills. If you discover a security vulnerability in an official skill, do not open a public issue. Email `security@qlik.com` with the subject line `[Agent Skills] Vulnerability Report` — see the [Security section of CONTRIBUTING.md](../../CONTRIBUTING.md#security) for full details.
