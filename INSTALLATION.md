# Install a Qlik plugin

Each area of this repository is a plugin package:

| Plugin | Package directory | Covers |
|---|---|---|
| `qlik-analytics` | `analytics/` | Exploring Qlik data, expressions, load scripts, charts and AI readiness |
| `qlik-automate` | `automate/` | Qlik Automate workflows and connector configuration |
| `qlik-embedded-analytics` | `embedded-analytics/` | Embedding Qlik analytics and migrating extensions to nebula.js |

Each area README lists its skills and prerequisites. The plugins contain skills only. Workflows that need live tenant access require a separately configured Qlik MCP connection.

## Claude Code

```text
/plugin marketplace add qlik-oss/agentic-skills
/plugin install qlik-analytics@qlik-cloud-skills
```

Replace `qlik-analytics` with the plugin you want. To load a package from a local clone without installing it, run `claude --plugin-dir /path/to/agentic-skills/analytics`. See the [Claude plugin documentation](https://code.claude.com/docs/en/plugins).

## Codex

Clone the repository, then add its catalogue (`qlik-task-skills`) and install a plugin:

```bash
codex plugin marketplace add /path/to/agentic-skills
codex plugin add qlik-analytics@qlik-task-skills
```

In the desktop app, choose **Qlik task-focused plugins** in the Plugins Directory and install the area you want. See [OpenAI's plugin documentation](https://developers.openai.com/plugins/build/plugins).

## Kiro

In the powers panel, choose **Add Custom Power** > **Import power from a folder**, then select an area folder, such as `analytics/`. See the [Kiro installation documentation](https://kiro.dev/docs/powers/installation/).

## Individual skills

Copy a complete skill directory, such as `analytics/skills/qlik-data-analyst/`, into your host's skill directory. Include its `references/`, `scripts/` and `assets/` folders.

Qlik Answers skills are uploaded inside Qlik Answers; see [answers/README.md](answers/README.md).

## Legacy plugins

The `qlik-cloud-skills` and `qlik-cloud-community-skills` Claude plugins are available until **30 November 2026**. After that date they will be removed from the marketplace.

To switch, install the area plugins that contain the skills you use, then uninstall the legacy plugin:

```text
/plugin install qlik-analytics@qlik-cloud-skills
/plugin uninstall qlik-cloud-community-skills@qlik-cloud-skills
```

Skill names are unchanged. The skills from `official/skills/` and `community/skills/` now live here:

| Skills | Plugin |
|---|---|
| `qlik-data-analyst`, `qlik-ai-readiness-optimizer`, `qlik-load-script`, `qlik-sense-app-analysis`, `qlik-talk-to-data` | `qlik-analytics` (`analytics/skills/`) |
| `qlik-automation-builder` | `qlik-automate` (`automate/skills/`) |
| `qlik-embed`, `qlik-extension-nebula-migration` | `qlik-embedded-analytics` (`embedded-analytics/skills/`) |
