# Qlik Agentic Skills

This is Qlik's public, open-source hub for AI agent skills - reusable skills and Claude plugins that extend AI agents with Qlik-specific expertise. Contributions from anyone are welcome; see [Contribute a skill](#contribute-a-skill) below.

The skill content in this repository follows the open [Agent Skills standard](https://agentskills.io). It is intended to be portable across compatible runtimes, but runtime compatibility depends on the host tool's implementation and should be verified in each consuming agent.

---

## What are agent skills?

Agent skills are folders of instructions, scripts, and reference material that an AI agent loads on demand. Instead of repeating context in every conversation, you package your expertise once and let the agent discover and apply it automatically.

Think of a skill as an onboarding guide for a new hire - it tells the agent what to do, when to do it, and how to do it correctly for your specific environment. The [SKILL.md format](https://agentskills.io/specification) is an open standard, but each agent runtime still decides how it discovers, loads, and executes those skills.

---

## What's in this repository

```
agentic-skills/
├── official/                        # Qlik-owned and maintained skills
│   ├── skills/
│   │   └── README.md
│   └── .claude-plugin/plugin.json
├── community/                       # Customer and partner contributions
│   ├── skills/
│   │   └── README.md
│   └── .claude-plugin/plugin.json
├── spec/
│   └── README.md
├── template/skill                   # Starter template for new skills
│   ├── README.md
│   └── SKILL.md
├── scripts/                          # CI validation scripts (SKILL.md spec + plugin manifest checks)
├── .github/workflows/                # CI: runs the scripts above on relevant file changes
├── .claude-plugin/
│   └── marketplace.json
├── package.json / pnpm-lock.yaml     # Node tooling for the validation scripts
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE
├── NOTICE
└── README.md
```

### Official folder

Skills owned and maintained by Qlik staff, reviewed by the official maintainers team before merging. These are the generic way to work with Qlik Cloud through an AI agent.

### Community folder

Skills and Claude plugins contributed by Qlik customers, partners, and the developer community. Community skills are reviewed for fit and quality, and the repository includes validation checks for SKILL.md structure and Claude plugin manifests. Security validation and runtime verification remain host-specific and should be completed in the consuming environment if required.

### Plugins

This repository includes Claude plugin manifests and marketplace metadata for packaging the skills in each tier (`official/`, `community/`) into a Claude Code installable unit. The plugin format can bundle agents, hooks, slash commands, and MCP server configuration alongside skills, but the underlying skill content is still defined by the Agent Skills files themselves and should be verified in the consuming host runtime.

---

## Install skills

This repository is a source package for Agent Skills content. Hosts that support the standard can install the skills by copying or linking the skill folders into the relevant discovery path, or by using a host-specific install flow such as the `npx skills` CLI or a Claude plugin marketplace command.

```bash
# Example installation patterns for compatible hosts
npx skills add qlik-oss/agentic-skills
npx skills add qlik-oss/agentic-skills --skill <skill-name>
```

The exact install path depends on the consuming agent or plugin system. Confirm the host-specific installation steps for the runtime you plan to use.

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

This repository includes Claude marketplace metadata for plugin-style installation. The expected installation flow is host-specific to Claude Code and should be validated in that tool's environment:

```
/plugin install qlik-cloud-skills@qlik-cloud-skills
/plugin install qlik-cloud-community-skills@qlik-cloud-skills
```

---

## Available skills

See [`official/skills/`](./official/skills/) for the current list of official skills, and [`community/skills/`](./community/skills/) for community contributions.

---

## Compatibility

This repository follows the open [Agent Skills specification](https://agentskills.io). The repo is designed for tools that support that standard, but compatibility should be checked per host runtime and per agent installation.

| Tool / runtime | Status |
|---|---|
| Claude Code (Anthropic) | Targeted and validated at the skill-spec manifest layer |
| OpenAI Codex | Intended to be compatible with Agent Skills-compatible runtimes |
| GitHub Copilot / VS Code | Intended to be compatible with Agent Skills-compatible runtimes |
| Cursor | Intended to be compatible with Agent Skills-compatible runtimes |
| Gemini CLI | Intended to be compatible with Agent Skills-compatible runtimes |
| JetBrains Junie | Intended to be compatible with Agent Skills-compatible runtimes |
| Goose (Block) | Intended to be compatible with Agent Skills-compatible runtimes |
| OpenCode | Intended to be compatible with Agent Skills-compatible runtimes |
| Amp | Intended to be compatible with Agent Skills-compatible runtimes |

---

## Security and trust model

Skills execute instructions and may call tools, read files, or invoke scripts in the host environment. Treat every contribution as a security-sensitive change.

Before accepting or merging a change, confirm that it does not:

- hardcode secrets, tokens, API keys, or personal credentials
- request broad tool access when a narrower `allowed-tools` policy would suffice
- introduce outbound network calls or remote fetches without explicit need and review
- instruct the agent to ignore its safety constraints or hidden system boundaries
- embed sensitive user data, tenant identifiers, or internal host details in examples or docs

Use the least privilege principle. If a skill needs shell access, file access, or external calls, document why and keep the scope narrow.

When a change affects runtime behavior, verify it in the consuming host environment. The repository validates structure and metadata locally, but it does not automatically prove that a specific agent runtime or plugin installation path works for every user.

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
  skills-ref validate community/skills/your-skill-name/
```

---

## Related resources

- [Agent Skills open standard](https://agentskills.io) — specification and reference
- [Anthropic official skills](https://github.com/anthropics/skills) — document, coding, and productivity skills
- [skills.sh](https://skills.sh) — community directory and install leaderboard
- [Qlik Developer Portal](https://qlik.dev) — Qlik APIs and platform documentation

---

## License

All skills in this repository are licensed under [Apache 2.0](./LICENSE) unless stated otherwise in the skill's SKILL.md frontmatter.

---

## Code of conduct

This project follows [Qlik's Code of Conduct](./CODE_OF_CONDUCT.md). Please read it before contributing.
