---
name: qlik-ai-readiness-optimizer
description: >-
  Analyzes a Qlik app via MCP and optimizes it for AI use (Qlik Answers
  and Qlik MCP) using a 5-Layer Model. Use this skill whenever the user
  wants to: assess or improve how well a Qlik app works with Qlik Answers
  or MCP, check AI readiness, fix field naming or grouping issues for AI,
  improve Master Item descriptions, reduce field noise, audit date fields
  for time-based questions, create synonym mappings, or prepare an app for
  AI consumption. Also trigger when: user says "AI-ready", "optimize for
  Answers/MCP", "Qlik AI Health Check", "AI Readiness", "prepare app for
  AI", "Answers isn't working", "Answers gives wrong results", "Master
  Items not showing", "fields not visible to AI", or mentions ungrouped
  items, noisy fields, or missing descriptions. Always use this skill even
  if the user only mentions one layer, one issue, or one field — the full
  assessment provides context for targeted fixes.
license: Apache-2.0
metadata:
  author: JoshQlikDesign
  version: 2.0.0
  tags:
    - qlik
    - ai-readiness
    - qlik-answers
    - mcp
allowed-tools: read
---

# Qlik AI Readiness Optimizer

Systematically analyze and optimize a Qlik Sense app for AI readiness — specifically for **Qlik Answers** and **Qlik MCP** consumption — based on Turan Pinar's 5-Layer Model (adapted).

**Example request:** *"Use the qlik-ai-readiness-optimizer to give me an AI Readiness report of my Sales Qlik app on my product tenant."* The skill scores all five layers, returns the report with a prioritized optimization roadmap, then helps you act on roadmap items interactively — confirming each change before it's applied.

## Why this exists

The Qlik Engine world is deterministic and technical. The AI world is semantic and probabilistic. Bridging them requires careful preparation across 5 layers. Without this preparation, Qlik Answers will deliver suboptimal results.

## The 5-Layer Model

| # | Layer | Priority | What it affects |
|---|-------|----------|-----------------|
| 1 | Field Naming | 🔴 Critical | AI schema understanding |
| 2 | Field Visibility | 🔴 Critical | AI noise reduction |
| 3 | Master Items + Descriptions | 🔴 Critical | AI metric precision, accuracy, and group/visibility to Qlik Answers |
| 4 | Date Fields + AutoCalendar | 🟠 High | Time-based question accuracy |
| 5 | Synonyms / Vocabulary | 🟡 Enhancement — **not scored** | Business jargon, multilingual support |

Note: Field grouping (Logical Model) is assessed as part of Layer 3, not as its own scored layer. MCP cannot read or set a Master Item's group assignment — there is no tool that returns or modifies it — so it can never be verified from live data, only flagged for manual confirmation. Scoring it as an independent layer would produce a score built entirely on an assumption (typically 0%, since absence of readable data isn't evidence of absence of grouping), which is worse than not scoring it at all.

Note: Layer 5 is not included in the AI Readiness Score. The MCP tooling cannot read (or write) existing synonyms from a Qlik app's vocabulary — the same kind of blind spot as group assignment. Layer 5 is offered as an optional synonym file generation step after the scored layers are complete.

Note: Layer 3 includes an **optional sub-layer** — Linked Glossary Term Alignment — that only activates if the user confirms (in Phase 1) that Master Items are linked to Glossary Terms. It flags cases where a linked term's name/description conflicts with the Master Item's own name/description, and only ever pulls the Layer 3 score *down*, never up. See [references/layer-analysis-guide.md](references/layer-analysis-guide.md) Layer 3.

Note: Layer 5 includes an **optional sub-layer** — Glossary Abbreviations as Synonyms — under the same condition. It's advisory only, like the rest of Layer 5. See [references/layer-analysis-guide.md](references/layer-analysis-guide.md) Layer 5.

Note: Knowledge Base is not part of the readiness score. A Knowledge Base is a property of an **Assistant** (which combines one structured app with unstructured document sources), not of a single-app Qlik Answers session — if the user's context is "Qlik Answers on this one app" rather than a multi-app Assistant, Knowledge Base configuration doesn't apply and can be skipped without qualification.

## Workflow Overview

This skill follows a **Human-in-the-Loop** approach:

```
0. PREFLIGHT   → Verify MCP connectivity + data model sanity check
1. CONNECT     → Identify the target Qlik app + ALWAYS ask about linked Glossary Terms
2. ANALYZE     → Assess all 5 layers → produce IST-Zustand report
3. PRESENT     → Show findings + AI Readiness Score to user
4. CONFIRM     → User reviews and approves the optimization roadmap
5. IMPLEMENT   → Execute approved changes layer by layer via MCP
6. VERIFY      → Confirm changes, report what's done / what needs manual steps
```

