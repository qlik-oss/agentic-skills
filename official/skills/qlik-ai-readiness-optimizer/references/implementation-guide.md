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

1. A classified field table (Keep / Hide / Review) with reasoning for each field group
2. A ready-to-paste load script snippet with `%` prefix for **confirmed Hide fields only** (never include ID/key fields here unless the user has confirmed they are not used in any counts or aggregations), e.g.:
   ```
   LOAD
     LoadTimestamp AS [%LoadTimestamp],
     SourceSystem  AS [%SourceSystem],
     [Customer Name],
     [Order Date],
     [Sales Amount]
   FROM ...
   ```
3. For ID / Key fields: always present as a **separate "Review" group** with this exact framing:
   *"Review these ID and key fields to ensure they are relevant for counts, distinct counts, or aggregations (e.g. `Count(Distinct CustomerID)`). If they are not used in any measures or counts, you can hide them. If they are used, keep them visible."*
   **Never describe ID/key fields as "no business value", "surrogate keys", "ETL noise", or any other language that implies they are irrelevant.** They are analytically relevant until confirmed otherwise.
4. For other 🟠 Review fields: present them to the user with context and ask for a decision before classifying
5. A signal-to-noise summary: "Currently X visible fields → recommend reducing to Y by hiding Z fields"
6. If synthetic keys are detected: flag as a separate data model issue — hiding them is a band-aid, not a fix; it's better to migrate them to concatenated keys if they are used

---

## Layer 3 — Master Items + Descriptions

```
Action: Optimize Master Items with semantic descriptions; assess expression complexity
Tools: qlik_create_measure, qlik_create_dimension, qlik_update_measure, qlik_update_dimension,
       qlik_list_measures, qlik_list_dimensions
Note: None of these tools read or accept a group/grouping parameter. Group assignment
cannot be queried or set via MCP, at creation time or afterward — it is a Logical Model
UI-only action. Never imply a group was set because a Master Item was created or updated
via MCP.
```

### Output to provide

1. A Master Item optimization report showing each item's description quality and expression complexity
2. For items with 🔴 Missing or 🟠 Minimal descriptions: generate rich descriptions following the template:
   `"[Metric Name]: [What it calculates]. [What it excludes]. [When to use vs. similar metrics]. Also known as: [synonyms]."`
   Apply the improved description to the existing item directly via `qlik_update_measure`/`qlik_update_dimension` — no need to recreate it as a new Master Item.
