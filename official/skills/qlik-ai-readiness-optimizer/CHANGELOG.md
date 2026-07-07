# Changelog

All notable changes to the `qlik-ai-readiness-optimizer` skill are documented here. Versioning follows the semver convention described in [official/skills/README.md](../README.md).

---

## 1.1.0 — Minor

**Verification:** Cross-checked every Qlik MCP tool name referenced in this skill. All previously-cited tools (`qlik_search`, `qlik_describe_app`, `qlik_get_fields`, `qlik_list_dimensions`, `qlik_list_measures`, `qlik_create_measure`, `qlik_create_dimension`) are confirmed available — no changes needed there.

**Fixed (stale capability claims):**
- `references/mcp-capability-matrix.md`: Editing existing Master Items was listed as "⚠️ In Preview (MCP Private Preview Tenant)." This is out of date — `qlik_update_measure` and `qlik_update_dimension` are generally available, not preview-gated. Added them to the matrix as ✅ Available, live immediately.
- `references/mcp-capability-matrix.md`: Added `qlik_delete_measure` and `qlik_delete_dimension` to the matrix as available tools (the skill still instructs against using them on existing items — see Key Rule #7 — but the matrix should reflect that the capability exists).
- `SKILL.md`: Updated the Phase 5 "what MCP can vs. cannot do" summary to reflect that editing and deleting existing Master Items is available via MCP (not preview), and to distinguish load script updates (still in preview) from variable definitions and synonym import (not available at all) — the summary previously lumped all three together as unavailable.
- `references/implementation-guide.md` (Layer 3): Removed the stale claim that "existing Master Items currently require UI editing (MCP edit feature in preview)." Existing Master Items can be regrouped directly via `qlik_update_measure`/`qlik_update_dimension`.
- `references/implementation-guide.md` (Layer 4): Added `qlik_update_measure`/`qlik_update_dimension` to the tool list so description improvements can be applied directly to existing Master Items instead of only via newly-created ones.

**Fixed (cross-skill ambiguity):** Key Rule #7 read as an unscoped "never delete" policy. Deletion of a genuine duplicate/erroneous Master Item is sometimes the correct action, but it needs its own usage-verification and confirmation workflow — a different concern from this skill's AI-readiness assessment. Reworded to make clear this skill itself never executes deletions and that a delete request should be treated as out of scope here rather than acted on via `qlik_delete_measure`/`qlik_delete_dimension`. Also trimmed the Phase 5 capability summary to a pointer at `references/mcp-capability-matrix.md` instead of restating it, to avoid the two drifting out of sync on a future edit.

**Fixed (internal consistency):**
- `SKILL.md` Phase 0 / `references/layer-analysis-guide.md` Layer 2: reconciled four different field-count thresholds (>200, >100, 30–60, ≤60) that gave contradictory signals for the same app into one ladder — ≤60 ideal, 61–200 noisy (flagged in Layer 2), >200 structural (flagged in Phase 0).
- `SKILL.md` Phase 1: "whether Qlik Answers is enabled" had no MCP tool backing it. Added explicit fallback — ask the user, or proceed with the assessment regardless.
- `SKILL.md` Phase 0 / Phase 6: added guidance for resuming a prior session (re-check existing Master Items before proposing new ones) and for partial IMPLEMENT failures (list succeeded vs. failed changes before continuing).
- `references/layer-analysis-guide.md` Layer 4: added an explicit callout that every newly-proposed Master Item (in the zero-Master-Items starter-set flow) must include a group, or it reproduces the Layer 3 failure mode on day one.
- "IST-Zustand" (used unexplained) now reads "IST-Zustand (Current-State) Assessment" on first use.

**Added (new checks, sourced from Qlik's official Qlik Answers documentation):**
- `references/layer-analysis-guide.md` Layer 4: added a hard-flag check for set identifiers (`{$<...>}`, `{1<...>}`, `{StateName<...>}`) in master measure expressions — Qlik's own documented limitation is that an inner set identifier silently overrides any filter Qlik Answers tries to apply, with no error. This is independent of the existing variable-density complexity gradient.
- `references/layer-analysis-guide.md` Layer 3: added a distinct "invalid logical model" indexing-failure diagnostic (custom Logical Model logic the indexer rejects), separate from the existing "Logic Disabled" toggle check, with its own fix path (Logical Model → Reset to default).
- `references/layer-analysis-guide.md` Layer 5: added a check for fiscal/period logic living in a Calendar Period object — not indexed by Qlik Answers, and removed entirely on tenants enabled for the agentic Qlik Answers experience.
- `references/layer-analysis-guide.md` Layer 1: added the boolean/flag naming convention (`Is Active`, `Has Churned`) to the "what good naming looks like" list.
- `references/layer-analysis-guide.md` Layer 6: added two synonym anti-patterns — one synonym mapped to multiple fields, and vague relative-ranking terms ("top"/"bottom").
- `SKILL.md`: added Key Rule #11 (only structured Master Items are indexed; glossary/label-expression/Hierarchy/Behavior/Calendar-Period/Custom-analysis content is not, and is removed on agentic-enabled tenants) and Key Rule #12 (differing answers between users is commonly a section-access difference, not a data-model defect).
- `SKILL.md` Phase 6: added a note that Logical Model changes can take up to 24 hours to reindex in Qlik Answers, separate from the app-engine "live immediately" behavior already documented.
- `SKILL.md`: clarified that Knowledge Base is a property of a multi-app Assistant, not a single-app Qlik Answers session.

**Not added:** an entity-context-prefix renaming convention for ID/key fields was considered (raised by an initial research pass) but does not match Qlik's own guidance, which recommends hiding primary/foreign keys outright — matching what this skill's Layer 2 already does. Discarded rather than adding an unverified convention.