**Never skip the PRESENT → CONFIRM step.** Always show the analysis and get explicit user approval before making changes.

**Never skip the Phase 1 Glossary question.** Even when the user asks for an immediate assessment ("run an AI readiness for X"), always ask whether Master Items are linked to Glossary Terms — and get the glossary name(s) if so — before starting Phase 2. See Phase 1, Step 2.

---

## Phase 0: PREFLIGHT — MCP + Data Model Sanity Check

### Step 1: MCP Connectivity Check

Attempt a lightweight MCP call (e.g., `qlik_search` or `qlik_describe_app`) to confirm Qlik MCP tools are connected and responding.

**If MCP tools are NOT available:**
- Tell the user: "This skill requires Qlik MCP tools to be connected. I can see they're not available in this session. To use this optimizer, connect the Qlik MCP Server first — then come back and we'll run the assessment."
- Do NOT proceed with the workflow. Do NOT attempt to fake an analysis without live data.
- Offer to explain the 5-Layer Model conceptually or provide a manual checklist.

**If MCP tools ARE available:** proceed to Step 2.

### Step 2: Data Model Sanity Check

Use `qlik_describe_app` and `qlik_get_fields` to check for:
- **Synthetic keys** (`$Syn 1`, `$Syn 2`, etc.) — table join problems
- **Circular references** or link tables suggesting unresolved many-to-many relationships
- **Extreme field counts** (>200 visible fields) — structural, flag here before a full Layer 2 pass; see [references/layer-analysis-guide.md](references/layer-analysis-guide.md) Layer 2 for the full threshold ladder (≤60 ideal, 61–200 noisy, >200 structural)
- **Signs the app may have ungrouped Master Items** (a quick `qlik_list_measures`/`qlik_list_dimensions` pass) — MCP cannot read group assignment, so this can only be a heads-up to ask the user, not a scored check; see Layer 3
- **Zero tables or zero fields** — app may be empty or misconfigured

**If critical structural issues are found:** present as a blocking warning, explain they undermine AI optimization, and let the user decide whether to proceed.

**If the user is resuming a previous optimization session:** re-run a quick check (`qlik_list_measures`/`qlik_list_dimensions`) before proposing new Master Items, to avoid duplicating items already created in an earlier session.

---

## Phase 1: CONNECT

### Step 1: Identify the App

Ask the user which app to analyze if not already specified.

Use `qlik_search` (query: name of the app) and `qlik_describe_app` (app_id).

Collect: App ID, App Name, number of tables, fields, and sheets via `qlik_describe_app`. No Qlik MCP tool currently reports whether Qlik Answers is enabled for an app — ask the user directly, or note it as unknown and proceed with the technical assessment regardless (the 5-layer model applies whether or not Answers is currently turned on).

### Step 2: Glossary Discovery (REQUIRED question — always ask)

⛔ **This question is mandatory, every session, before any analysis begins.** Even when the user's request names the app and asks for an immediate assessment (e.g. "run an AI readiness for X"), always ask it first and wait for the answer — do not begin any layer analysis until the user has responded. What's optional is whether the Glossary *sub-layers* activate (that depends on the answer); the question itself is never optional and is never satisfied by assuming "no."

Ask the user: **"Are any Master Items (dimensions or measures) in this app linked to Glossary Terms? If so, what are the name(s) of the associated Glossary/Glossaries?"**

