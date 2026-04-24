# Layer Analysis Guide — Qlik AI Readiness Optimizer

Detailed checklists, severity classifications, scoring rubrics, and example output tables for each of the 6 layers. Referenced from the main [SKILL.md](../SKILL.md) during Phase 2: ANALYZE.

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

| Field Name | Severity | Suggested Rename | Notes |
|------------|----------|-----------------|-------|
| `CUST_NM` | 🟠 Ambiguous | `Customer Name` | Abbreviated |
| `F17_X` | 🔴 Opaque | *(ask user)* | Cannot infer meaning |
| `Order Date` | ✅ Good | — | No change needed |

---

## Layer 2 — Field Visibility

**Tool:** `qlik_get_fields`

⚠️ **Expectation setting**: Field visibility changes require either load script modifications (`%` prefix) or Logical Model UI edits. This layer produces a hide/keep recommendation — not automated MCP fixes.

⚠️ **Dependency on Layer 3**: Hidden fields (`%` prefix) disappear from the Logical Model entirely. Before recommending a field be hidden, confirm it is NOT needed as a Master Dimension or grouped field. When in doubt, keep it visible and address noise via grouping in Layer 3 instead.

### The principle: Signal-to-Noise Ratio

The AI sees every visible field as a potential candidate for answering questions. In a well-optimized app, the visible field set should contain **only business-meaningful fields** — typically 30–60 fields, not 150–300.

### Classification categories

**🟢 Keep Visible** (business-meaningful, needed for questions)
- Fields that represent business dimensions: `Customer Name`, `Product Category`, `Region`
- Fields that represent measurable values: `Sales Amount`, `Quantity`, `Discount`
- Date fields used for time-based questions: `Order Date`, `Ship Date`
- Status/category fields users ask about: `Order Status`, `Customer Segment`

**🔴 Hide** (technical/infrastructure, adds noise)
- Primary/foreign key fields: `CustomerID`, `OrderKey`, `ProductSK`
- Join-only fields: exist solely to link tables, never asked about
- Synthetic keys: `$Syn 1`, `$Syn 2` (also indicates a data model issue)
- System fields: `$Table`, `$Field`, `$Rows`
- Link table / mapping table fields used only for resolution
- ETL metadata: `LoadTimestamp`, `SourceSystem`, `BatchID`, `RowHash`
- Flag/binary fields with no business meaning: `IsDeleted`, `IsActive_FL`, `ProcessedYN`

**🟠 Review with user** (could go either way)
- ID fields that users might actually reference: `Order Number`, `Invoice Number`, `Employee ID`
- Duplicate fields: same data in multiple tables — keep one, hide the rest
- Calculated/derived fields where purpose is unclear without context
- Fields in a language the user doesn't ask questions in

