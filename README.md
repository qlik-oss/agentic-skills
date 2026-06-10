# Qlik Agentic Skills

Reusable skills, plugins, and schemas that extend AI agents with Qlik-specific expertise — works across Claude Code, OpenAI Codex, GitHub Copilot, Cursor, Gemini CLI, and 20+ other tools that support the open [Agent Skills standard](https://agentskills.io).

---

## What are agent skills?

Agent skills are folders of instructions, scripts, and reference material that an AI agent loads on demand. Instead of repeating context in every conversation, you package your expertise once and let the agent discover and apply it automatically.

Think of a skill as an onboarding guide for a new hire — it tells the agent what to do, when to do it, and how to do it correctly for your specific environment. The [SKILL.md format](https://agentskills.io/specification) is an open standard, so a skill you write here works the same way in every compatible tool.

---

## What's in this repository

```
agentic-skills/
├── official/                        # Qlik-owned and maintained skills
│   ├── qlik-ai-readiness-optimizer/ # Analyze and optimize apps for Qlik Answers + MCP
│   │   ├── SKILL.md
│   │   └── references/
│   └── README.md
├── community/                       # Customer and partner contributions
│   └── README.md
├── spec/
│   └── README.md
├── template/
│   ├── README.md
│   └── SKILL.md
├── .claude-plugin/
│   └── marketplace.json
├── .github/
│   └── CODEOWNERS
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE
├── NOTICE
└── README.md
```

### Official folder

Skills, Claude plugins and schemas owned by Qlik engineering. Enabled by default in Qlik's agent environments. Covers core workflows across the Qlik platform — app analysis, data pipeline development, load script optimization, set analysis, and more.

### Community folder

Skills, Claude plugins and schemas contributed by Qlik customers, partners, and the developer community. Opt-in at the tenant level. Every community skill passes automated security scanning and a quality review before being merged.

### Plugins

Claude Code plugins that bundle multiple skills together with agents, hooks, slash commands, and MCP server configuration into a single installable unit. Richer experience for Claude Code users; the underlying skills remain cross-platform.

### Schemas

Shared JSON and YAML schema definitions for skill manifests, plugin configs, and Qlik API structures — used by both the CI validation pipeline and the `skills-ref` validator.

---

## Install skills

Skills are installed using the [`npx skills` CLI](https://skills.sh) — no setup required.

```bash
# Browse and install everything from this repo
npx skills add qlik/agent-skills

# Install a specific skill
npx skills add qlik/agent-skills --skill qlik-ai-readiness-optimizer

# Install to a specific agent
npx skills add qlik/agent-skills --skill qlik-ai-readiness-optimizer -a claude-code

# Install to all detected agents at once
npx skills add qlik/agent-skills --agent '*' --skill qlik-ai-readiness-optimizer
```

The CLI automatically detects which AI tools you have installed and places skill files in the correct directory for each one.

### Manual installation

If you prefer to install manually, clone or copy the skill folder into your agent's skills directory:

| Agent | Project scope | Global scope |
|---|---|---|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| OpenAI Codex | `.agents/skills/` | `~/.codex/skills/` |
| Cursor | `.claude/skills/` | `~/.claude/skills/` |
| Gemini CLI | `.claude/skills/` | `~/.claude/skills/` |
| VS Code / Copilot | `.github/skills/` | — |
| JetBrains Junie | `.junie/skills/` | `~/.junie/skills/` |

### Claude Code plugin marketplace

Claude Code users can also install via the plugin system, which bundles skills with agents, MCP configuration, and slash commands:

```
/plugin install qlik-dev-toolkit@qlik-agent-skills
```

---

## Available skills

| Skill | Tier | Description |
|---|---|---|
| `qlik-ai-readiness-optimizer` | official | Analyze and optimize a Qlik app for AI readiness (Qlik Answers and Qlik MCP) using the 6-Layer Model |
| *(more coming)* | | |

Community skills are listed under [`skills/community/`](./skills/community/).

---

## Compatibility

This repository follows the open [Agent Skills specification](https://agentskills.io). Skills work across all compatible tools — no per-tool configuration needed.

| Tool | Supported |
|---|---|
| Claude Code (Anthropic) | ✓ |
| OpenAI Codex | ✓ |
| GitHub Copilot / VS Code | ✓ |
| Cursor | ✓ |
| Gemini CLI | ✓ |
| JetBrains Junie | ✓ |
| Windsurf | ✓ |
| Goose (Block) | ✓ |
| OpenCode | ✓ |
| Amp | ✓ |

---

## Contribute a skill

Community contributions are welcome. The fastest path is to use the `skill-creator` skill to scaffold your SKILL.md, then open a pull request.

```bash
# Bootstrap a new skill with the agent
npx skills add anthropics/skills --skill skill-creator
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide — including the trust tier model, spec constraints, the PR checklist, and the security rules that apply to all contributions.

---

## Validate a skill locally

Before opening a PR, run the official spec validator:

```bash
uvx --from git+https://github.com/agentskills/agentskills#subdirectory=skills-ref \
  skills-ref validate skills/community/your-skill-name/
```

---

## Related resources

- [Agent Skills open standard](https://agentskills.io) — specification and reference
- [Anthropic official skills](https://github.com/anthropics/skills) — document, coding, and productivity skills
- [skills.sh](https://skills.sh) — community directory and install leaderboard
- [Qlik Developer Portal](https://developer.qlik.com) — Qlik APIs and platform documentation
- [Qlik Agent SDK](https://developer.qlik.com/agentic) — build agents on top of Qlik's AI platform

---

## License

All skills in this repository are licensed under [Apache 2.0](./LICENSE) unless stated otherwise in the skill's SKILL.md frontmatter.

---

## Code of conduct

This project follows [Qlik's Code of Conduct](./CODE_OF_CONDUCT.md). Please read it before contributing.
