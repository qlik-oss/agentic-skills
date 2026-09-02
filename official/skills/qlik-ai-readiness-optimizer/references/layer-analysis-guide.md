# Layer Analysis Guide — Qlik AI Readiness Optimizer

Detailed checklists, severity classifications, scoring rubrics, and example output tables for each of the 5 layers. Referenced from the main [SKILL.md](../SKILL.md) during Phase 2: ANALYZE.

---

## Layer 1 — Field Naming

**Tool:** `qlik_get_fields`

⚠️ **Expectation setting**: Field naming issues require load script changes. This layer produces recommendations and copy-paste ready script snippets — not automated MCP fixes.

### What good field naming looks like

- **Title Case with spaces**: `Customer Name`, `Order Date`, `Net Revenue`
- **Full words, no abbreviations**: `Quantity` not `Qty`, `Amount` not `Amt`, `Number` not `Num`/`Nr`
- **Domain context where ambiguous**: `Order Date` not just `Date`, `Product Category` not just `Category`
- **No ETL/developer prefixes**: no `dim_`, `fact_`, `stg_`, `tbl_` prefixes
- **No system suffixes**: no `_ID`, `_KEY`, `_FK`, `_SK` unless intentionally visible
- **Boolean/flag fields use proposition prefixes**: `Is Active`, `Has Churned` — not `Active`, `ChurnFlag`, or bare `Flag1`

### Severity tiers — classify every field

**🔴 Severity: Opaque** (AI cannot interpret — must fix)
- Completely cryptic names: `F17_X`, `ZZBUKRS`, `VBELN`, `KNA1_KUNNR`
- Pure codes or single-letter fields: `A`, `X1`, `FL`
- System-generated hash/key names: `%HashKey_Table1`, `RowNo()`

**🟠 Severity: Ambiguous** (AI may misinterpret — should fix)
- Abbreviated but guessable names: `CUST_NM`, `ORD_AMT`, `Qty`, `Dt`, `Desc`
- ALL_CAPS or snake_case technical style: `ORDER_AMOUNT`, `customer_id`
- Generic names missing domain context: `Date`, `Name`, `Amount`, `Status`, `Type`, `Category`
- Boolean/flag fields with unclear meaning: `FLG_Y`, `Active`, `Flag1`

**🟡 Severity: Inconsistent** (readable individually but mixed conventions reduce optimization)
- Mixed naming styles in same app: some `Customer Name`, some `CUST_NM`, some `client_name`
- Mixed casing: some Title Case, some camelCase, some UPPER_SNAKE
- Mixed language: some English, some German/Dutch/local language field names

### Scoring rubric

For each field, assign a tier:
- **Good** (human-readable, Title Case, unambiguous) = 1.0
- **Inconsistent** (readable but breaks convention) = 0.7
- **Ambiguous** (guessable but risky) = 0.3
- **Opaque** (uninterpretable) = 0.0

**Layer 1 Score** = average of all field scores × 100 → expressed as %

### Example output table

> 📐 This table illustrates **classification and scoring** only. The **final report layout is governed by [report-template.md](report-template.md)** — the Phase 3 Layer 1 section uses that template's `Field(s) | Severity | Note` structure and its locked `Significance:` line.

| Field Name | Severity | Suggested Rename | Notes |
|------------|----------|-----------------|-------|
| `CUST_NM` | 🟠 Ambiguous | `Customer Name` | Abbreviated |
| `F17_X` | 🔴 Opaque | *(ask user)* | Cannot infer meaning |
| `Order Date` | ✅ Good | — | No change needed |

---

## Layer 2 — Field Visibility

**Tool:** `qlik_get_fields`

⚠️ **Expectation setting**: Field visibility changes require either load script modifications (`%` prefix) or Logical Model UI edits. This layer produces a hide/keep recommendation — not automated MCP fixes.

⚠️ **Dependency on Layer 3**: Hidden fields (`%` prefix) disappear from the Logical Model entirely. Before recommending a field be hidden, confirm it is NOT needed as a Master Dimension (Layer 3). When in doubt, keep it visible — MCP cannot check current Master Dimension usage against every field for you, so ask the user rather than assume.

### The principle: Signal-to-Noise Ratio

The AI sees every visible field as a potential candidate for answering questions. In a well-optimized app, the visible field set should contain **only business-meaningful fields** — typically 30–60 fields, not 150–300.

