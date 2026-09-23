<!--
## Summary
Briefly describe the change and why it is needed.
- What changed?
- Why is this change required?
- Who or what is affected?
-->

## Summary

<!-- Replace this with a short description of the change and its rationale. -->

## Why this change

<!-- Explain the problem being solved, the user need, or the gap in the current repo. Include any relevant context or constraints. -->

## Scope and impact

<!-- Describe what files, skills, or plugin entries are affected. If this touches docs, reference the README(s) and spec docs that were reviewed or updated. -->

## Documentation and reference updates

<!-- If applicable, list any README, spec, or reference docs that were checked or updated. -->
- README(s):
- Spec/reference docs:
- Skill docs impacted:

## Validation

### Required repo-local checks

Run these before asking for review:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run validate:spec
corepack pnpm run validate:claude
```

### Recommended local checks for affected host/runtime

These are not required by the repo-level CI and should be run only when the PR affects a specific agent runtime or plugin installation flow:

```bash
# Example: use the host runtime's native validation command
# claude plugin validate .
# skills-ref validate community/skills/your-skill-name/
```

## Notes for reviewers

<!-- Explain anything unusual, risky, or intentionally skipped. -->

- Reviewer focus:
- Known trade-offs:
- Host-specific verification not covered in CI:
