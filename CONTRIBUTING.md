# Contributing to Qlik Agent Skills

Thank you for contributing to the Qlik Agent Skills repository. This repo is the central source of truth for skills and Claude plugins that extend Qlik's AI agents, and through the open [Agent Skills standard](https://agentskills.io), they work across Claude Code, OpenAI Codex, GitHub Copilot, Cursor, Gemini CLI, and 20+ other tools.

---

## Table of contents

- [Contributing to Qlik Agent Skills](#contributing-to-qlik-agent-skills)
  - [Table of contents](#table-of-contents)
  - [What lives here](#what-lives-here)
  - [Trust tiers](#trust-tiers)
    - [`official/`](#official)
    - [`community/`](#community)
  - [Before you start](#before-you-start)
  - [Repository structure](#repository-structure)
  - [Writing a skill](#writing-a-skill)
    - [The SKILL.md format](#the-skillmd-format)
    - [The description field is critical](#the-description-field-is-critical)
    - [Spec constraints](#spec-constraints)
    - [Progressive disclosure](#progressive-disclosure)
    - [Scripts](#scripts)
    - [Validate before submitting](#validate-before-submitting)
  - [Submitting a skill](#submitting-a-skill)
    - [For community skills](#for-community-skills)
    - [For official skills](#for-official-skills)
    - [PR checklist](#pr-checklist)
  - [Review process](#review-process)
    - [Automated checks (all PRs)](#automated-checks-all-prs)
    - [Human review (community tier)](#human-review-community-tier)
    - [Human review (official tier)](#human-review-official-tier)
  - [Publishing to the ecosystem](#publishing-to-the-ecosystem)
  - [Security](#security)
  - [Code of conduct](#code-of-conduct)
  - [Questions?](#questions)

---

## What lives here

This repository contains four top-level areas:

| Type | Location | Purpose |
|---|---|---|
| **Official skills** | `official/skills/` | Qlik-owned SKILL.md packages maintained by Qlik engineering |
| **Community skills** | `community/skills/` | Community-contributed SKILL.md packages reviewed before merge |
| **Specification docs** | `spec/` | Repository guidance for the Agent Skills format used here |
| **Templates** | `template/skill/` | Starter files contributors can copy when creating a new skill |

Skills are the most commonly contributed artifact. If you're new here, start with a skill.

---

## Trust tiers

Skills in this repository are organized into two trust tiers that determine how they are distributed and what review they require. Shared docs and templates live alongside those tiers in `spec/` and `template/`.

### `official/`
Skills owned and maintained by Qlik engineering teams, the standard, versioned way to work with Qlik Cloud through an AI agent. Changes require a PR review from a `@qlik-oss/agentic-skills-official-maintainers` team member and pass all automated validation checks.

### `community/`
Skills contributed by Qlik customers, partners, or the broader developer community. These are opt-in at the tenant level and carry a **Community** badge in the UI. They must pass automated security scanning and a basic quality review before merging, but do not require Qlik engineering sign-off.

> **Note for enterprise users:** Tenant administrators control which community skills are available to their users. No community skill is silently enabled.

---

## Before you start

1. **Check for an existing skill.** Search `official/skills/` and `community/skills/` before creating a new one — you may be able to extend an existing skill rather than duplicate it.

2. **Open an issue first for large contributions.** If you're planning a skill that introduces new patterns, new schema fields, or a new category, open a GitHub issue to discuss the approach before writing code. This saves everyone time.

3. **Read the security rules.** Skills execute instructions and can run scripts inside a VM. Read the [Security](#security) section before contributing any skill that touches network calls, file I/O, or external APIs.

4. **Use the `skill-creator` skill to bootstrap.** The fastest way to create a well-structured skill is to let the agent do it:
   ```bash
   # In Claude Code
   /skill-creator
   ```
   Or install it first if you haven't:
   ```bash
   npx skills add anthropics/skills --skill skill-creator
   ```

---

## Repository structure

```
agentic-skills/
├── official/
│   ├── skills/                      # Qlik-owned skills
│   │   └── README.md
│   └── .claude-plugin/plugin.json
├── community/
│   ├── skills/                      # Community-contributed skills
│   │   └── README.md
│   └── .claude-plugin/plugin.json
├── spec/                            # Repository spec and format guidance
│   └── README.md
├── template/
│   └── skill/                       # Starter template for new skills
│       ├── README.md
│       └── SKILL.md
├── scripts/                         # CI validation scripts (SKILL.md spec + plugin manifest checks)
├── .github/workflows/               # CI: runs the scripts above on relevant file changes
├── .claude-plugin/
│   └── marketplace.json
├── package.json / pnpm-lock.yaml    # Node tooling for the validation scripts
└── CONTRIBUTING.md
```

---

## Writing a skill

### The SKILL.md format

Every skill is a folder containing a `SKILL.md` file. This is the open [Agent Skills standard](https://agentskills.io), the same format used by Anthropic, OpenAI, Google, and 20+ other tools.

```markdown
---
name: qlik-app-analysis
description: >-
  Analyzes a Qlik Sense application to identify performance bottlenecks,
  unused fields, and optimization opportunities. Use when asked to review,
  audit, or optimize a Qlik app or data model.
license: Apache-2.0
metadata:
  author: your-name
  version: 1.0.0
  tags:
    - qlik
    - analytics
    - performance
allowed-tools: read bash
---

# Qlik app analysis

## When to activate
Activate this skill when the user asks to:
- Review or audit a Qlik app
- Identify performance issues in a data model
- Optimize load script or set analysis expressions

## Steps

### Step 1: Gather context
...

### Step 2: Analyze
...

## Output format
...
```

### The description field is critical

The `description` is what the agent reads to decide whether to activate your skill. Write it like a search query — include the actual phrases users are likely to type. A vague description like "helps with Qlik" will either never trigger or trigger on irrelevant prompts.

**Good:**
```
Use when asked to optimize a Qlik app load script, reduce data model complexity,
fix set analysis expressions, or improve app performance.
```

**Bad:**
```
Helps with Qlik development tasks.
```

### Spec constraints

| Field | Constraint |
|---|---|
| `name` | 1–64 chars, lowercase alphanumeric and hyphens only (`^[a-z0-9]+(-[a-z0-9]+)*$`) |
| `description` | 1–1024 chars. Target ~100 tokens for discovery efficiency |
| `SKILL.md` | Max 500 lines / ~5,000 tokens for the activation context |
| Subdirectories | Only `scripts/`, `references/`, `assets/` are recognized |

### Progressive disclosure

Keep `SKILL.md` focused on activation logic and high-level steps. Move detailed reference material into `references/` subdirectory files and link to them from `SKILL.md`. The agent loads reference files only when needed — this keeps context usage efficient for everyone.

```
├── SKILL.md                    # Core instructions (~200 lines max)
└── references/
    ├── set-analysis-patterns.md
    ├── load-script-best-practices.md
    └── data-model-checklist.md
```

### Scripts

If your skill needs to execute code, place scripts in `scripts/`. Scripts run but their source code never loads into the model's context — only their output does. This is efficient and avoids token waste.

```
├── SKILL.md
└── scripts/
    └── validate-app.sh
```

Reference them in `SKILL.md` by path:
```markdown
Run `scripts/validate-app.sh` to check the app structure before analysis.
```

### Validate before submitting

Use the official validator to catch spec violations before opening a PR:

```bash
# Install the validator
uv tool install git+https://github.com/agentskills/agentskills#subdirectory=skills-ref

# Validate your skill
skills-ref validate community/skills/your-skill-name/
```

Or with uvx (no install):
```bash
uvx --from git+https://github.com/agentskills/agentskills#subdirectory=skills-ref \
  skills-ref validate community/skills/your-skill-name/
```

---

## Submitting a skill

### For community skills

1. Fork the repository.
2. Create your skill under `community/skills/your-skill-name/`.
3. Validate it locally (see above).
4. Open a pull request describing the skill, what it does, and when it should activate - there's no PR template yet, so cover this in the description.
5. CI runs the spec check automatically (see [Automated checks](#automated-checks-all-prs)). Run `skills-ref validate` and the SkillCheck security scan locally — not wired into CI yet.
6. A maintainer will review within 5 business days.

### For official skills

Official skills require a Qlik engineering team member as the PR author or reviewer. If you have a skill idea that should be official, open an issue to discuss with `@qlik-oss/agentic-skills-official-maintainers` first.

### PR checklist

Before opening a PR, confirm:

- [ ] Skill lives in the correct tier (`official/skills/` or `community/skills/`)
- [ ] `name` in frontmatter matches the folder name exactly
- [ ] `description` includes concrete trigger phrases
- [ ] `SKILL.md` is under 500 lines
- [ ] `license` field is set (use `Apache-2.0` for community skills)
- [ ] `metadata.author` is set to your GitHub username
- [ ] `metadata.version` follows semver (`1.0.0`)
- [ ] `skills-ref validate` passes with no errors
- [ ] No hardcoded API keys, tokens, or credentials anywhere in the skill
- [ ] No network calls to external URLs from scripts (community tier)
- [ ] `README.md` or inline `SKILL.md` examples show at least one realistic use case

---

## Review process

### Automated checks (all PRs)

One CI check per destination, not one monolith:

- **Frontmatter check** — [`validate-skill-spec.yml`](.github/workflows/validate-skill-spec.yml) validates every `SKILL.md` against the fields [`spec/README.md`](./spec/README.md) documents (name/description/license/metadata, naming, folder match, uniqueness). Same format across every destination, so one check covers all of them.
- **Claude plugin check** — [`validate-claude-plugin.yml`](.github/workflows/validate-claude-plugin.yml) validates `.claude-plugin/marketplace.json` and each `plugin.json`. Claude-specific — it's the only destination with a plugin marketplace layer on top of `SKILL.md`, so it's a separate workflow, scoped to Claude-only files.

New destination has its own manifest format? Give it its own `validate-<destination>.mjs` + workflow, don't fold it into either of the above.

Two checks described elsewhere in this guide are **not yet wired into CI** —
run them locally before opening a PR:
- **`skills-ref validate`** — the fuller upstream `agentskills` spec validator
  (Python/uv, not our Node CI); see [Validate before submitting](#validate-before-submitting).
  Overlaps with the frontmatter check above but checks more of the spec.
- **Security scan** — SkillCheck, for prompt injection patterns, unexpected
  network calls, and credential exposure

### Human review (community tier)

A maintainer checks:
- Does the description trigger accurately?
- Are instructions clear enough for the agent to follow without ambiguity?
- Does the skill avoid duplicating an existing official skill?
- Are scripts minimal and purposeful?

### Human review (official tier)

In addition to the above, a `@qlik-oss/agentic-skills-official-maintainers` member checks:
- Alignment with Qlik product terminology and APIs
- Consistency with existing official skill patterns
- No overlap with the Supervisor agent's built-in capabilities

---

## Publishing to the ecosystem

Once merged, skills are automatically available via:

```bash
# Install any skill from this repo
npx skills add qlik-oss/agentic-skills

# Install a specific skill
npx skills add qlik-oss/agentic-skills --skill <skill-name>

# Install to a specific agent
npx skills add qlik-oss/agentic-skills --skill <skill-name> -a claude-code
```

The `npx skills` CLI (maintained by Vercel / [skills.sh](https://skills.sh)) routes skills to the correct directory for each agent automatically — Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, and others.

Official skills are also distributed through:
- The Claude marketplace via `.claude-plugin/marketplace.json` (Claude only)

---

## Security

Skills are executable instructions. A malicious or poorly written skill can cause data exfiltration, unexpected API calls, or unauthorized file access. Please take the following seriously.

**Never include in a skill:**
- Hardcoded API keys, tokens, passwords, or secrets
- Scripts that make outbound network calls to URLs outside Qlik's domains (community tier)
- Instructions that tell the agent to ignore its system prompt or safety constraints
- `eval`-style patterns that execute dynamically constructed code

**Be explicit about scope.** Use `allowed-tools` in your frontmatter to declare the minimum set of tools your skill requires. Do not request `bash` or `write` access unless your skill genuinely needs it.

**External dependencies.** If your script fetches from an external URL, that URL becomes a supply chain risk. Skills that fetch external content at runtime require explicit approval from `@qlik-oss/agentic-skills-official-maintainers` regardless of tier.

**Reporting a vulnerability.** If you discover a security issue in an existing skill, do not open a public GitHub issue. Email `security@qlik.com` with the subject line `[Agent Skills] Vulnerability Report`.

---

## Code of conduct

This project follows Qlik's standard [Code of Conduct](./CODE_OF_CONDUCT.md). Be respectful, be constructive, and assume good intent. Maintainers reserve the right to close PRs or issues that violate these standards.

---

## Questions?

- **GitHub Discussions:** use the Discussions tab for design questions
- **Issues:** use GitHub Issues for bugs and feature requests

We're actively building this ecosystem and welcome your input.
