# Qlik Automate

Build and maintain Qlik Automate workflows, including workspace JSON, connector blocks and run-mode configuration.

## Try it

- “Draft an automation that lists users and writes the results to a spreadsheet.”
- “Update this workspace JSON to handle failed API requests.”
- “Configure this automation to run on a schedule.”

## Before you start

Describe the desired workflow, source/destination systems and run mode. Connected creation, updates and connector discovery require an authorised Qlik MCP connection with the relevant automation tools. External services may require connections configured in Qlik. The skill includes workspace and block schemas; missing connection values must be resolved before execution.

Generating workspace JSON is different from deploying or running an automation. Specify the action you want. This package does not bundle credentials or an MCP connection.

## Install and skills

Install **Qlik Automate** (`qlik-automate`) from `automation/`. In Claude Code:

```text
/plugin marketplace add qlik-oss/agentic-skills
/plugin install qlik-automate@qlik-cloud-skills
```

For other clients, see the [installation guide](../INSTALLATION.md).

- [qlik-automation-builder](skills/qlik-automation-builder/SKILL.md): automation construction, connector configuration and authorised management through available tools.

## Support

Review is routed through [CODEOWNERS](../.github/CODEOWNERS); see [CONTRIBUTING.md](../CONTRIBUTING.md) to contribute and the [root README](../README.md#contributing) for support coverage.
