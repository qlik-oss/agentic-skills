---
name: qlik-ai-readiness-optimizer
description: >-
  Analyzes a Qlik app via MCP and optimizes it for AI use (Qlik Answers
  and Qlik MCP) using a 6-Layer Model. Use this skill whenever the user
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
  version: 1.0.0
  tags:
    - qlik
    - ai-readiness
    - qlik-answers
    - mcp
allowed-tools: read
---

# Qlik AI Readiness Optimizer

Systematically analyze and optimize a Qlik Sense app for AI readiness — specifically for **Qlik Answers** and **Qlik MCP** consumption — based on Turan Pinar's 6-Layer Model (adapted).

## Why this exists

The Qlik Engine world is deterministic and technical. The AI world is semantic and probabilistic. Bridging them requires careful preparation across 6 layers. Without this preparation, Qlik Answers will deliver suboptimal results.

## The 6-Layer Model

| # | Layer | Priority | What it affects |
|---|-------|----------|-----------------|
| 1 | Field Naming | 🔴 Critical | AI schema understanding |
| 2 | Field Visibility | 🔴 Critical | AI noise reduction |
| 3 | Field Groups (Logical Model) | 🔴 Critical | Qlik Answers Master Item detection |
| 4 | Master Items + Descriptions | 🔴 Critical | AI metric precision and accuracy |
| 5 | Date Fields + AutoCalendar | 🟠 High | Time-based question accuracy |
| 6 | Synonyms / Vocabulary | 🟡 Medium | Business jargon, multilingual support |

Note: Knowledge Base is not part of the readiness score. It is an optional enhancement configured via the Qlik Answers admin UI.

## Workflow Overview

This skill follows a **Human-in-the-Loop** approach:

```
0. PREFLIGHT   → Verify MCP connectivity + data model sanity check
1. CONNECT     → Identify the target Qlik app
2. ANALYZE     → Assess all 6 layers → produce IST-Zustand report
3. PRESENT     → Show findings + AI Readiness Score to user
4. CONFIRM     → User reviews and approves the optimization roadmap
5. IMPLEMENT   → Execute approved changes layer by layer via MCP
6. VERIFY      → Confirm changes, report what's done / what needs manual steps
```

**Never skip the PRESENT → CONFIRM step.** Always show the analysis and get explicit user approval before making changes.

---

## Phase 0: PREFLIGHT — MCP + Data Model Sanity Check

### Step 1: MCP Connectivity Check

Attempt a lightweight MCP call (e.g., `qlik_search` or `qlik_describe_app`) to confirm Qlik MCP tools are connected and responding.

**If MCP tools are NOT available:**
- Tell the user: "This skill requires Qlik MCP tools to be connected. I can see they're not available in this session. To use this optimizer, connect the Qlik MCP Server first — then come back and we'll run the assessment."
- Do NOT proceed with the workflow. Do NOT attempt to fake an analysis without live data.
- Offer to explain the 6-Layer Model conceptually or provide a manual checklist.

**If MCP tools ARE available:** proceed to Step 2.

### Step 2: Data Model Sanity Check

Use `qlik_describe_app` and `qlik_get_fields` to check for:
- **Synthetic keys** (`$Syn 1`, `$Syn 2`, etc.) — table join problems
- **Circular references** or link tables suggesting unresolved many-to-many relationships
- **Extreme field counts** (>200 visible fields) — may need model restructuring first
- **Zero tables or zero fields** — app may be empty or misconfigured

**If critical structural issues are found:** present as a blocking warning, explain they undermine AI optimization, and let the user decide whether to proceed.

---

## Phase 1: CONNECT

Ask the user which app to analyze if not already specified.

Use `qlik_search` (query: name of the app) and `qlik_describe_app` (app_id).

Collect: App ID, App Name, number of tables, fields, sheets, and whether Qlik Answers is enabled.

---

## Phase 2: ANALYZE — IST-Zustand Assessment

Run a comprehensive analysis across all 6 layers. Batch tool calls where possible.

For the detailed per-layer checklists, severity classifications, scoring rubrics, and example output tables, see [references/layer-analysis-guide.md](references/layer-analysis-guide.md).

