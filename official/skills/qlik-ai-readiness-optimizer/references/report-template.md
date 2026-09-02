# Phase 3 Report Template — Qlik AI Readiness Optimizer

**This file is the single authoritative layout for the Phase 3: PRESENT deliverable.** Every AI Readiness report the skill produces must reproduce this skeleton exactly — same sections, same order, the summary/contribution table, the locked per-layer `Significance:` lines, and the closing question. Nothing is added, reordered, or omitted (Key Rule #20).

Division of labor with the other reference files:
- **This file** governs how the report is *presented* (structure, headings, section order, fixed wording).
- [layer-analysis-guide.md](layer-analysis-guide.md) governs how findings are *classified and scored* (severity tiers, rubrics, thresholds) and supplies the glossary sub-layer tables/notices inserted below.

⛔ **Re-read this file in the same turn you generate the report** — even if you read it earlier in the conversation. Do not rebuild the layout from memory once other material (web results, the live Qlik UI, an earlier draft) has entered the conversation. This template is authoritative; external research never overrides it (Key Rule #19).

🌐 **Language:** Speak in the user's language (detect from their messages). When operating in another language, translate the locked `Significance:` sentences, headings, and the closing question **faithfully** — do not drop them, shorten them, or re-author their meaning. The structure below is fixed regardless of language.

Placeholders in `[brackets]` are filled per app. Everything else is fixed.

---

## Report skeleton (in this exact order)

1. Overall score heading
2. One-line italic overall summary
3. Score summary table (with Contribution + Overall row)
4. `---` divider
5. Layer 1 section
6. Layer 2 section
7. Layer 3 section
8. Layer 4 section
9. Layer 5 section (always shown; not scored)
10. `---` divider
11. Optimization Roadmap table
12. Closing question

---

### 1–3. Header, summary, and score table

```
# AI Readiness Score: **[overall %]**

*[One-sentence overall AI Readiness summary — plain-language verdict for this app.]*

| Layer | Score | Weight | Contribution |
|---|---|---|---|
| 1 — Field Naming | [n]% | 20% | [Score × Weight] |
| 2 — Field Visibility | [n]% | 20% | [Score × Weight] |
| 3 — Master Items | [n]% | 45% | [Score × Weight] |
| 4 — Dates + AutoCalendar | [n]% | 15% | [Score × Weight] |
| **Overall** | | | **[weighted sum]% ≈ [rounded]%** |
```

Rules for the table:
- Exact columns, in this order: `Layer | Score | Weight | Contribution`.
- **Contribution = Score × Weight** for each layer (e.g. 88% × 20% = 17.6). Show one decimal.
- The **Overall** row is bold, leaves Score and Weight blank, and shows the weighted sum followed by `≈` and the rounded whole-percent (e.g. `77.9% ≈ 78%`). The rounded value must match the `# AI Readiness Score` heading.
- Weights are fixed (20/20/45/15) and always total 100%. Layer 5 is **never** a row in this table — it is not scored.

Then a `---` divider before the layer sections.

---

## 4–9. Per-layer sections

Every layer section uses a level-2 heading with the score in the heading, followed immediately by its locked `Significance:` line, then the layer's findings. Use `##` for **all five** layers (do not mix heading levels).

Each `Significance:` sentence below is **locked canonical wording** — reproduce it verbatim (translated faithfully when working in another language). It does not change per app.

### Layer 1 section

```
## Layer 1 — Field Naming ([n]%)

Significance: Qlik Answers and LLMs will utilize field names to derive the appropriate dimensions and measures to utilize when responding to questions. Ambiguous or generic field names will confuse AI and ultimately produce unreliable answers.

[One-line naming overview, e.g. "Mostly clean Title Case naming. Issues:"]

| Field(s) | Severity | Note |
|---|---|---|
| `[field or grouped fields]` | [🔴 Opaque / 🟠 Ambiguous / 🟡 Inconsistent] | [Why] |
| Everything else ([N] fields) | ✅ Good | [Convention that is fine] |
```

Table notes: group related fields onto one row where it aids readability (as the example does). Severity emoji/labels follow [layer-analysis-guide.md](layer-analysis-guide.md) Layer 1. A trailing `✅ Good` row summarizing the compliant remainder is expected.

### Layer 2 section

```
## Layer 2 — Field Visibility ([n]%)

Significance: a large volume of fields can create noise for AI. Ensure that you are only including fields that are relevant to answering business questions and remove any fields that may have been used in processing or transforming data or any fields purely used for a technical purpose (example record counts used for logging purposes).

[Field-count sentence placing the app on the ≤60 ideal / 61–200 noisy / >200 structural ladder, then the main drivers as a bulleted list.]

- **[Driver]** — [what and why]
- **[Driver]** — [what and why]
```

Layer 2 findings read as a short narrative + bullets (as the example does), not necessarily a table. ID/key fields must use the neutral 🟠 Review framing from [layer-analysis-guide.md](layer-analysis-guide.md) Layer 2 — never "no business value" / "ETL noise."

### Layer 3 section

```
## Layer 3 — Master Items + Descriptions ([n]%)

Significance: Master Items are extremely important for consistent and accurate use of your data by Answers and LLMs with MCP. It's important to have a comprehensive library of Master Items with rich descriptions that provide AI with an understanding of how to use the item and its purpose. Please refer to [Qlik Help's](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikAnswers/best-practices-for-descriptions.htm) guidance on how to write master item descriptions for Answers.

[One-line framing of the Master Item picture.]

| Master Item | Type | Description | Expression | Score |
|---|---|---|---|---|
| `[name]` | [Measure/Dimension] | [🟢 Rich / 🟠 Minimal / 🔴 Missing] | [🟢 Simple / 🟠 Moderate / 🔴 High / 🔴 C2 flag] | [n]% |

**Coverage gap**: [dimensions/measures the app is missing that users will likely ask about].

**Group assignment** — can't be checked via MCP. For each of the [N] items above: *does it have a group assigned in the Logical Model?* If not, Qlik Answers will never surface it regardless of description quality.
```

The `Master Item | Type | Description | Expression | Score` columns and the two bold callouts (**Coverage gap**, **Group assignment**) are required. Description/Expression severity and per-item scoring follow [layer-analysis-guide.md](layer-analysis-guide.md) Layer 3 (including the C2 set-identifier rule).

**Glossary sub-layer insertion (Layer 3)** — only when the Phase 1 glossary mapping is active (linkage confirmed + export retrieved). Insert *within this section*, after the Master Item table:
- the Linked Glossary Term Alignment table,
- the Link Opportunity Analysis table (if candidates found),
- the mandatory Verified-status notice.

Use the exact tables and notice wording from [layer-analysis-guide.md](layer-analysis-guide.md) Layer 3 — do not re-author them. When inactive, omit entirely (do not show 0%/N/A).

### Layer 4 section

```
## Layer 4 — Dates + AutoCalendar ([n]%)

Significance: It's extremely important to have comprehensive calendars defined within your data models to provide context to AI on how your organization defines time periods and key definitions for temporal analysis.

[Findings: date typing, AutoCalendar/derivatives, fiscal handling, relative-date fields. Use the audit table from layer-analysis-guide.md Layer 4 when there are issues; a short "best-in-class — no action needed" narrative is fine at 100%.]
```

### Layer 5 section (always shown — not scored)

```
## Layer 5 — Synonyms (not scored)

Significance: Synonyms provide Answers and LLMs using MCP with additional business context to cover variations in terminology across your business/organization.

MCP can't read existing vocabulary. I can generate a suggested synonym import file from your [N] measures/[N] dimensions whenever you'd like.
```

Layer 5 is always present as its own section with the locked Significance line, but it is never scored and never appears in the summary table. Always end it with the synonym-file offer (as above).

**Glossary sub-layer insertion (Layer 5)** — only when the Phase 1 glossary mapping is active. Insert *within this section*: the `Master Item | Type | Abbreviations(Synonyms)` table, the Missing Abbreviation Analysis proposals, the "you don't need to duplicate abbreviations as app-level synonyms" notice, and the Verified-status notice — all using the exact wording from [layer-analysis-guide.md](layer-analysis-guide.md) Layer 5. When inactive, omit entirely.

Then a `---` divider before the roadmap.

---

## 10–11. Optimization Roadmap

```
## Optimization Roadmap

| Priority | Layer | Action | MCP Automatable? | Effort |
|---|---|---|---|---|
| [🔴 High / 🟠 Medium / 🟡 Low / 🟡 Enhancement] | [N] | [Concrete action] | [✅ Yes / ❌ Manual (where)] | [Low/Medium/High] |
```

Rules:
- Exact columns, in this order: `Priority | Layer | Action | MCP Automatable? | Effort`.
- Order rows by priority (🔴 High first).
- `MCP Automatable?` states ✅ Yes or ❌ Manual, and when manual, where the work happens (e.g. "Manual (load script `%` prefix or Logical Model)").
- When the Glossary sub-layers are active and produced candidates, include their required rows: **"Link [N] Glossary Terms to Master Items"** (from Layer 3 Link Opportunity Analysis) and **"Add Abbreviations to [N] linked Glossary Terms"** (from Layer 5 Missing Abbreviation Analysis) — both MCP-automatable, interactive.

---

## 12. Closing question

End every report with this fixed call-to-action (translate faithfully in other languages, keep the three options and the recommended default):

```
Would you like to **optimize all layers**, **pick specific layers**, or **start with Layer 3** (highest impact — recommended)?
```

This maps to the Phase 4 CONFIRM options. Do not replace it with a different sign-off or omit it.