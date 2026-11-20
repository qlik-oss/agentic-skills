# Qlik Embedded Analytics

Embed Qlik analytics in applications and migrate visualization extensions to nebula.js.

## Try it

- “Embed this Qlik chart in my React application.”
- “Help configure authentication for this qlik-embed integration.”
- “Assess this extension and migrate its supported behaviour to nebula.js.”

## Before you start

Provide the application or extension source, target framework and deployment environment. Live resource discovery requires authorised access to the relevant Qlik tenant. Authentication, embedding permissions and chart support depend on the target environment. The package includes guidance and migration helpers, not tenant access or a running integration.

Generated or migrated code still needs testing in its target application and Qlik environment.

## Install and skills

Install **Qlik Embedded Analytics** (`qlik-embedded-analytics`) from `embedded-analytics/`. In Claude Code:

```text
/plugin marketplace add qlik-oss/agentic-skills
/plugin install qlik-embedded-analytics@qlik-cloud-skills
```

For other clients, see the [installation guide](../INSTALLATION.md).

| Skill | When it helps |
|---|---|
| [qlik-embed](skills/qlik-embed/SKILL.md) | Embedding, authentication, framework integration and resource discovery |
| [qlik-extension-nebula-migration](skills/qlik-extension-nebula-migration/SKILL.md) | Assessing and migrating extensions, with local inspection and compatibility helpers |

## Support

Review is routed through [CODEOWNERS](../.github/CODEOWNERS); see [CONTRIBUTING.md](../CONTRIBUTING.md) to contribute and the [root README](../README.md#contributing) for support coverage.
