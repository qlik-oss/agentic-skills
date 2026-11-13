# Qlik Agent Skills

Agent skills for working with Qlik, packaged as plugins by area. Install a plugin, then describe your task; the agent selects the relevant skill.

| Plugin | Use it to |
|---|---|
| [Qlik Analytics](analytics/README.md) (`qlik-analytics`) | Explore Qlik data, write expressions and load scripts, build charts and prepare apps for AI |
| [Qlik Automate](automate/README.md) (`qlik-automate`) | Build and maintain Qlik Automate workflows |
| [Qlik Embedded Analytics](embedded-analytics/README.md) (`qlik-embedded-analytics`) | Embed Qlik analytics and migrate extensions to nebula.js |

[Qlik Answers skills](answers/README.md) are a separate collection that you upload inside Qlik Answers.

## Install

In Claude Code:

```text
/plugin marketplace add qlik-oss/agentic-skills
/plugin install qlik-analytics@qlik-cloud-skills
```

See the [installation guide](INSTALLATION.md) for Codex, Kiro and individual skills. Installing a plugin does not connect your Qlik tenant; workflows that need live access require a Qlik MCP connection.

The legacy `qlik-cloud-skills` and `qlik-cloud-community-skills` plugins are available until 30 November 2026. See [legacy plugins](INSTALLATION.md#legacy-plugins) to switch.

## Repository layout

```text
<area>/
  README.md                   # What the plugin does, examples, prerequisites
  plugin.json                 # Agent Plugins manifest
  .claude-plugin/plugin.json  # Claude manifest
  LICENSE
  NOTICE
  skills/<skill-name>/        # Skill content and supporting files
answers/skills/               # Qlik Answers skills
.claude-plugin/marketplace.json   # Claude marketplace
.agents/plugins/marketplace.json  # Codex marketplace
spec/                         # Skill frontmatter format
template/skill/               # Starter for new skills
scripts/                      # Repository validation
```

Skills follow the [Agent Skills specification](https://agentskills.io/specification). Area packages follow [Agent Plugins 1.0.0](https://agent-plugins.org/) and include [Claude manifests](https://code.claude.com/docs/en/plugins-reference).

## Contributing

Anyone can contribute to any area. See [CONTRIBUTING.md](CONTRIBUTING.md). Each skill keeps its author and licence, and [CODEOWNERS](.github/CODEOWNERS) assigns reviewers. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

Support coverage is determined by applicable Qlik terms and any notice in a skill, not by inclusion in this repository. Use GitHub issues for bugs and suggestions.

## Security

Review a skill before use. Skills may call tools, read or write files, run scripts or fetch documentation, and each skill describes what it needs. Grant only the permissions the task requires.

Report security issues privately to `security@qlik.com` with the subject `[Agent Skills] Vulnerability Report`.
