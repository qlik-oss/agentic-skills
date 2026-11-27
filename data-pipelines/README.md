# Qlik Data Pipelines

Build and manage Qlik Talend Cloud Platform (QTCP) data pipeline and replication projects: project scaffolding, source selection, transformations, scheduling and binding management.

## Try it

- “Create a new replication project from this source connection.”
- “Add a daily schedule to this task.”
- “Validate this project and tell me what breaks the project rules.”

## Before you start

Discovering tenant resources and resolving bindings use a separately configured Qlik MCP connection. Editing project files in your workspace does not. State which project you mean and whether you want a review or changes. The plugin does not include an MCP server or grant tenant access.

## Install

Install **Qlik Data Pipelines** (`qlik-data-pipelines-skills`) from `data-pipelines/`. In Claude Code:

```text
/plugin marketplace add qlik-oss/agentic-skills
/plugin install qlik-data-pipelines-skills@qlik-cloud-skills
```

For other clients, see the [installation guide](../INSTALLATION.md).

## Included skills

| Skill | Contribution | When it helps |
|---|---|---|
| [qlik-data-pipelines-project-rules](skills/qlik-data-pipelines-project-rules/SKILL.md) | Qlik | Cross-cutting rules for any QTCP project: response style, file conventions and the AI edit marker |
| [qlik-data-pipelines-project-management](skills/qlik-data-pipelines-project-management/SKILL.md) | Qlik | Creating a project or adding a task to one |
| [qlik-data-pipelines-project-validation](skills/qlik-data-pipelines-project-validation/SKILL.md) | Qlik | Checking a project against the mandatory rules |
| [qlik-data-pipelines-data-pipeline](skills/qlik-data-pipelines-data-pipeline/SKILL.md) | Qlik | Data pipeline projects and their task types, including Qlik Open Lakehouse |
| [qlik-data-pipelines-replication](skills/qlik-data-pipelines-replication/SKILL.md) | Qlik | Replication projects, `REPLICATION` and `LAKE_LANDING` tasks |
| [qlik-data-pipelines-source-selection](skills/qlik-data-pipelines-source-selection/SKILL.md) | Qlik | Choosing sources, tables, views or datasets for a task |
| [qlik-data-pipelines-transformations](skills/qlik-data-pipelines-transformations/SKILL.md) | Qlik | Table-level and dataset-level transformation rules |
| [qlik-data-pipelines-scheduling](skills/qlik-data-pipelines-scheduling/SKILL.md) | Qlik | Time-based and event-based schedules |
| [qlik-data-pipelines-binding-synchronization](skills/qlik-data-pipelines-binding-synchronization/SKILL.md) | Qlik | Keeping the bindings definition in sync with `{{...}}` variables |
| [qlik-data-pipelines-binding-resolution](skills/qlik-data-pipelines-binding-resolution/SKILL.md) | Qlik | Reporting the resolved value of a binding variable |
| [qlik-data-pipelines-resource-discovery](skills/qlik-data-pipelines-resource-discovery/SKILL.md) | Qlik | Listing connections, spaces, projects and datasets in a tenant |

## Support

Review is routed through [CODEOWNERS](../.github/CODEOWNERS); see [CONTRIBUTING.md](../CONTRIBUTING.md) to contribute and the [root README](../README.md#contributing) for support coverage.