3. For items with 🔴 High complexity expressions (especially heavy variable density):
   - Identify which expressions have the highest variable density and recommend enriching descriptions to explain the full resolved computation
   - For highest-impact Master Items: suggest simplified/inlined expression alternatives where feasible
   - For expressions where variables serve dynamic behavior (and inlining isn't practical): ensure the description compensates by clearly explaining the business logic

⚠️ **Variable resolution limitation**: MCP cannot retrieve variable definitions from the app. If you recommend inlining a variable-heavy expression and the user wants you to create the inlined version via `qlik_create_measure`, you'll need the user to provide the resolved variable values. Ask explicitly: "I can see this expression uses `$(vMarginCalc)` — what does that variable resolve to? I need the full expression to create the inlined version."

4. **Group assignment (manual step, every time)**: for every item you create or edit, remind the user to confirm/assign its group in the Logical Model UI afterward — MCP cannot do this and cannot verify it was already done. Word it explicitly: "I've created/updated '[name]', but I can't see or set its group from here — please confirm it's assigned to a group in the Logical Model, or Qlik Answers won't surface it."
5. For missing Master Items (key metrics not yet created): propose new Master Items with expression and description — present for user approval before creating via MCP, then apply the same group reminder as step 4
6. **Optional: Linked Glossary Term Alignment** (only if Phase 1, Step 2 confirmed linked Glossary
   Terms and an export was retrieved): present the alignment table from
   [references/layer-analysis-guide.md](layer-analysis-guide.md) Layer 3. For every 🔴 Conflicting
   pair, use the exact guidance wording from that section and ask the user to review — do not
   silently resolve it yourself. If the user asks you to update the term (or the Master Item) to
   resolve the conflict, use `qlik_update_glossary_term` (`name`, `description` fields) with the
   `termId`/`glossaryId` captured during Phase 1 — confirm which side should change before editing
   either one. Include the Verified-status notice from the Layer 3 section of
   [references/layer-analysis-guide.md](layer-analysis-guide.md); if the user explicitly asks for
   the status of individual term(s), check each with `qlik_get_glossary_term` and alert them to
   any term not in 'Verified' status (Key Rule #17 — never sweep all terms unprompted).
7. **Optional: Link Opportunity execution** (only if the Layer 3 Link Opportunity Analysis
   produced candidates the user wants to act on): for each **user-confirmed** candidate, create
   the link via `qlik_create_glossary_term_links`, passing the term's `termId`/`glossaryId` from
   the Phase 1 mapping and the Master Item's resource reference. Work one candidate at a time —
   name the term and the Master Item, get an explicit yes, then create (Key Rule #18; never batch
   links through on a single blanket approval). After each link, remind the user that the term
   must be in 'Verified' status before Qlik Answers will use it — offer `qlik_update_term_status`
   guidance or point them to the glossary UI if the term is still Draft.

---

## Layer 4 — Date Fields

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
5. Flag any relative date logic with high variable density — same remediation as Layer 3

---

## Layer 5 — Synonyms (Optional Generation)

```
Action: Generate suggested synonym import file on user request
Tools: qlik_list_measures, qlik_list_dimensions → generate synonym suggestions
Note: MCP cannot read existing synonyms. MCP cannot write synonyms. Upload must be done via
Qlik Answers admin UI.
```

> ⚠️ Layer 5 is not scored. Only execute this step if the user has accepted the offer to generate a synonym file (see the Layer 5 report format in [references/layer-analysis-guide.md](layer-analysis-guide.md)).

### Output to provide (only if user accepts)

1. A synonym recommendation table for all Master Items, prioritized by frequency/impact
2. A downloadable synonym import file matching the Qlik Answers vocabulary import format, to these exact specifications:

   > ⛔ **This 6-column `.xlsx` layout is the ONLY correct format for the synonym import file, and it is authoritative.** Do NOT web-search Qlik's Vocabulary or admin-UI structure to determine the format. Do NOT substitute a different structure, and do NOT add, rename, reorder, or drop columns — even if external research or the live Qlik UI appears to suggest a "more precise" layout. Qlik Answers Vocabulary supports bulk import in exactly this format. If you believe this spec conflicts with current Qlik functionality, **flag the conflict to the user and ask before changing anything** — never silently swap the format. Re-read this spec in the same turn you generate the file; do not build it from memory (see [SKILL.md](../SKILL.md) Phase 5 and Key Rule #19).

   **File Type:** `.xlsx`

   **Fields (exact column headers, in this order):**
   `Field | Locale | Terms | Condition Type | Condition Values | Master Item`

   **Field Definitions:**
   - **Field**: Name of the field or Master Item, exactly as it appears in the app
   - **Locale**: The two-letter language code only (the code to the left of the colon below):
     - `en`: English
     - `de`: German
     - `es`: Spanish
     - `fr`: French
     - `it`: Italian
     - `ja`: Japanese
     - `nl`: Dutch
     - `pl`: Polish
     - `pt`: Portuguese
     - `ru`: Russian
     - `sv`: Swedish
   - **Terms**: The terms for the synonym. Separate multiple terms with `||` (e.g., `clients||customers||users`)
   - **Condition Type**: BLANK — this functionality is not yet supported by Answers
   - **Condition Values**: BLANK — this functionality is not yet supported by Answers
   - **Master Item**: If the field is a Master Item, enter `True`; leave empty otherwise

   **Additional Specs:**
   - Multiple terms for a single field/Master Item must be delimited using double pipes (`||`) in one `Terms` cell — never multiple rows for the same Field + Locale
   - A unique row must exist for each Field + Locale combination

   Attempt to generate the file as an XLSX using openpyxl or equivalent. If XLSX generation is not possible in the current environment, generate a CSV instead and inform the user: *"I was unable to generate an XLSX file directly. Please download this CSV, convert it to XLSX (e.g., open in Excel and Save As .xlsx), then import it via the Qlik Answers Vocabulary section in the app settings."*
3. For multilingual apps: include a separate row per Field + Locale combination, covering all relevant languages
4. A prompt to the user: "What terms do your teams actually use for these metrics? I've suggested common alternatives but your internal vocabulary may differ."
5. Prioritization guidance: focus synonyms on the top 10-15 most-queried measures/dimensions first — diminishing returns after that
6. **Optional: Glossary Abbreviations as Synonyms** (only if Phase 1, Step 2 confirmed linked
   Glossary Terms and an export was retrieved): present the Master Item / Abbreviation table from
   [references/layer-analysis-guide.md](layer-analysis-guide.md) Layer 5, and deliver the "you
   don't need to add Synonyms directly" notice verbatim. Exclude any Master Item already covered
   by a defined Abbreviation from the synonym-file suggestions in step 2 above, so the same synonym
   isn't recommended twice through two different mechanisms. Include the Verified-status notice
   from the Layer 5 section of [references/layer-analysis-guide.md](layer-analysis-guide.md);
   status checks for individual terms via `qlik_get_glossary_term` only on explicit user request
   (Key Rule #17).
7. **Optional: Missing Abbreviation execution** (only if the Layer 5 Missing Abbreviation
   Analysis produced proposals the user accepted): for each **approved** term, apply the
   abbreviations via `qlik_update_glossary_term` with the `abbreviation` field, using the
   `termId`/`glossaryId` captured during Phase 1. Formatting and safety rules:
   - **Multiple synonyms are delimited using a comma** in the single `abbreviation` value, e.g.
     `Lead Time, Fulfillment Time`.
   - ⚠️ `abbreviation` is a single overwrite field. If the term already has a value (check the
     Phase 1 export first), merge the approved additions into the existing comma-delimited list —
     never clobber what's already there.
   - Get approval per term (or for an explicitly approved batch the user has seen in full) before
     writing (Key Rule #18), and confirm afterward which terms were updated.
   - Remind the user the term must be in 'Verified' status for the abbreviations to act as
     synonyms in Qlik Answers.