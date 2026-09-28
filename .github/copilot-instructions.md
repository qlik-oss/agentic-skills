# Copilot instructions

This repository follows the policy in [AGENTS.md](../AGENTS.md). Treat that file as the source of truth for repo conventions.

## Required before finishing work

Run the repo-local validation checks before completion:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run validate:spec
corepack pnpm run validate:claude
```

## Rules to follow

- Do not claim blanket compatibility unless it is verified in the target host runtime.
- Prefer wording like “Agent Skills-compatible runtime” instead of “works everywhere.”
- Do not require personal Claude or other vendor account access for routine validation.
- Keep required repo-local validation separate from optional host-specific runtime verification.
- Treat new scripts, tool access, outbound network calls, and file writes as security-sensitive changes.
- Prefer least-privilege tool declarations and sanitized example data.
- Describe the why and scope of the change in PRs and docs updates.
- Keep repo guidance and validation expectations aligned with the actual workflow files.

## Scope guardrails

- Keep CI checks scoped to the relevant repo paths already defined by the workflow files.
- Do not broaden validation scope unless the repo policy explicitly changes.
- Prefer minimal, evidence-based edits.
