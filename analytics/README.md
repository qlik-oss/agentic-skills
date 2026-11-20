# Qlik Analytics

Explore Qlik data, write expressions and load scripts, build charts, and improve apps for AI.

## Try it

- “Explain this app's sales trend and show which selections affect the result.”
- “Write a load script that prepares this dataset for Qlik Predict.”
- “Review this app's field names and master items for AI readiness.”

## Before you start

Live app exploration or changes require an authorised Qlik connection and the tools needed by the workflow. Expression and script authoring can use context you provide. State which app you mean and whether you want analysis, proposed changes or implementation. The plugin does not include an MCP server or grant tenant access.

## Install

Install **Qlik Analytics** (`qlik-analytics`) from `analytics/`. In Claude Code:

```text
/plugin marketplace add qlik-oss/agentic-skills
/plugin install qlik-analytics@qlik-cloud-skills
```

For other clients, see the [installation guide](../INSTALLATION.md).

## Included skills

| Skill | When it helps |
|---|---|
| [qlik-data-analyst](skills/qlik-data-analyst/SKILL.md) | Expressions, charts and interpretation of analytical results |
| [qlik-talk-to-data](skills/qlik-talk-to-data/SKILL.md) | Questions about existing Qlik data and governed context |
| [qlik-sense-app-analysis](skills/qlik-sense-app-analysis/SKILL.md) | MCP-based app exploration, chart/sheet authoring and governance workflows |
| [qlik-load-script](skills/qlik-load-script/SKILL.md) | Qlik Sense load scripting, data preparation and ML feature preparation |
| [qlik-ai-readiness-optimizer](skills/qlik-ai-readiness-optimizer/SKILL.md) | Assessing and improving apps for Qlik Answers and MCP use |

## Support

Review is routed through [CODEOWNERS](../.github/CODEOWNERS); see [CONTRIBUTING.md](../CONTRIBUTING.md) to contribute and the [root README](../README.md#contributing) for support coverage.