**⚠️ Structural red flags**
- Total visible field count > 100 → model is too noisy for optimal AI use
- Synthetic keys present → data model needs restructuring (flag, don't just hide)
- Multiple tables with overlapping field names → ambiguity risk for AI

### Scoring rubric

Classify each visible field:
- **Keep Visible** (business-relevant) = 1.0
- **Review** (unclear) = 0.5
- **Should be Hidden** (technical/noise, currently visible) = 0.0

**Layer 2 Score** = (fields correctly visible + fields already correctly hidden) / total fields × 100

Also report:
- **Signal-to-Noise Ratio**: count of business-meaningful visible fields / total visible fields
- **Recommended target**: reduce visible fields to ≤ 60 (flag if currently above this)

### Example output table

| Field Name | Current State | Recommendation | Category | Notes |
|------------|--------------|----------------|----------|-------|
| `CustomerID` | Visible | 🔴 Hide | Join key | Not asked about |
| `Order Number` | Visible | 🟠 Review | User-facing ID | Users may search by this |
| `Product Category` | Visible | 🟢 Keep | Dimension | Business-relevant |
| `$Syn 1` | Visible | 🔴 Hide | Synthetic key | Model issue — flag separately |

---

## Layer 3 — Field Groups (Logical Model)

**Tools:** `qlik_list_dimensions` (to see existing groups/Master Dimensions), `qlik_get_fields`

Check for:
- Fields that exist but have NO group assignment → **CRITICAL: Qlik Answers cannot see them**
- Master Items (Measures/Dimensions) without a group → **never detected by Answers**
- Whether "Logic Disabled" flag might be set (warn user to check manually)

⚠️ **Key rule from Turan**: An ungrouped Master Item will NEVER be recognized by Qlik Answers. This is the #1 optimization priority.

### Classification

**🔴 Critical: Ungrouped Master Items**
- Master Measures with no group → completely invisible to Qlik Answers
- Master Dimensions with no group → completely invisible to Qlik Answers
- This is the single highest-impact issue in the entire assessment

**🟠 Warning: Missing groups for business fields**
- Business-relevant fields that should be Master Items but aren't (and therefore have no group)
- Groups that exist but are poorly named (e.g., "Group1", "Misc")
- Fields assigned to the wrong group (e.g., a date field in a "Customer" group)

**🟡 Optimization: Group structure quality**
- Too many groups (>15) → dilutes semantic clarity
- Too few groups (1-2 catch-all groups) → doesn't help AI navigate the model
- Inconsistent granularity (one group per field vs one group for 30 fields)

**⚠️ Blocking check: Logic Disabled**
- If "Logic Disabled" is set in the Logical Model → ALL Master Items are invisible regardless of grouping. Warn user to check this in the Qlik Hub UI (cannot be detected via MCP).

### Scoring rubric

| Check | Weight | Scoring |
|-------|--------|---------|
| % of Master Items with group assignment | 60% | All=1.0, >80%=0.7, 50-80%=0.4, <50%=0.0 |
| Group naming quality (descriptive, consistent) | 20% | Good=1.0, Mixed=0.5, Poor/generic=0.2 |
| Group structure (appropriate count, logical groupings) | 20% | Well-structured=1.0, Acceptable=0.6, Chaotic=0.2 |

**Layer 3 Score** = weighted sum × 100

### Example output table

| Master Item | Type | Group | Status | Action |
|-------------|------|-------|--------|--------|
| `Net Revenue` | Measure | Sales | ✅ Grouped | — |
| `Customer Name` | Dimension | *(none)* | 🔴 Ungrouped | Assign to "Customer" group |
| `Margin %` | Measure | Misc | 🟠 Poorly grouped | Rename group or reassign to "Financial KPIs" |

---

## Layer 4 — Master Items + Descriptions

**Tools:** `qlik_list_measures`, `qlik_list_dimensions`

Master Items are how Qlik Answers selects the right metric. The description is the AI's primary signal — not the expression.

### Special case: App has ZERO Master Items

If `qlik_list_measures` and `qlik_list_dimensions` both return empty:

1. **Score Layer 4 as 0%**
2. **Shift to a creation workflow**:
   - Analyze fields from Layers 1/2 to identify likely business measures and dimensions
   - Propose a starter set of 10-15 Master Items (5-8 measures, 5-7 dimensions)
   - For each: include name, expression, description (rich format), and suggested group
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

**D. Group assignment:** Cross-reference with Layer 3.

### Scoring rubric

| Sub-dimension | Weight | Scoring |
|---------------|--------|---------|
| Description quality | 40% | Missing=0.0, Minimal=0.4, Rich=1.0 |
| Expression complexity | 35% | Simple=1.0, Moderate=0.5, High=0.2 |
| Group assigned | 25% | Yes=1.0, No=0.0 |

**Layer 4 Score** = weighted average across all Master Items × 100

### Example output table

| Master Item | Type | Description | Expression Complexity | Group | Score | Optimization |
|-------------|------|-------------|----------------------|-------|-------|-------------|
| `Net Revenue` | Measure | 🟢 Rich | 🟢 Simple: `Sum(Revenue)-Sum(Returns)` | ✅ Yes | 95% | Fully optimized |
| `Margin %` | Measure | 🟠 Minimal | 🔴 High: `$(vMarginCalc)` with 4 nested vars | ✅ Yes | 35% | Enrich description, consider inlining |
| `Customer` | Dimension | 🔴 Missing | 🟢 Simple: `CustomerName` | ❌ No | 25% | Add description, assign group |

---

## Layer 5 — Date Fields + AutoCalendar

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

**Layer 5 Score** = weighted sum × 100

### Example output table

| Field Name | Loaded As | Expected Type | AutoCalendar | Issue | Action |
|------------|-----------|--------------|--------------|-------|--------|
| `OrderDate` | Date | Date | ✅ Yes | None | — |
| `ShipDT` | String | Date | ❌ No | String date | Convert + add to calendar |
| `20240315` (InvoiceDate) | Integer | Date | ❌ No | Numeric date | `Date#()` conversion |

---

## Layer 6 — Synonyms / Vocabulary

**Tools:** `qlik_list_dimensions`, `qlik_list_measures` (check for synonyms/tags)

### Assessment dimensions

**A. Master Item synonym coverage**
- Do Master Measures/Dimensions have synonyms/tags defined?
- What % of Master Items have at least one synonym?

**B. Business jargon mapping**
- Industry-specific terms that differ from field/measure names?
- Internal company terms or abbreviations?
- Acronyms that don't match field names?

**C. Multilingual coverage** (if applicable)
- App used by people who ask questions in different languages?
- Synonyms defined in all relevant languages?
- Field names in one language but users ask in another?

### Prioritization guidance

1. **High-frequency measures** (Revenue, Cost, Margin, Count) — most varied language
2. **Ambiguous dimensions** (Status, Type, Category) — could mean different things
3. **Metrics with known alternative names** — ask the user: "What do your teams actually call these?"

### Scoring rubric

| Check | Weight | Scoring |
|-------|--------|---------|
| % of Master Items with ≥1 synonym | 50% | >80%=1.0, 50-80%=0.7, 20-50%=0.4, <20%=0.0 |
| Business jargon mapped | 30% | Comprehensive=1.0, Partial=0.5, None=0.0 |
| Multilingual coverage (if applicable) | 20% | Covered=1.0, N/A=1.0, Missing=0.0 |

**Layer 6 Score** = weighted sum × 100

### Example output table

| Master Item | Has Synonyms? | Current Synonyms | Suggested Additions |
|-------------|--------------|-----------------|-------------------|
| `Net Revenue` | ✅ Yes | "Net Sales" | + "Turnover", "NR", "Nettoumsatz" |
| `Product Category` | ❌ No | — | "Product Group", "Produktgruppe", "Category" |
| `Order Count` | ❌ No | — | "Number of Orders", "Bestellungen", "# Orders" |

---

## Bonus Check: Sheet Structure (non-scored, advisory)

**Tool:** `qlik_describe_app` (check sheet count and names)

This does NOT affect the AI Readiness Score. Quick signal check:

- **Does the app have sheets?** Zero sheets → may be a data-only backend
- **Are sheets named descriptively?** ("Sales Overview") vs. generic ("Sheet 1")
- **Sheet count sanity**: >20 sheets may indicate scope creep

If sheet names are generic, mention as a quick win. Do NOT block the assessment for sheet issues.