**Key tools per layer:**
- Layers 1, 2, 5: `qlik_get_fields`
- Layer 3: `qlik_list_dimensions`, `qlik_get_fields`
- Layer 4: `qlik_list_measures`, `qlik_list_dimensions`
- Layer 6: `qlik_list_dimensions`, `qlik_list_measures` (check for synonyms/tags)

**Bonus check (non-scored, advisory):** Sheet structure — check `qlik_describe_app` for sheet count and naming quality.

---

## Phase 3: PRESENT — AI Readiness Report

Generate a structured report with:
1. **AI Readiness Score** (0–100%)
2. **Layer-by-layer findings**
3. **Prioritized Optimization Roadmap**
4. **What MCP can automate vs. what needs manual steps**

### Scoring weights

| Layer | Weight |
|-------|--------|
| 1 — Field Naming | 15% |
| 2 — Visibility | 15% |
| 3 — Groups | 27% |
| 4 — Master Items | 27% |
| 5 — Dates | 9% |
| 6 — Synonyms | 7% |

### Readiness thresholds

| Score | Rating | Interpretation |
|-------|--------|---------------|
| 0–30% | 🔴 Not Ready | Poor or misleading AI results. Do not enable Qlik Answers until layers 3, 4 are addressed. |
| 31–50% | 🟠 Partially Ready | Misses key metrics or picks wrong fields. Fix ungrouped Master Items and descriptions first. |
| 51–75% | 🟡 Functional | Works for common questions but has gaps. Good enough to start testing. |
| 76–90% | 🟢 AI-Ready | Well-prepared. Remaining improvements are polish. |
| 91–100% | ✅ Optimized | Best-in-class. All layers addressed, descriptions rich, noise minimal. |

Present the roadmap as a prioritized table with columns: Priority, Layer, Action, MCP Automatable?, Effort.

---

## Phase 4: CONFIRM — Human-in-the-Loop

**Always pause here.** Present the roadmap and confirm with the user before proceeding. Match the user's language (detect from their messages).

Offer options:
- "Optimize all layers" (still confirm each layer before executing)
- "Only specific layers" (user picks)
- "Start with Layer 3 and 4" (highest impact — recommended default)

---

## Phase 5: IMPLEMENT — Layer-by-Layer Optimization

For each approved layer, execute via MCP and confirm with user before moving to next.

For detailed per-layer implementation steps, output templates, and copy-paste script snippets, see [references/implementation-guide.md](references/implementation-guide.md).

For the MCP capability matrix and reload requirements, see [references/mcp-capability-matrix.md](references/mcp-capability-matrix.md).

**Summary of what MCP can vs. cannot do:**
- ✅ Create new Master Measures/Dimensions (with groups + descriptions) — live immediately
- ⚠️ Edit existing Master Items — in preview
- ⚠️ Update load script — in preview, requires reload
- ❌ Retrieve variable definitions — not available
- ❌ Import synonyms/vocabulary — must be done via UI

---

## Phase 6: VERIFY

After completing each layer:
- Confirm what was changed
- Note what required manual steps (and provide exact instructions)
- Update the AI Readiness Score
- Remind user about reload requirements for load script changes
- Ask if user wants to continue to next layer

See [references/mcp-capability-matrix.md](references/mcp-capability-matrix.md) for reload requirement details.

---

## Key Rules

1. **Ungrouped Master Items are invisible to Qlik Answers** — no exceptions
2. **"Logic Disabled" in Logical Model = ALL Master Items invisible** — check this first
3. **Dates loaded as strings will not work** for time-based questions
4. **Don't give the AI more fields than necessary** — less noise = fewer errors
5. **Descriptions are primary** — the AI uses them to decide which metric to use
6. **High variable density in expressions reduces AI resolution confidence** — enrich descriptions or inline where feasible
7. **Never delete existing Master Items** — it breaks dashboards. Create new ones alongside.
8. **Always get user confirmation** before making changes
9. **MCP cannot retrieve variable definitions** — ask the user for resolved values if inlining
10. **Load script changes require an app reload** — Master Item changes via MCP are live immediately

## Communication Style

- Speak in the user's language — detect from their messages and match it
- Use clear Layer numbers when referencing the model
- Be specific about what MCP can vs. cannot do
- Offer copy-paste ready code/scripts for manual steps
- Celebrate wins (adapt tone/language to the user)
