# Implementation Guide — Qlik AI Readiness Optimizer

Detailed per-layer implementation steps, output templates, and copy-paste script snippets for Phase 5: IMPLEMENT. Referenced from the main [SKILL.md](../SKILL.md).

---

## Layer 1 — Field Naming

```
Action: Generate renamed field mapping + suggest load script changes
Tool: qlik_get_fields → generate AS aliases for the load script
Note: Load script cannot be directly updated via MCP (must be done manually).
```

### Output to provide

1. A rename mapping table (current name → recommended name) for all non-Good fields
2. A ready-to-paste load script snippet using `AS` aliases:
   ```
   LOAD
     CUST_NM   AS [Customer Name],
     ORD_AMT   AS [Order Amount],
     DT        AS [Order Date]
   FROM ...
   ```
3. For 🔴 Opaque fields where meaning cannot be inferred: flag them and ask the user to provide the business meaning before suggesting a rename
4. A consistency recommendation: propose a single naming convention (Title Case with spaces) and flag all deviations

---

## Layer 2 — Field Visibility

```
Action: Identify fields to hide and generate load script modifications
Tool: qlik_get_fields → classify each field → generate % prefix recommendations
Note: MCP cannot change field visibility directly. Requires load script or Logical Model UI.
```

### Output to provide

1. A classified field table (Keep / Hide / Review) with reasoning for each
2. A ready-to-paste load script snippet with `%` prefix for all Hide-recommended fields:
   ```
   LOAD
     CustomerID    AS [%CustomerID],
     OrderKey      AS [%OrderKey],
     LoadTimestamp AS [%LoadTimestamp],
     [Customer Name],
     [Order Date],
     [Sales Amount]
   FROM ...
   ```
3. For 🟠 Review fields: present them to the user with context and ask for a decision before classifying
4. A signal-to-noise summary: "Currently X visible fields → recommend reducing to Y by hiding Z fields"
5. If synthetic keys are detected: flag as a separate data model issue — hiding them is a band-aid, not a fix

---

## Layer 3 — Field Groups

```
Action: Create groups and assign fields/Master Items
Tools: qlik_create_dimension (with group tag), qlik_update_dimension, qlik_update_measure,
       qlik_list_measures, qlik_list_dimensions
Note: Group assignment is done by tagging Master Items when creating or updating them.
New Master Items can be created with groups via MCP (qlik_create_measure/qlik_create_dimension).
Existing Master Items can also be regrouped directly via MCP using qlik_update_measure /
qlik_update_dimension — no UI editing required.

Every proposed Master Item must include a group — an ungrouped new item recreates the
Layer 3 failure mode (Key Rule #1), whether it's newly created or being regrouped.
```

---

## Layer 4 — Master Items + Descriptions

```
Action: Optimize Master Items with semantic descriptions; assess expression complexity
Tools: qlik_create_measure, qlik_create_dimension, qlik_update_measure, qlik_update_dimension,
       qlik_list_measures, qlik_list_dimensions
```

### Output to provide

1. A Master Item optimization report showing each item's description quality, expression complexity, and group status
2. For items with 🔴 Missing or 🟠 Minimal descriptions: generate rich descriptions following the template:
   `"[Metric Name]: [What it calculates]. [What it excludes]. [When to use vs. similar metrics]. Also known as: [synonyms]."`
   Apply the improved description to the existing item directly via `qlik_update_measure`/`qlik_update_dimension` — no need to recreate it as a new Master Item.
3. For items with 🔴 High complexity expressions (especially heavy variable density):
   - Identify which expressions have the highest variable density and recommend enriching descriptions to explain the full resolved computation
   - For highest-impact Master Items: suggest simplified/inlined expression alternatives where feasible
   - For expressions where variables serve dynamic behavior (and inlining isn't practical): ensure the description compensates by clearly explaining the business logic

⚠️ **Variable resolution limitation**: MCP cannot retrieve variable definitions from the app. If you recommend inlining a variable-heavy expression and the user wants you to create the inlined version via `qlik_create_measure`, you'll need the user to provide the resolved variable values. Ask explicitly: "I can see this expression uses `$(vMarginCalc)` — what does that variable resolve to? I need the full expression to create the inlined version."

4. For items without groups: recommend group assignment (cross-reference Layer 3)
5. For missing Master Items (key metrics not yet created): propose new Master Items with expression, description, and group — present for user approval before creating via MCP

---

## Layer 5 — Date Fields

```
Action: Generate corrected load script date transformations
Tool: qlik_get_fields → identify date fields → generate conversion patterns
Note: Must be applied manually in the load script editor.
```

### Output to provide

1. A date field audit table showing each date field's current type, expected type, and whether it's connected to AutoCalendar
2. For string/numeric date fields: ready-to-paste conversion snippets:
   ```
   // String date → proper Date type
   Date(Date#(ShipDT, 'YYYY-MM-DD'), 'DD/MM/YYYY') AS [Ship Date]

   // Numeric date → proper Date type
   Date(Date#(Text(InvoiceDate), 'YYYYMMDD'), 'DD/MM/YYYY') AS [Invoice Date]
   ```
3. If no AutoCalendar or Calendar table exists: provide a Master Calendar template:
   ```
   // Master Calendar template
   LET vMinDate = Peek('MinDate', 0, 'DateRange');
   LET vMaxDate = Peek('MaxDate', 0, 'DateRange');

   Calendar:
   LOAD
     TempDate AS [Date],
     Year(TempDate) AS [Year],
     Month(TempDate) AS [Month],
     Num(Month(TempDate)) AS [Month Number],
     Quarter(TempDate) AS [Quarter],
     Year(TempDate) & '-' & Num(Month(TempDate), '00') AS [YearMonth],
     Week(TempDate) AS [Week]
   ;
   LOAD
     Date('$(vMinDate)' + IterNo() - 1) AS TempDate
   AutoGenerate 1
   While '$(vMinDate)' + IterNo() - 1 <= '$(vMaxDate)';
   ```
4. If fiscal year applies: recommend fiscal year/quarter fields and ask user for fiscal year start month
5. Flag any relative date logic with high variable density — same remediation as Layer 4

---

## Layer 6 — Synonyms

```
Action: Generate synonym mappings and vocabulary import file
Tools: qlik_list_measures, qlik_list_dimensions → generate synonym recommendations
Note: Synonym/vocabulary upload is done via Qlik Answers admin UI, not via MCP.
```

### Output to provide

1. A synonym recommendation table for all Master Items, prioritized by frequency/impact
2. A downloadable CSV file matching the Qlik Answers vocabulary import format:
   ```csv
   Term,Synonym,Language
   Net Revenue,Turnover,en
   Net Revenue,Net Sales,en
   Net Revenue,NR,en
   Net Revenue,Nettoumsatz,de
   Product Category,Product Group,en
   Product Category,Produktgruppe,de
   ```
3. For multilingual apps: synonym sets in each relevant language
4. A prompt to the user: "What terms do your teams actually use for these metrics? I've suggested common alternatives but your internal vocabulary may differ."
5. Prioritization guidance: focus synonyms on the top 10-15 most-queried measures/dimensions first — diminishing returns after that