- **If the user says no, or doesn't know:** skip Glossary discovery entirely and proceed to Phase 2 with the standard 5-layer assessment. The optional Glossary sub-layers in Layer 3 and Layer 5 (see [references/layer-analysis-guide.md](references/layer-analysis-guide.md)) simply won't appear in the report — don't score them as 0% or N/A.
- **If the user says yes:** get the name(s) of the associated Glossary/Glossaries (ask again if they confirmed linkage but didn't name them), then:
  1. For each name provided, call `qlik_search` with `query` set to the glossary name and `resourceType` set to `glossary` to find it and capture its `glossaryId`. If multiple matches come back, show them to the user and ask which one they mean before proceeding. If no match is found, tell the user and ask them to double-check the name.
  2. For each confirmed `glossaryId`, call `qlik_get_full_glossary_export` to retrieve all terms, categories, and linked resources for that glossary. This is a costly, single-shot call by the tool's own design — call it once per confirmed glossary, not repeatedly.
  3. Gather this app's Master Items now if not already collected (`qlik_list_measures`, `qlik_list_dimensions`), then match each term's linked resources against this app's Master Items (by resource id / app id) to build the Master-Item ↔ Glossary-Term mapping that the Layer 3 and Layer 5 optional sub-layers use.
  4. If none of the glossary's linked resources match this app's Master Items, tell the user no linkage was found for this app and skip the optional sub-layers — the glossary may still be legitimately linked to other apps.

Carry this mapping (or its absence) into Phase 2 — it's what determines whether the Layer 3 and Layer 5 optional sub-layers activate.

---

## Phase 2: ANALYZE — IST-Zustand (Current-State) Assessment

⛔ **Do not enter this phase until the Phase 1, Step 2 Glossary question has been asked and answered.**

Run a comprehensive analysis across all 5 layers. Batch tool calls where possible.

For the detailed per-layer checklists, severity classifications, scoring rubrics, and example output tables, see [references/layer-analysis-guide.md](references/layer-analysis-guide.md).

**Key tools per layer:**
- Layers 1, 2, 4: `qlik_get_fields`
- Layer 3: `qlik_list_measures`, `qlik_list_dimensions` (plus the Phase 1 Glossary mapping, if any, for the optional Linked Glossary Term Alignment sub-layer — no new tool calls needed, reuse the Phase 1 export)
- Layer 5: `qlik_list_measures`, `qlik_list_dimensions` (to source Master Item names for synonym-file generation only — MCP cannot read existing synonyms/tags, so this is not a coverage check; plus the Phase 1 Glossary mapping, if any, for the optional Glossary Abbreviations sub-layer)

**Bonus check (non-scored, advisory):** Sheet structure — check `qlik_describe_app` for sheet count and naming quality.

---

## Phase 3: PRESENT — AI Readiness Report

⛔ **The report layout is fixed — reproduce [references/report-template.md](references/report-template.md) exactly** (Key Rule #20): same sections in the same order, the score/weight/**contribution** summary table with the `Overall ≈ rounded` row, the locked per-layer `Significance:` lines, the roadmap columns, and the fixed closing question — nothing added, reordered, dropped, or re-authored. **Re-read the template in the same turn you generate the report**, even if read earlier, so the layout isn't rebuilt from memory (same discipline as Key Rule #19). The template governs *presentation*; the layer guide governs *classification/scoring*.

It covers all four required elements — AI Readiness Score, layer-by-layer findings (Layer 5 always shown, not scored), the prioritized Optimization Roadmap, and what MCP can automate vs. needs manual steps. Use the scoring weights and thresholds below to compute the numbers it displays.

### Scoring weights

| Layer | Weight |
|-------|--------|
| 1 — Field Naming | 20% |
| 2 — Visibility | 20% |
| 3 — Master Items | 45% |
| 4 — Dates | 15% |
| 5 — Synonyms | **not scored** — MCP cannot read existing vocabulary; offered as a separate generation step after analysis |

**Overall AI Readiness Score** = weighted sum of Layers 1–4 only (totals 100%)

Note: Layer 3's internal composition is Description 85% / Expression 15% by default. When the optional Glossary Term Alignment sub-layer is active (see Phase 1, Step 2), it shifts to Description 75% / Expression 15% / Glossary Alignment 10% — the overall 45% weight Layer 3 carries in the total score is unchanged in both modes. See [references/layer-analysis-guide.md](references/layer-analysis-guide.md) Layer 3 for the full rubric.

### Readiness thresholds

| Score | Rating | Interpretation |
|-------|--------|---------------|
| 0–30% | 🔴 Not Ready | Poor or misleading AI results. Do not enable Qlik Answers until layer 3 (Master Items, including group assignment) is addressed. |
| 31–50% | 🟠 Partially Ready | Misses key metrics or picks wrong fields. Fix ungrouped Master Items and descriptions first. |
| 51–75% | 🟡 Functional | Works for common questions but has gaps. Good enough to start testing. |
| 76–90% | 🟢 AI-Ready | Well-prepared. Remaining improvements are polish. |
| 91–100% | ✅ Optimized | Best-in-class. All layers addressed, descriptions rich, noise minimal. |

Present the roadmap as a prioritized table with columns: Priority, Layer, Action, MCP Automatable?, Effort.

When the Glossary sub-layers are active, the roadmap must also include (as their own rows, when the analyses found anything):
- **"Link [N] Glossary Terms to Master Items"** — from the Layer 3 Link Opportunity Analysis; MCP-automatable, interactive (per-candidate confirmation via `qlik_create_glossary_term_links`)
- **"Add Abbreviations to [N] linked Glossary Terms"** — from the Layer 5 Missing Abbreviation Analysis; MCP-automatable, interactive (per-term approval via `qlik_update_glossary_term`, multiple synonyms comma-delimited)

---

## Phase 4: CONFIRM — Human-in-the-Loop

**Always pause here.** Present the roadmap and confirm with the user before proceeding. Match the user's language (detect from their messages).

Offer options:
- "Optimize all layers" (still confirm each layer before executing)
- "Only specific layers" (user picks)
- "Start with Layer 3" (Master Items — highest impact, recommended default)

---

## Phase 5: IMPLEMENT — Layer-by-Layer Optimization

For each approved layer, execute via MCP and confirm with user before moving to next.

⛔ **Re-read the spec before generating any deliverable.** Before producing a layer-specific deliverable — the synonym import file above all, but also roadmap tables and load-script snippets — re-open the relevant section of [references/implementation-guide.md](references/implementation-guide.md) (or [references/layer-analysis-guide.md](references/layer-analysis-guide.md)) **in the same turn**, even if you already read it earlier in the conversation. Do not build a formatted deliverable from memory once other material — web search results, the live Qlik UI, or an earlier draft — has entered the conversation. The skill's spec is authoritative; external research never overrides it (Key Rule #19).

For detailed per-layer implementation steps, output templates, and copy-paste script snippets, see [references/implementation-guide.md](references/implementation-guide.md).

For the MCP capability matrix and reload requirements, see [references/mcp-capability-matrix.md](references/mcp-capability-matrix.md).

**Summary of what MCP can vs. cannot do:** create, edit, and delete Master Measures/Dimensions live immediately; load script updates are in preview; variable definitions, Master Item group assignment, and synonym read/import are not available at all. See [references/mcp-capability-matrix.md](references/mcp-capability-matrix.md) for the full tool-by-tool table.

---

## Phase 6: VERIFY

After completing each layer:
- Confirm what was changed. If any approved change failed to apply (rate limit, validation error, stale app state), explicitly list which ones succeeded vs. failed before asking to continue — don't let a partial failure silently roll into the next layer's confirmation.
- Note what required manual steps (and provide exact instructions)
- Update the AI Readiness Score
- Remind user about reload requirements for load script changes
- If the change touched the Logical Model (e.g. grouping), tell the user Qlik Answers can take up to 24 hours to reindex — this is separate from the app-engine "live immediately" behavior, and testing in Answers right away may still show stale results even though the fix applied correctly
- Ask if user wants to continue to next layer

See [references/mcp-capability-matrix.md](references/mcp-capability-matrix.md) for reload requirement details.

---

## Key Rules

1. **Ungrouped Master Items are invisible to Qlik Answers** — no exceptions. This cannot be verified via MCP (see Rule 12) — ask the user or point them to the Logical Model UI rather than inferring it from what MCP can see.
2. **Dates loaded as strings will not work** for time-based questions
3. **Don't give the AI more fields than necessary** — less noise = fewer errors
4. **Descriptions are primary** — the AI uses them to decide which metric to use
5. **High variable density in expressions reduces AI resolution confidence** — enrich descriptions or inline where feasible
6. **This skill never deletes existing Master Items** — its job is to assess and improve AI readiness, not to manage master-item lifecycle, so the IMPLEMENT phase only creates new items and edits existing ones. Deletion is a real, sometimes-correct action (e.g. a true duplicate created in error), but it requires its own usage-verification and confirmation workflow — treat any delete request as out of scope for this skill and hand it off to whatever governs master-item lifecycle in your environment, rather than calling `qlik_delete_measure`/`qlik_delete_dimension` here.
7. **Always get user confirmation** before making changes
8. **MCP cannot retrieve variable definitions** — ask the user for resolved values if inlining
9. **Load script changes require an app reload** — Master Item content changes (create/edit/delete, descriptions) via MCP are live immediately; group assignment is not — see Rule 12.
10. **Only structured, named Master Items are indexed by Qlik Answers** — label expressions on Master Items, and content inside Packages, Hierarchies, Behaviors, Calendar Periods, Custom analysis, and Example questions are not indexed. On tenants enabled for the agentic Qlik Answers experience, those unindexed feature types are removed entirely, not just skipped — treat logic living in any of them as something that needs to be re-expressed as a real field or Master Item, not left in place. **Exception:** a Glossary Term explicitly linked to a Master Item *is* used by Qlik Answers (see Rules 14–16) — this exception is narrow and applies only to terms linked via glossary-aware Master Items, not to glossary content that stands alone with no Master Item link.
11. **If two users get different answers to the same question, check section access first** — Qlik Answers automatically inherits and enforces existing section access / row-level security with no extra configuration, so differing permissions are a common, expected cause of differing answers. Don't assume a data-model defect until access parity is ruled out.
12. **MCP cannot read or set a Master Item's group assignment** — no tool returns or accepts it, including at creation time. Never present a group/grouping score as if it were measured; always frame group status as something the user needs to confirm or fix manually in the Logical Model UI. This is why grouping is a checklist item inside Layer 3 rather than its own scored layer.
13. **MCP cannot read or write synonyms/vocabulary at all** — Layer 5 is never scored. The only thing MCP enables here is generating a suggested synonym import file from Master Item names for the user to review, edit, and upload themselves via the Qlik Answers admin UI.
14. **Always ask the Glossary question in Phase 1 — but never assume the answer** — before starting any analysis, ask whether Master Items are linked to Glossary Terms and, if so, the glossary name(s). Never skip the question, even on a direct "just run the assessment" request. Then: only run the Layer 3 / Layer 5 Glossary sub-layers if the user confirms linkage and a glossary export was retrieved. Never assume linkage, and never score these sub-layers as 0% or N/A when linkage wasn't confirmed — omit them from the report instead.
15. **Glossary Term Abbreviations function as Synonyms automatically** — Qlik Answers uses a linked Glossary Term's Abbreviation as a synonym for the associated Master Item without any separate vocabulary import. Don't recommend an app-level Synonym that only duplicates an Abbreviation already defined on a linked term.
16. **A Glossary Term that conflicts with its linked Master Item is flagged, not auto-resolved** — Qlik Answers resolves the two sources of metadata natively; this skill's job is only to flag genuinely conflicting name/description pairs (not stylistic differences) and prompt the user to review which side is out of date, per the Layer 3 optional sub-layer.
17. **Glossary Terms must be 'Verified' to be used by Qlik Answers — but only check status on explicit request** — whenever the Glossary sub-layers are active, the Layer 3 and Layer 5 reports must include the notice that only terms in the 'Verified' status are used by Answers, and that this skill does not automatically query every term's status (each term requires its own tool call). ONLY use `qlik_get_glossary_term` when the user explicitly asks for the status of individual term(s); then alert them to any requested term not in 'Verified' status. Never sweep all linked terms proactively.
18. **Glossary link creation and abbreviation updates are proposed, never auto-executed** — the Layer 3 Link Opportunity Analysis and Layer 5 Missing Abbreviation Analysis produce roadmap candidates only. Creating a term↔Master-Item link (`qlik_create_glossary_term_links`) or writing abbreviations (`qlik_update_glossary_term`) happens per item, with explicit user approval of that item, never as a blanket batch. Abbreviation writes must merge with any existing comma-delimited value, not overwrite it.
19. **The skill's reference files are the sole source of truth for output formats** — deliverable structures (the synonym import file format above all, but every layer's output templates) come only from this skill's reference files. Never web-search for a format the skill already specifies, and never substitute an externally-researched structure — or one inferred from the live Qlik UI — for a skill-defined one. The synonym import file in particular has an authoritative 6-column `.xlsx` spec in [references/implementation-guide.md](references/implementation-guide.md) Layer 5; using any other structure causes imports to fail. If a spec looks outdated or genuinely conflicts with current Qlik functionality, flag it to the user and ask — don't silently change it.
20. **The Phase 3 AI Readiness report must reproduce [references/report-template.md](references/report-template.md) exactly** — the same sections in the same order, the score/weight/**contribution** summary table with the `Overall ≈ rounded` row, the locked per-layer `Significance:` lines (verbatim, translated faithfully in other languages), the Optimization Roadmap columns, and the fixed closing question. Nothing added, reordered, dropped, or re-authored. Layer 5 is always shown as a section but never scored and never in the summary table. Re-read the template in the same turn you generate the report (as with Rule #19); the template governs presentation, [references/layer-analysis-guide.md](references/layer-analysis-guide.md) governs classification/scoring.

## Communication Style

- Speak in the user's language — detect from their messages and match it
- Use clear Layer numbers when referencing the model
- Be specific about what MCP can vs. cannot do
- Offer copy-paste ready code/scripts for manual steps
- Celebrate wins (adapt tone/language to the user)