> ⛔ **ID/Key field rule — read before classifying any field:**
> Fields that look like IDs or keys (`customer_id`, `orderKey`, `product_FK`, `sales_id`, `CustomerID`, `ProductSK`, etc.) **must never be classified as 🔴 Hide and must never be described as having "no business value", "surrogate keys", "ETL noise", or any similar negative language.** They are analytically relevant because they enable distinct counts and aggregations. Always classify them as 🟠 Review and use this exact framing: *"Review these ID and key fields to confirm they are used in counts, distinct counts, or aggregations (e.g. `Count(Distinct CustomerID)`). If confirmed not used in any measure, they can be hidden."* Their naming style (snake_case, lowercase) is a Layer 1 concern — do not let it influence their Layer 2 classification.

### Classification categories

**🟢 Keep Visible** (business-meaningful, needed for questions)
- Fields that represent business dimensions: `Customer Name`, `Product Category`, `Region`
- Fields that represent measurable values: `Sales Amount`, `Quantity`, `Discount`
- Date fields used for time-based questions: `Order Date`, `Ship Date`
- Status/category fields users ask about: `Order Status`, `Customer Segment`

**🔴 Hide** (technical/infrastructure, adds noise)
- Join-only / link table fields: exist solely to resolve table associations, never asked about
- Synthetic keys: `$Syn 1`, `$Syn 2` (also indicates a data model issue)
- System fields: `$Table`, `$Field`, `$Rows`
- ETL metadata: `LoadTimestamp`, `SourceSystem`, `BatchID`, `RowHash`
- Flag/binary fields with no business meaning: `IsDeleted`, `IsActive_FL`, `ProcessedYN`

**🟠 Review with user** (could go either way)
- ID / Key fields (example: `Customer ID`, `orderKey`, `product_FK`, `CustomerID`) — these are often needed for distinct count measures (e.g., `Count(Distinct ProductID)`). Prompt: *"Are these ID fields used in any Count(Distinct ...) measures? If yes, keep visible. If not, consider hiding to reduce noise."* Do **not** penalize these fields in the visibility score — see the ⛔ callout above and the scoring rubric below.
- Duplicate fields: same data in multiple tables — keep one, hide the rest
- Calculated/derived fields where purpose is unclear without context
- Fields in a language the user doesn't ask questions in

