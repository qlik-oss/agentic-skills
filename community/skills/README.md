# Community Skills

Skills in this directory are contributed by Qlik customers, partners, and the broader developer community. They extend the platform beyond what official skills cover — custom workflows, industry-specific patterns, integration recipes, and team-specific conventions.

Community skills are **opt-in**. They are never silently enabled in a Qlik environment. Tenant administrators control which community skills are available to their users.

---

## Browse skills

| Skill | Author | Description |
|---|---|---|
| [qlik-load-script](qlik-load-script/) | [nabeel-oz](https://github.com/nabeel-oz) | Lightweight skill for coding agents (Claude Code, Cursor, etc.) to write, complete, and extend Qlik Sense load scripts (.qvs) — general authoring plus data prep for ML-ready datasets with Qlik Predict |

---

## Install a community skill

```bash
# Install a specific community skill
npx skills add qlik-oss/agentic-skills --skill your-skill-name

# Install to a specific agent
npx skills add qlik-oss/agentic-skills --skill your-skill-name -a claude-code
```

---

## Contribute a skill

Community contributions are welcome. Here's the short version — the full guide is in [CONTRIBUTING.md](../../CONTRIBUTING.md).

### 1. Check what already exists

Search this directory before creating a new skill. If a similar skill exists, consider extending it rather than creating a duplicate.

### 2. Bootstrap with `skill-creator`

The fastest way to get a well-structured skill is to let the agent scaffold it:

```bash
npx skills add anthropics/skills --skill skill-creator
# then in your agent: /skill-creator
```

### 3. Create your skill folder

```
community/skills/your-skill-name/
├── SKILL.md            # Required
├── scripts/            # Optional
├── references/         # Optional
└── assets/             # Optional
```

Your `SKILL.md` must include at minimum:

```markdown
---
name: your-skill-name
description: >-
  What this skill does and when to use it. Include the exact phrases
  a user would type to trigger it.
license: Apache-2.0
metadata:
  author: your-github-username
  version: 1.0.0
  tags:
    - qlik
    - your-domain
---

# Your skill name

## When to activate
...

## Steps
...
```

### 4. Validate locally

```bash
uvx --from git+https://github.com/agentskills/agentskills#subdirectory=skills-ref \
  skills-ref validate community/skills/your-skill-name/
```

### 5. Open a pull request

Fork the repo, add your skill under `/community/skills/`, and open a PR using the provided template. The automated CI pipeline runs spec validation and security scanning. A maintainer will review within 5 business days.

---

## Quality bar

Community skills do not need to meet the same bar as official skills, but they must:

- Pass `skills-ref validate` with no errors
- Have a `description` specific enough to trigger accurately — not on every prompt
- Contain no hardcoded API keys, tokens, or credentials
- Not make outbound network calls to URLs outside Qlik's domains from scripts
- Include at least one realistic usage example

Skills that fail the automated checks or violate the security rules will not be merged.

---

## Getting promoted to official

A community skill can be nominated for promotion to [`/official/skills/`](../../official/skills/) if it meets the following criteria:

- Significant install count via `skills.sh`
- No open bug reports or security findings
- Covers a workflow relevant to a broad set of Qlik users
- Author is willing to transfer maintenance to `@qlik-oss/agentic-skills-official-maintainers`, or a team member agrees to adopt it

To nominate a skill, open a GitHub issue describing the skill and why it should be promoted.

---

## Security

Community skills are not verified by Qlik in the same way official skills are. Before installing a community skill in a production environment:

- Review the full `SKILL.md` and any scripts in the skill directory
- Check the skill's install history and open issues
- Prefer skills from authors with an established GitHub presence

If you discover a security vulnerability in a community skill, do not open a public issue. Email `security@qlik.com` with the subject line `[Agent Skills] Vulnerability Report`.

See the [Security section of CONTRIBUTING.md](../../CONTRIBUTING.md#security) for full details.
