# Changelog

All notable changes to the `qlik-ai-readiness-optimizer` skill are documented here. Versioning follows the semver convention described in [official/skills/README.md](../README.md).

---

## 2.0.0 — Major

### Model change (breaking)

Collapsed the 6-Layer Model to a 5-Layer Model by removing "Field Groups (Logical Model)" as its own scored layer. Reason: no Qlik MCP tool reads or sets a Master Item's group assignment — not `qlik_list_measures`, not `qlik_list_dimensions`, not the create/update tools, at creation time or afterward. A layer scored entirely from data MCP cannot retrieve is not a real signal; in practice it always scored 0%, which misrepresented apps that were correctly grouped via the UI. Group assignment is now sub-dimension **D** inside Layer 3 (Master Items + Descriptions) and is explicitly unscored — always flagged for manual user confirmation in the Logical Model UI, never inferred.

**Scoring weights changed** to reflect the new 5-layer structure (previously 15/15/27/27/9/7 across 6 layers):

| Layer | New Weight |
|-------|-----------|
| 1 — Field Naming | 20% |
| 2 — Visibility | 20% |
| 3 — Master Items (was Layer 4; absorbs old Layer 3's non-scoring group-assignment check) | 45% |
| 4 — Dates (was Layer 5) | 15% |
| 5 — Synonyms (was Layer 6) | **not scored** |

Within Layer 3, sub-weights are now Description-dominant, reflecting that descriptions are the AI's primary metric-selection signal (Key Rule #4). Group is no longer part of the score, and Expression complexity carries exactly 15% in both modes:

| Mode | Description | Expression | Glossary Alignment |
|------|-------------|------------|--------------------|
| Default (no glossary linkage) | 85% | 15% | — |
| Glossary sub-layer active | 75% | 15% | 10% |

⚠️ Layer 3 (and therefore overall) scores are **not comparable** to runs made under 1.1.0 or earlier. Example-table scores in `references/layer-analysis-guide.md` recomputed to match.

### Added — Glossary-aware Master Items support

Following Qlik's [glossary-aware Master Items documentation](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikAnswers/glossary-aware-master-items.htm). Qlik Answers uses metadata from Glossary Terms linked to Master Items, so the skill discovers that linkage and accounts for it — without changing default behavior for apps that don't use it.

**Workflow (`SKILL.md`, Phase 1):** Phase 1: CONNECT split into Step 1 (identify app, unchanged) and Step 2, "Glossary Discovery (REQUIRED question — always ask)." The *question* is mandatory; only the *sub-layers* are optional. An explicit ⛔ gate requires asking every session, waiting for the answer, and never satisfying the question by assuming "no" — the question wording asks for the glossary name(s) up front. If the user confirms linkage, each glossary name resolves to a `glossaryId` via `qlik_search` (`resourceType: "glossary"`), full contents are retrieved via `qlik_get_full_glossary_export`, and linked resources are matched against this app's Master Items (`qlik_list_measures`/`qlik_list_dimensions`) to build a Master-Item ↔ Glossary-Term mapping carried into Phase 2. If the user says no or doesn't know, the step is skipped entirely and both sub-layers are omitted from the report — never scored as 0%/N/A. Supporting guards: the Workflow Overview CONNECT line reads "+ ALWAYS ask about linked Glossary Terms" with a bolded "Never skip" callout alongside PRESENT → CONFIRM, and Phase 2 ANALYZE cannot be entered until the question has been asked and answered.

**Layer 3 sub-layer — Linked Glossary Term Alignment:** Compares a linked Glossary Term's name/description against the Master Item's own and classifies each pair 🟢 Aligned, 🟡 Minor Differences, or 🔴 Conflicting. Only 🔴 Conflicting affects the score (0.2); Aligned and Minor Differences both score 1.0 — the sub-layer can only pull Layer 3 down, never up, since Qlik Answers resolves these natively and this skill's job is to flag genuine conflicts for user review, not auto-resolve them.

**Layer 3 sub-layer — Link Opportunity Analysis (advisory, not scored):** After alignment classification, every Glossary Term in the Phase 1 export *not* linked to any of this app's Master Items is compared (name + description, judged on meaning) against all Master Dimensions and Measures to find link candidates. Presented as `Glossary Term | Term Status | Candidate Master Item | Type | Why it looks like a match` and fed into the Phase 3 Optimization Roadmap as its own item ("Link [N] Glossary Terms to Master Items" — MCP-automatable, interactive). Execution (implementation-guide Layer 3, step 7) is per candidate via `qlik_create_glossary_term_links`, with explicit per-item confirmation and a post-link reminder that the term must be 'Verified' before Answers uses it.

**Layer 5 sub-layer — Glossary Abbreviations as Synonyms (advisory, not scored):** Produces a fixed 3-column table `Master Item | Type | Abbreviations(Synonyms)` (Type = Measure/Dimension; multiple abbreviations comma-separated; `—` when the linked term has no abbreviation), and tells the user that Abbreviations on linked terms are used by Qlik Answers as synonyms automatically — so app-level Synonyms don't need to duplicate them.

**Layer 5 sub-layer — Missing Abbreviation Analysis (advisory, not scored):** Each `—` row becomes a finding with 1–3 proposed abbreviations/synonyms (same suggestion logic as the main synonym generation, plus asking the user for their internal vocabulary), presented as `Master Item | Linked Glossary Term | Proposed Abbreviations(Synonyms)` and added to the roadmap ("Add Abbreviations to [N] linked Glossary Terms"). Execution (implementation-guide Layer 5, step 7) is per approved term via `qlik_update_glossary_term` (`abbreviation` field), with **multiple synonyms comma-delimited** in the single value and a merge-don't-clobber guard when the term already has an abbreviation.

**Verified-status requirement:** Glossary Terms must be in the **'Verified'** status to be used by Qlik Answers — a linked term in any other status contributes nothing (no metadata context in Layer 3, no abbreviation-as-synonym in Layer 5). Both Glossary sub-layer sections require a Verified-status notice in their reports whenever active, telling the user: (a) only Verified terms are used by Answers, (b) this skill does not automatically query every term's status because each term requires an individual tool call, and (c) they can ask for specific term(s) to be checked on demand. If — and only if — the user explicitly asks, `qlik_get_glossary_term` is called per requested term (using the `glossaryId`/`termId` from the Phase 1 mapping) and the user is alerted to any term not in 'Verified' status. The skill never proactively sweeps all linked terms.

### Behavior changes

**Layer 2 — Field Visibility (ID/key fields):** Primary/foreign key fields (`CustomerID`, `OrderKey`, `ProductSK`, etc.) are not classified as outright 🔴 Hide. They always route to 🟠 Review, scored as a neutral 1.0 (not penalized), with an explicit prompt to confirm whether the field is used in a `Count(Distinct ...)` measure before hiding it. This supersedes 1.1.0's "Not added" note, which asserted that hiding keys outright matched Qlik's own guidance — that assertion was incorrect; the risk of silently hiding a field a live measure depends on outweighs the noise-reduction benefit.

- `references/layer-analysis-guide.md` (Layer 2): ⛔ ID/Key field rule callout added, primary/foreign keys moved out of the 🔴 Hide list into 🟠 Review, "do not penalize in score" special case added, example table updated (`CustomerID` now 🟠 Review).
- `references/implementation-guide.md` (Layer 2): load script `%`-prefix snippet no longer includes ID/key fields by default; added a required "Review" framing step for ID/key fields with exact wording, and an explicit instruction never to describe them as having "no business value" or being "ETL noise."

**Layer 3, C2 — set identifiers:** The blanket hard flag introduced in 1.1.0 (any inner set identifier → 🔴, 0.0) over-flagged intentional, well-communicated pre-filters. C2 is now a **conditional flag based on name/description transparency**: a master measure containing `{$<...}`, `{1<...}`, or `{StateName<...}` is only flagged 🔴 (score 0.0) when *neither* its name *nor* its description alludes to the logic the set analysis implements. Example pair in the guide: `Discounts (USD)` with `{<[Currency Name]={'USD'}>}` is fine — the name conveys the USD pre-filter; a measure named just `Discounts` with the same set logic and a generic description is flagged, because a user asking about another currency gets a silently wrong answer with no way to suspect it. Remediation guidance ordered accordingly: the primary fix is enriching the name/description to state the pre-filter (no expression change needed); removing/restructuring the set identifier is the alternative when the filter shouldn't be baked in at all.

### Removed — unverified diagnostics

The two Layer 3 "blocking check" callouts — "Logic Disabled" and the "invalid logical model" indexing-failure diagnostic (both added in 1.1.0) — removed at the author's direction as unverified guidance of unknown origin. Full purge, not just the Layer 3 paragraphs:

- `references/layer-analysis-guide.md` Layer 3: both ⚠️ callout paragraphs deleted.
- `SKILL.md`: the "Logic Disabled = all Master Items invisible" Key Rule deleted, with every cross-reference updated.
- `SKILL.md` Phase 6 VERIFY: the 24-hour reindex bullet no longer mentions "invalid logical model" fixes — it reads "If the change touched the Logical Model (e.g. grouping)...". The reindex note itself is retained.

### Changed — synonym import file specification

`references/implementation-guide.md` Layer 5, step 2 is now an explicit spec block: file type `.xlsx`; column header `Terms` (not `Term`); Locale documented as a full code list with language names (en/de/es/fr/it/ja/nl/pl/pt/ru/sv — two-letter code only goes in the cell); Condition Type / Condition Values documented as BLANK because the functionality is not yet supported by Answers; Additional Specs covering multiple terms `||`-delimited in one cell and a unique row per Field + Locale. The openpyxl/CSV fallback behavior is unchanged.

**The spec is authoritative.** In testing, the skill produced the synonym file in a structure it web-searched from Qlik's Vocabulary admin UI (`Term, Applies To, Condition, ...`) instead of the 6-column `.xlsx` spec, causing imports to fail. Root cause was a priority error (external research treated as more authoritative than the skill) compounded by a real ambiguity: two Layer 5 tables both looked like "the synonym format." Guards now in place:

- `references/implementation-guide.md` (Layer 5, step 2): a ⛔ authoritative-spec callout sits directly above the 6-column spec — do not web-search the format, do not substitute/add/rename/reorder/drop columns, flag conflicts to the user instead of silently swapping, and re-read the spec in the same turn the file is generated.
- `references/layer-analysis-guide.md` (Layer 5): the 3-column `Master Item | Suggested Synonyms | Notes` table is titled "On-screen suggestions table (analysis display only — NOT the file format)," with a callout clarifying it is the on-screen display, not the deliverable, and pointing to the authoritative 6-column spec. The same pointer appears under the "generate the synonym file" offer block.
- `SKILL.md`: Phase 5 IMPLEMENT requires re-reading the relevant reference section in the same turn before generating any deliverable, even if read earlier — no building formatted output from memory once web results / the live UI / an earlier draft have entered the conversation.

**Confirmed:** Qlik Answers Vocabulary supports bulk import of the 6-column `.xlsx` — so the "import file / upload via admin UI" framing is accurate and retained (no reframing to a manual-entry checklist).

### Added — authoritative Phase 3 report template (output consistency)

The Phase 3: PRESENT deliverable now has a single authoritative layout, addressing run-to-run inconsistency in the AI Readiness report. Previously `SKILL.md` Phase 3 only listed four elements to include ("Score, Findings, Roadmap, MCP-automatable") without fixing the document structure, so the top-level skeleton drifted between runs even when the per-layer rubrics were followed.

- **New file `references/report-template.md`** — the single source of truth for how the report is *presented* (distinct from `references/layer-analysis-guide.md`, which remains the source of truth for how findings are *classified and scored*). It locks: the document skeleton (score heading → italic summary → `Layer | Score | Weight | Contribution` table with a bold `**Overall**` row showing the weighted sum and `≈`-rounded final → per-layer sections → Optimization Roadmap → fixed closing question); the score-in-heading convention; a consistent `##` heading level for all five layers; and the Layer-3/Layer-5 glossary sub-layer insertion points (referencing the guide for their content, not duplicating it).
- **Locked per-layer `Significance:` wording** — each layer section opens with a fixed canonical sentence explaining why the layer matters for AI (Layer 1 field-name interpretation, Layer 2 field noise, Layer 3 Master Item/description importance with the Qlik Help best-practices link, Layer 4 calendar context, Layer 5 terminology coverage). Reproduced verbatim, translated faithfully when operating in another language.
- **Layer 5 always rendered** as its own `## Layer 5 — Synonyms (not scored)` section with its Significance line and the synonym-file offer — never scored, never a row in the summary table.
- **`SKILL.md` Phase 3 rewritten** to mandate exact reproduction of `references/report-template.md` and to require re-reading it in the same turn the report is generated (mirroring the Phase 5 / Key Rule #19 discipline). Scoring-weights and readiness-thresholds tables retained (they feed the numbers the template displays).
- **`references/layer-analysis-guide.md`** — each per-layer "Example output table" (Layers 1–4) and the Layer 5 report block gained a 📐 pointer clarifying those tables illustrate classification/scoring while the final report layout is governed by `references/report-template.md`, preventing the guide's slightly different example columns from re-introducing drift. No rubric/scoring content changed.
- **Key Rule #20 added** (see below).

### Fixed — stale capability claims

- `references/mcp-capability-matrix.md`: Removed "with group" from the `qlik_create_measure`/`qlik_create_dimension` descriptions, removed the "Master Item group assignment via MCP" reload-requirements row (it claimed a capability that doesn't exist), and added explicit "not available" rows for reading group assignment, setting group assignment, and reading existing synonyms/vocabulary.
- `references/mcp-capability-matrix.md`: Added rows for `qlik_search` (glossary lookup), `qlik_get_full_glossary_export`, `qlik_search_glossary_terms`, `qlik_get_glossary_term` (returns status; only called on explicit user request per Key Rule #17), `qlik_get_glossary_term_links`, `qlik_create_glossary_term_links` (user-confirmed candidates only; links live immediately but gated on 'Verified' status for Answers), and `qlik_update_glossary_term` (with the comma-delimiter and merge conventions).
- `references/mcp-capability-matrix.md`: Clarified the vocabulary-import row to state bulk file upload via the Qlik Answers Vocabulary UI is supported in the 6-column `.xlsx` format (previously "Must be done via UI," which could be misread as manual-entry-only).
- `references/implementation-guide.md` (Layer 3, was split across old Layers 3 and 4): Removed the old Layer 3 section, which incorrectly instructed calling `qlik_create_dimension`/`qlik_update_dimension` "with group tag" to assign groups via MCP. Replaced with an explicit manual-step reminder after every create/update.
- `references/layer-analysis-guide.md` (Layer 5, was Layer 6): Corrected the synonym layer to state MCP cannot read existing synonyms/tags either (previously implied `qlik_list_measures`/`qlik_list_dimensions` could be checked for synonym coverage and scored on it). Removed the scoring rubric; synonyms are now advisory-only, matching the group-assignment blind spot.
- `SKILL.md`: The blanket claim that "business glossary definitions... are not indexed" is no longer accurate under glossary-aware Master Items. Narrowed to a stated exception: linked terms are used (per Key Rules 14–16); unlinked, standalone glossary content is still not indexed.

### Added — Key Rules

The Key Rules list is renumbered to match the 5-layer model and now ends at #20. New in this release:

- **#12** — MCP cannot read or set group assignment; always ask, never score.
- **#13** — MCP cannot read or write synonyms/vocabulary; Layer 5 is generation-only.
- **#14** — Always ask the Glossary question in Phase 1, but never assume the answer; sub-layers run only on confirmed linkage.
- **#15** — Abbreviations function as Synonyms automatically; don't duplicate them with app-level Synonyms.
- **#16** — Conflicting Glossary Terms are flagged, not auto-resolved.
- **#17** — Linked terms must be 'Verified' to be used; the status notice is mandatory in Layer 3/Layer 5 reports, and `qlik_get_glossary_term` is called ONLY on explicit request.
- **#18** — Glossary link creation and abbreviation updates are proposed, never auto-executed; per-item approval only; abbreviation writes merge with existing values.
- **#19** — The skill's reference files are the sole source of truth for output formats; never web-search for or substitute an externally-researched structure; flag-don't-swap on suspected conflicts.
- **#20** — The Phase 3 report must reproduce `references/report-template.md` exactly (sections, order, summary/contribution table, locked per-layer Significance lines, closing question); re-read the template in the same turn the report is generated.

### Fixed — internal consistency

Renumbered all Layer 3–6 cross-references throughout `SKILL.md` and both reference files to match the new 5-layer numbering (e.g., "recreates the Layer 3 failure mode" now reads "reproduces the ungrouped-Master-Item failure mode (Key Rule #1)" since Layer 3 itself is where that failure mode lives now).

### Added — other

Phase 0 PREFLIGHT: a heads-up note that a quick Master Item list pass may surface signs of ungrouping, but this is not a scored check. Phase 3 PRESENT: the two Glossary roadmap rows are required whenever the Glossary sub-layers are active and the analyses found anything.

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