**⚠️ Structural red flags — field-count threshold ladder** (same ladder used in Phase 0 PREFLIGHT, this is the finer-grained pass):
- ≤ 60 visible fields → ideal
- 61–200 visible fields → noisy, flag in this layer's scoring
- > 200 visible fields → structural; if not already flagged in Phase 0 PREFLIGHT, flag it now
- Synthetic keys present → data model needs restructuring (flag, don't just hide)
- Multiple tables with overlapping field names → ambiguity risk for AI

### Scoring rubric

Classify each visible field:
- **Keep Visible** (business-relevant) = 1.0
- **Review** (unclear, e.g. duplicates, purpose-uncertain derived fields) = 0.5
- **Should be Hidden** (technical/infrastructure noise, currently visible) = 0.0

**Special case — do NOT penalize in the score:**
- **ID / Key fields**: Score as 1.0 (neutral keep). Flag separately with the prompt about distinct-count usage. They are not noise until confirmed otherwise by the user.

**Layer 2 Score** = (fields correctly visible + fields already correctly hidden) / total fields × 100
(ID/key fields count as correctly visible — they are not defects)

Also report:
- **Signal-to-Noise Ratio**: count of business-meaningful visible fields / total visible fields
- **Recommended target**: reduce visible fields to ≤ 60 (flag if currently above this)

### Example output table

> 📐 This table illustrates **classification and scoring** only. The **final report layout is governed by [report-template.md](report-template.md)** — the Phase 3 Layer 2 section presents findings as that template's short narrative + bullets with its locked `Significance:` line.

| Field Name | Current State | Recommendation | Category | Notes |
|------------|--------------|----------------|----------|-------|
| `CustomerID` | Visible | 🟠 Review | ID/Key field | Confirm if used in `Count(Distinct ...)` measures |
| `Order Number` | Visible | 🟠 Review | User-facing ID | Users may search by this |
| `Product Category` | Visible | 🟢 Keep | Dimension | Business-relevant |
| `$Syn 1` | Visible | 🔴 Hide | Synthetic key | Model issue — flag separately |

---

## Layer 3 — Master Items + Descriptions

**Tools:** `qlik_list_measures`, `qlik_list_dimensions`

Master Items are how Qlik Answers selects the right metric. The description is the AI's primary signal — not the expression.

⚠️ **Why grouping lives here instead of as its own layer**: MCP has no tool that reads or sets a Master Item's group assignment — not `qlik_list_measures`, not `qlik_list_dimensions`, not the create/update tools. An ungrouped Master Item is invisible to Qlik Answers (Key Rule #1), but that status can only be confirmed by the user in the Logical Model UI, never from MCP data. Treat it as sub-dimension **D** below: always ask, never score.

### Special case: App has ZERO Master Items

If `qlik_list_measures` and `qlik_list_dimensions` both return empty:

1. **Score Layer 3 as 0%**
2. **Shift to a creation workflow**:
   - Analyze fields from Layers 1/2 to identify likely business measures and dimensions
   - Propose a starter set of 10-15 Master Items (5-8 measures, 5-7 dimensions)
   - For each: include name, expression, and description (rich format) — and remind the user that every proposed item still needs a group assigned manually after creation, or it reproduces the ungrouped-Master-Item failure mode (Key Rule #1) on day one
   - Present for user approval before creating anything
3. **Set expectations**: "This app has no Master Items, which means Qlik Answers has nothing to work with."

### Assessment dimensions

**A. Coverage:** Are key business metrics represented as Master Items?

**B. Description quality:** Classify each Master Item description:
- **🔴 Missing**: No description → AI relies on expression parsing alone
- **🟠 Minimal**: One-liner with no business context → AI may confuse with similar metrics
- **🟢 Rich**: Full business explanation → AI can confidently select the right metric

A rich description follows this pattern:
```
"[Metric Name]: [What it calculates in business terms]. [What it includes/excludes].
[When to use vs. similar metrics]. Also known as: [synonyms/abbreviations]."
```

**C. Expression complexity:** Read the actual expression and classify:

- **🟢 Simple** (score 1.0): Direct aggregations (`Sum(Sales)`), basic arithmetic, a single variable reference
- **🟠 Moderate** (score 0.5): Set analysis with static filters, simple conditionals, one level of nesting, 2-3 variable references
- **🔴 High** (score 0.2): Heavy variable density (3+ stacked `$(...)` references), deep set analysis, nested aggregations, multi-level conditionals, Pick/Match/Dual with complex logic

💡 A single variable is fine. The optimization opportunity arises with 3+ variables, nested chains, or variables referencing other variables. Enrich descriptions to explain the full resolved logic.

**C2. Set identifiers / alternate states — conditional flag, based on name/description transparency**

Qlik's documented Qlik Answers limitations: if a master measure's expression contains an inner set identifier — `{$<...>}` (current selection state), `{1<...>}` (full dataset), or `{StateName<...>}` (an alternate state) — Qlik Engine's set-analysis precedence rules make that inner identifier override any filter Qlik Answers tries to apply on top of it. This fails silently: no error, no warning, just a wrong-looking result. Example: `Sum({$<Car_Type={'SUV'}>}Price)` asked with a "Brand" filter returns all-brands SUV revenue, not the filtered brand's SUV revenue.

**But a pre-filtered measure is not inherently a defect.** Baking a filter into a measure via set analysis is a deliberate, common modeling pattern. The problem only arises when nobody — not the AI, not the user reading the answer — has any way to know the pre-filter is there. So for every master measure whose expression contains `{$<`, `{1<`, or `{`+any state name+`<`, check whether the **name or description alludes to the logic implemented in the set analysis**:

- ✅ **Documented — do NOT flag.** The name or description conveys the pre-filter. Example: a measure named `Discounts (USD)` with `{<[Currency Name]={'USD'}>}` in its expression — the name itself indicates it's Discounts in USD currency, which is exactly what the set analysis implements. Score this measure under C's normal complexity gradient only; no C2 penalty.
- 🔴 **Undocumented — flag, score 0.0 regardless of C tier.** Neither the name nor the description hints at the pre-filter. Example: a measure named just `Discounts` with the same `{<[Currency Name]={'USD'}>}` set logic and a generic description like *"Total Discount is the cumulative amount deducted from list price across all sales transactions, representing the difference between list price and actual selling price."* — nothing indicates the measure is pre-filtered to return results in USD. A user asking about discounts in another currency gets a silently wrong answer with no way to suspect it.

**Remediation for 🔴 flagged measures** (in order of preference):
1. **Enrich the name and/or description to state the pre-filter** — cheapest fix, no expression change, and it turns hidden logic into context the AI can actually use (e.g. rename to `Discounts (USD)`, or add "Pre-filtered to USD currency via set analysis — results always reflect USD transactions regardless of selections" to the description).
2. Remove or restructure the inner set identifier so filtering happens outside the expression — the right fix when the filter shouldn't be baked into the measure at all.

Judge "alludes to" on meaning, not exact wording — the name/description doesn't need to quote the set expression, it needs to communicate the constraint. When it's genuinely ambiguous whether the metadata covers the logic, flag it and let the user decide.

**D. Group assignment:** Not scored (see the ⚠️ callout above — MCP cannot read or set this). For each Master Item, ask the user to confirm it has a group in the Logical Model UI. Use this exact framing, don't imply MCP already checked it: *"Does '[Master Item name]' have a group assigned in the Logical Model? If not, Qlik Answers will never surface it, regardless of how good its description is."*

### Scoring rubric

| Sub-dimension | Weight | Scoring |
|---------------|--------|---------|
| Description quality | 85% | Missing=0.0, Minimal=0.4, Rich=1.0 |
| Expression complexity | 15% | Simple=1.0, Moderate=0.5, High=0.2, **contains a set identifier/alternate state not alluded to in the name or description=0.0 regardless of tier** (see C2 — documented pre-filters are not penalized) |

**Layer 3 Score** = weighted average across all Master Items × 100 (group assignment is flagged separately, not part of this score — see D above)

Description quality dominates the weighting deliberately — it is the AI's primary signal for metric selection (Key Rule #4). Expression complexity matters, but a rich description can largely compensate for a complex expression, while nothing compensates for a missing description.

### Example output table

> 📐 This table illustrates **classification and scoring** only. The **final report layout is governed by [report-template.md](report-template.md)** — the Phase 3 Layer 3 section uses that template's `Master Item | Type | Description | Expression | Score` structure, the **Coverage gap** and **Group assignment** callouts, and its locked `Significance:` line.

| Master Item | Type | Description | Expression Complexity | Score | Optimization |
|-------------|------|-------------|----------------------|-------|-------------|
| `Net Revenue` | Measure | 🟢 Rich | 🟢 Simple: `Sum(Revenue)-Sum(Returns)` | 100% | Fully optimized — confirm group is assigned |
| `Discounts (USD)` | Measure | 🟢 Rich | 🟠 Moderate: `Sum({<[Currency Name]={'USD'}>}Discount)` | 93% | Pre-filter documented in name — no C2 flag; confirm group is assigned |
| `Margin %` | Measure | 🟠 Minimal | 🔴 High: `$(vMarginCalc)` with 4 nested vars | 37% | Enrich description, consider inlining, confirm group is assigned |
| `Discounts` | Measure | 🟠 Minimal (generic — no mention of currency filter) | 🔴 C2 flag: `Sum({<[Currency Name]={'USD'}>}Discount)`, undocumented pre-filter | 34% | Rename to `Discounts (USD)` or state the USD pre-filter in the description, confirm group is assigned |
| `Customer` | Dimension | 🔴 Missing | 🟢 Simple: `CustomerName` | 15% | Add description, confirm group is assigned |

### Optional Sub-Layer: Linked Glossary Term Alignment (Glossary-Aware Master Items)

Qlik Answers can use metadata from Glossary Terms linked to Master Items as additional semantic
context (see [Qlik's glossary-aware Master Items documentation](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikAnswers/glossary-aware-master-items.htm)).
This sub-layer only runs if the user confirmed during Phase 1, Step 2 (Glossary Discovery) that
Master Items in this app are linked to one or more Glossary Terms, and a glossary export was
retrieved. If no linkage was confirmed, skip this sub-layer entirely — do not show it as 0% or
N/A, simply omit it from the report.

⚠️ **This is not a "does linkage exist" check.** It assumes linkage exists (confirmed in Phase 1)
and asks a narrower question: does the linked term's metadata agree with the Master Item's own
metadata, or does it introduce conflicting information?

⚠️ **Qlik Answers resolves linked Glossary Term metadata natively.** This skill does not
programmatically reconcile a Master Item and its linked term. The purpose of this sub-layer is to
flag cases where the two sources of truth disagree badly enough that they could confuse the AI's
understanding of the metric or dimension, and prompt the user to review — not to auto-fix the
conflict.

**How to build the comparison set:**
1. From the Phase 1 glossary export (`qlik_get_full_glossary_export`), collect each term's `name`,
   `description`, and its linked resources.
2. Match linked resources against this app's Master Items (from `qlik_list_measures` /
   `qlik_list_dimensions`) by resource id / app id — this is the mapping built in Phase 1, Step 2.
3. For every matched pair, compare the Master Item's name + description against the Glossary
   Term's name + description.

**Classification — for every Master Item with a linked Glossary Term:**

- 🟢 **Aligned** — term name and description describe the same concept as the Master Item; wording
  may differ, but meaning matches.
- 🟡 **Minor Differences** — term adds nuance, a synonym-like name, or slightly different phrasing,
  but is still describing the same underlying concept. Not "too different."
- 🔴 **Conflicting** — the term's name and/or description describes a materially different
  concept, scope, or calculation than the Master Item (e.g. a Glossary Term named "Gross Revenue"
  whose description describes pre-return totals, linked to a Master Item named "Net Revenue" that
  calculates `Sum(Revenue)-Sum(Returns)`). This is the only tier that should read as genuinely
  conflicting — don't over-flag stylistic or brevity differences as conflicts.

**Scoring impact (only applied when this sub-layer is active):**

| Tier | Score |
|------|-------|
| 🟢 Aligned | 1.0 |
| 🟡 Minor Differences | 1.0 (no penalty — not "too different") |
| 🔴 Conflicting | 0.2 |

Only 🔴 Conflicting pulls the score down. Aligned and Minor Differences both score 1.0, so a clean
glossary linkage never inflates or drags the Layer 3 score beyond what Description/Expression
already earned — it can only make things worse, never better, matching the requirement that this
sub-layer should only impact the overall grade negatively.

**Weight integration:** when active, Layer 3's internal composition becomes:

| Sub-dimension | Weight | Scoring |
|---------------|--------|---------|
| Description quality | 75% | Missing=0.0, Minimal=0.4, Rich=1.0 |
| Expression complexity | 15% | Simple=1.0, Moderate=0.5, High=0.2, **contains a set identifier/alternate state not alluded to in the name or description=0.0 regardless of tier** (see C2) |
| Glossary Term Alignment (optional) | 10% | Aligned/Minor Differences=1.0, Conflicting=0.2 |

When not active, use the standard 85%/15% split (no Glossary Alignment row) — this remains the
default for every app not using glossary-aware Master Items. Expression complexity carries 15% in
both modes; only Description quality absorbs the 10% shift. The overall Layer 3 weight within the
5-layer score (45%) is unchanged either way; only what's inside Layer 3 shifts.

**Report each conflicting item with guidance, don't just flag it:**

> "The linked Glossary Term '[Term Name]' and Master Item '[Master Item Name]' appear to describe
> different things — [one-sentence description of the conflict]. Qlik Answers will use both as
> context, so this mismatch could confuse which definition it applies. Please review the term and
> the Master Item together and confirm they're meant to represent the same concept, then update
> whichever one is out of date."

**Always include this Verified-status notice in the Layer 3 report when this sub-layer is active:**

> "⚠️ Glossary Terms must be in the **'Verified'** status to be used by Qlik Answers — a linked
> term in any other status (e.g. Draft) contributes nothing, no matter how well-aligned it is.
> This skill does not automatically query the status of every linked term, because an individual
> tool call is required for each one. If you'd like, ask me to check the status of specific
> term(s) and I'll look them up and alert you to any that aren't Verified."

If the user explicitly asks for the status of individual term(s) — and only then — use
`qlik_get_glossary_term` (with the `glossaryId`/`termId` from the Phase 1 mapping) for each
requested term, and alert the user for every term whose status is not 'Verified'. Never call this
tool proactively for all linked terms.

#### Example output table (only shown when this sub-layer is active)

| Master Item | Linked Glossary Term | Term Description (excerpt) | Alignment | Notes |
|-------------|----------------------|------------------------------|-----------|-------|
| `Net Revenue` | Net Revenue | "Revenue after returns and discounts..." | 🟢 Aligned | Consistent |
| `Customer Segment` | Segment | "Marketing-defined customer tier, refreshed quarterly..." | 🟡 Minor Differences | Same concept, different framing — fine |
| `Order Count` | Gross Orders | "Includes cancelled and returned orders..." | 🔴 Conflicting | Term describes a superset of what the measure calculates — review both definitions |

#### Link Opportunity Analysis (advisory — not scored)

Run this as the second part of the sub-layer, after the alignment classification. The alignment
check looks at terms that *are* linked; this analysis looks at terms that *aren't* — and finds the
ones that probably should be.

1. From the Phase 1 glossary export, take every Glossary Term that is **not** linked to any of
   this app's Master Items.
2. Compare each unlinked term's name + description against all Master Dimensions and Measures
   (from `qlik_list_dimensions`/`qlik_list_measures`) and identify candidate matches — cases where
   the term and a Master Item appear to describe the same concept. Judge on meaning, not exact
   wording, using the same standard as the alignment tiers above. Example: an unlinked term
   "Net Revenue" whose description describes revenue after returns, in a glossary alongside an app
   whose `Net Revenue` measure calculates `Sum(Revenue)-Sum(Returns)`.
3. Present the candidates:

| Glossary Term | Term Status | Candidate Master Item | Type | Why it looks like a match |
|---------------|-------------|------------------------|------|----------------------------|
| Net Revenue | Verified | `Net Revenue` | Measure | Same name; description describes post-returns revenue, matching the expression |
| Churn Rate | Draft | `Customer Churn %` | Measure | Different name, but description describes the same ratio |

4. These are **candidates for the user to confirm — never create links unprompted.** Linking a
   term gives Qlik Answers extra semantic context for the Master Item (and its Abbreviation as a
   synonym), so surface the upside, then let the user decide per candidate.
5. Include each candidate's term status when known, and remind the user that a linked term must be
   in the **'Verified'** status before Qlik Answers will use it (see the notice above) — a Draft
   candidate is still worth linking, but it won't take effect until verified.
6. Feed the confirmed-worthy candidates into the Phase 3 Optimization Roadmap as their own item:
   *"Link [N] Glossary Terms to Master Items"* — MCP-automatable, interactive (executed per
   candidate via `qlik_create_glossary_term_links` in Phase 5; see
   [references/implementation-guide.md](implementation-guide.md) Layer 3).

---

## Layer 4 — Date Fields + AutoCalendar

**Tool:** `qlik_get_fields`

⚠️ **Expectation setting**: Date field fixes require load script changes. This layer produces diagnostics and copy-paste script patterns — not automated MCP fixes.

### Assessment dimensions

**A. Date field recognition**
- Fields with date-indicating names — are they loaded as actual Date type or as strings?
- Fields loaded as strings containing date-like values → Qlik won't apply calendar logic
- Numeric date fields (e.g., `20240315` as integer) → need `Date#()` conversion
- Mixed format dates within same field → needs standardization

**B. AutoCalendar / Calendar table presence**
- AutoCalendar enabled → look for derived fields like `Year`, `Month`, `Quarter`, `Week`, `YearMonth`
- Manual Master Calendar / Date dimension table?
- Neither exists → time-based questions will not work reliably

**C. Fiscal year and custom calendar handling**
- Non-January fiscal year? Is there a fiscal year field or fiscal quarter mapping?
- Dual calendar needs (calendar year + fiscal year)?
- ⚠️ **Where does the fiscal logic actually live?** Qlik Answers does not index content inside a Calendar Period object — if fiscal quarters/periods are defined there instead of as a real field or Master Dimension, they are invisible to Answers no matter how well the rest of the model is prepared. Worse, Calendar Period objects (along with Hierarchies, Behaviors, and Custom analysis) are removed entirely once a tenant is enabled for the agentic Qlik Answers experience — so this isn't just an indexing gap, it can be a breaking change for that tenant. If fiscal logic lives in a Calendar Period object, recommend re-expressing it as a loaded field or Master Dimension.

**D. Relative date fields**
- Relative time markers ("Current Month", "YTD", "Rolling 12 Months")?
- Set Analysis flags or variables for relative date logic?

### Scoring rubric

| Check | Weight | Scoring |
|-------|--------|---------|
| Date fields loaded as proper Date type | 50% | All=1.0, Most=0.7, Few=0.3, None=0.0 |
| AutoCalendar or Calendar table present | 30% | Yes=1.0, Partial=0.5, No=0.0 |
| Fiscal year handling (if applicable) | 10% | Handled=1.0, N/A=1.0, Missing=0.0 |
| Relative date fields clean | 10% | Clean=1.0, Variable-dependent=0.3, Missing=0.0 |

**Layer 4 Score** = weighted sum × 100

### Example output table

> 📐 This table illustrates **classification and scoring** only. The **final report layout is governed by [report-template.md](report-template.md)** — the Phase 3 Layer 4 section opens with its locked `Significance:` line and uses this audit table when issues exist (or a short "best-in-class" narrative at 100%).

| Field Name | Loaded As | Expected Type | AutoCalendar | Issue | Action |
|------------|-----------|--------------|--------------|-------|--------|
| `OrderDate` | Date | Date | ✅ Yes | None | — |
| `ShipDT` | String | Date | ❌ No | String date | Convert + add to calendar |
| `20240315` (InvoiceDate) | Integer | Date | ❌ No | Numeric date | `Date#()` conversion |

---

## Layer 5 — Synonyms / Vocabulary

> ⚠️ **MCP Limitation**: The current MCP tooling **cannot read existing synonyms or vocabulary** from a Qlik app — there is no tool that returns this data, the same kind of gap as group assignment in Layer 3. Layer 5 is therefore **not scored** and is not included in the overall AI Readiness Score. It is always shown in the assessment report as an enhancement opportunity, never as a coverage percentage.

**Tools:** `qlik_list_measures`, `qlik_list_dimensions` — used only to source Master Item names for a *suggested* synonym file, not to check existing coverage.

### What MCP can and cannot do for Layer 5

- ❌ **Cannot read** existing synonyms/vocabulary from the app
- ❌ **Cannot write** synonyms to the app — vocabulary must be imported via the Qlik Answers admin UI
- ✅ **Can generate** a suggested synonym import file based on Master Item names retrieved via `qlik_list_measures`/`qlik_list_dimensions`

### Always include Layer 5 in the assessment report

> 📐 The **final report layout for Layer 5 is governed by [report-template.md](report-template.md)** — a `## Layer 5 — Synonyms (not scored)` section with its locked `Significance:` line, always shown but never scored and never in the summary table, ending with the synonym-file offer. The block below documents the *content* Layer 5 must convey; render it in the template's section shape.

Show it as a separate layer entry — not scored, but always visible:

```
Layer 5 — Synonyms / Vocabulary — ⬜ Not Scored
MCP cannot read existing vocabulary from this app. Synonyms cannot be assessed automatically.
Synonyms are important for Qlik Answers to match user language to your Master Items
(e.g. a user asking for "turnover" should resolve to your "Net Revenue" measure).

✅ I can generate a suggested synonym import file based on your [N] Master Items.
   This will be a file in the Qlik Answers vocabulary import format that you can
   review, edit, and upload directly via the Qlik Answers admin UI.

👉 Would you like me to generate the synonym file now?
```

The exact file format is defined in [references/implementation-guide.md](implementation-guide.md)
Layer 5, step 2, and must be followed as written — do not derive the format from the on-screen
suggestions table above or from external research into Qlik's UI.

**Always end the Layer 5 section with this explicit offer** — don't wait until after the roadmap; surface it here so the user can say yes immediately.

### Assessment dimensions (advisory only — not scored)

**A. Business jargon mapping**
- Industry-specific terms that differ from field/measure names?
- Internal company terms or abbreviations?
- Acronyms that don't match field names?

**B. Multilingual coverage** (if applicable)
- App used by people who ask questions in different languages?
- Synonyms defined in all relevant languages?
- Field names in one language but users ask in another?

### Anti-patterns to flag, not just coverage gaps

- **One synonym mapped to multiple fields** (e.g. "sales" assigned to two different measures) — ambiguous, forces Qlik Answers to guess which one the user meant.
- **Vague relative-ranking terms** ("top", "bottom") — these can be interpreted multiple, conflicting ways and should not be used as synonyms.

### Prioritization guidance (for when generating the file)

Not all Master Items need synonyms equally. Prioritize:

1. **High-frequency measures** (Revenue, Cost, Margin, Count) — users ask about these most, and use the most varied language
2. **Ambiguous dimensions** (Status, Type, Category) — generic names that could mean different things
3. **Metrics with known alternative names** in the business — ask the user: "What do your teams actually call these?"

**Layer 5 is not scored.** Do not include it in the AI Readiness Score or overall weighted calculation.

### On-screen suggestions table (analysis display only — NOT the file format)

> ⚠️ This `Master Item | Suggested Synonyms | Notes` table is the **on-screen display** you show
> the user while discussing Layer 5. It is **not** the format of the generated synonym file. The
> generated file follows the 6-column `.xlsx` spec (`Field | Locale | Terms | Condition Type |
> Condition Values | Master Item`) defined in
> [references/implementation-guide.md](implementation-guide.md) Layer 5, step 2 — that spec is
> authoritative; never substitute a different structure or research one externally.

| Master Item | Suggested Synonyms | Notes |
|-------------|--------------------|-------|
| `Net Revenue` | "Turnover", "Net Sales", "NR", "Nettoumsatz" | High-frequency measure — prioritize |
| `Product Category` | "Product Group", "Produktgruppe", "Category" | Ambiguous dimension |
| `Order Count` | "Number of Orders", "Bestellungen", "# Orders" | Multilingual — confirm which locales apply |

### Optional Sub-Layer: Glossary Abbreviations as Synonyms

This sub-layer only runs if the user confirmed during Phase 1, Step 2 (Glossary Discovery) that
Master Items are linked to Glossary Terms, and a glossary export was retrieved. If no linkage was
confirmed, skip it — omit from the report rather than showing 0%/N/A. Like the rest of Layer 5,
this sub-layer is advisory only and never scored.

**Why this matters:** Qlik's glossary-aware Master Items feature has Qlik Answers treat a linked
Glossary Term's **Abbreviation** as a synonym for the associated Master Item automatically — no
separate vocabulary/synonym entry is required for that term.

**What to produce:**
1. From the Phase 1 glossary export, collect each linked term's `name` and `abbreviation` field.
2. Match linked terms to this app's Master Items — reuse the mapping built in Phase 1, Step 2 (the
   same mapping used by the Layer 3 sub-layer above) rather than re-deriving it.
3. Present a table of every Master Item that has a linked Glossary Term, using exactly this
   structure — Master Item, its type (Measure or Dimension), and the linked term's Abbreviations
   (comma-separated when there are several, `—` when none is defined):

| Master Item | Type | Abbreviations(Synonyms) |
|-------------|------|--------------------------|
| `Time to Ship` | Measure | Lead Time, Fulfillment Time |
| `Net Revenue` | Measure | NR |
| `Customer Segment` | Dimension | — |

   Every abbreviation listed will be used by Qlik Answers as a synonym for that Master Item. Rows
   showing `—` have a linked term with no abbreviation defined — see step 5.

4. Tell the user explicitly:

> "Abbreviations defined on linked Glossary Terms are automatically used by Qlik Answers as
> synonyms for the Master Item they're linked to. If your Glossary already has the right
> abbreviations defined for these terms, you do **not** need to also add them as Synonyms directly
> on the app — that would just be duplicate maintenance."

   And always include the Verified-status notice in the same Layer 5 report:

> "⚠️ Glossary Terms must be in the **'Verified'** status to be used by Qlik Answers — an
> abbreviation on a non-Verified term will not act as a synonym. This skill does not automatically
> query the status of every linked term, because an individual tool call is required for each one.
> If you'd like, ask me to check the status of specific term(s) and I'll look them up and alert
> you to any that aren't Verified."

   As in Layer 3: only use `qlik_get_glossary_term` to check status if the user explicitly asks
   for the status of individual term(s), and alert them to any term not in 'Verified' status —
   never sweep all linked terms proactively.

5. **Missing Abbreviation Analysis** — every `—` row in the table above (a linked term with no
   Abbreviation defined) is a finding, not just a footnote:
   - For each such term, propose 1–3 candidate abbreviations/synonyms, using the same suggestion
     logic as the main Layer 5 synonym generation (business jargon, common short forms, known
     alternate names) — and ask the user what their teams actually call the metric, since internal
     vocabulary beats generic suggestions.
   - Present the proposals with multiple values delimited by commas:

| Master Item | Linked Glossary Term | Proposed Abbreviations(Synonyms) |
|-------------|----------------------|-----------------------------------|
| `Customer Segment` | Segment | Tier, Customer Tier |
| `Time to Ship` | Time to Ship | Lead Time, Fulfillment Time |

   - Explain the payoff: adding these as the term's Abbreviation makes them act as synonyms for
     the Master Item in Qlik Answers — a Glossary-side edit (`qlik_update_glossary_term`,
     `abbreviation` field) instead of app-side Synonym maintenance; the two features end up doing
     the same job for Qlik Answers.
   - Feed the accepted proposals into the Phase 3 Optimization Roadmap as their own item:
     *"Add Abbreviations to [N] linked Glossary Terms"* — MCP-automatable, interactive (applied
     per approved term in Phase 5; see
     [references/implementation-guide.md](implementation-guide.md) Layer 5).
6. This does not replace the main Layer 5 synonym-file generation offer above — it's a
   complementary check. A Master Item can have both a linked Glossary Term abbreviation *and*
   app-level synonyms; just avoid recommending an app-level synonym that only duplicates an
   abbreviation already covering the same term.

---

## Bonus Check: Sheet Structure (non-scored, advisory)

**Tool:** `qlik_describe_app` (check sheet count and names)

This does NOT affect the AI Readiness Score. Quick signal check:

- **Does the app have sheets?** Zero sheets → may be a data-only backend
- **Are sheets named descriptively?** ("Sales Overview") vs. generic ("Sheet 1")
- **Sheet count sanity**: >20 sheets may indicate scope creep

If sheet names are generic, mention as a quick win. Do NOT block the assessment for sheet issues.