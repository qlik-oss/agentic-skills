# Sheets and visualizations as governed content

A single published chart can carry a whole composite analysis: a complex
indicator alongside the components that explain it, a comparison already laid
out, a per-entity table combining attributes that live in different master
items. Reading one is the shortest safe path to an answer, and the way to avoid
rebuilding component by component what the app already publishes.

## Published is the line

**Only a published sheet counts as governed content.**

A private sheet can hold governed objects, and nothing in this tool set tells
them apart from an ad-hoc chart. Publication is the only signal available:

- Never compute an answer from a private sheet's charts.
- If one appears to address the question and nothing published does, that is a
  *"nothing governed covers this"* outcome. Saying "an unpublished sheet
  appears to cover this, ask its owner" is a useful pointer; presenting its
  figures is not.
- `published` comes back on `qlik_list_sheets` and `qlik_get_sheet_details`,
  so this costs no extra call.

## Building the Sheet & Chart Inventory

Once per app per session, alongside the Master Item Catalogue. One
`qlik_get_sheet_details` call per published sheet returns everything needed:

| What it returns | Why it matters |
|---|---|
| Sheet `title`, `description`, `subtitle`, `footnote` | The sheet's own stated purpose, when the author filled it in. |
| Per chart: resolved `type` | `auto-chart` resolves to the real type (`barchart`, `kpi`, `linechart`, table…), so a KPI tile is distinguishable from a trend. |
| Per chart: `title`, `subtitle`, `footnote` | The standard documentation slots. See below — they are guidance, not labels. |
| Per chart: grid position | Charts sitting together were meant to be read together. |
| Container children | A filter pane returns its listboxes with their labels — a free map of the filtering axes the author intended. |

Hold it for the session. Don't re-list sheets because a new question came in.

## Subtitle and footnote are governed guidance, not decoration

A chart's footnote is where an author writes the caveat that does not fit in
the title — the condition under which the chart reads correctly, what a
selection does to it, what it deliberately excludes.

Treat these exactly like a master item `description`: read them when the chart
is mobilized, and carry the caveat into the answer whenever it changes how the
figure should be read — in production mode too, as a plain sentence.

A title can also be dynamic, computed from an expression. When it names the
scope or period the chart is currently showing, that text is a live statement
about the reading, not a static label — it is worth reporting.

## What `qlik_get_chart_info` can and cannot tell you

| Element | What comes back |
|---|---|
| Dimension | `name` — the field, or the inline expression itself — plus `label`, plus `libraryId` when it is a master dimension. **Never opaque.** |
| Measure | `label`, and `libraryId` **only when it is a master measure**. The `expression` field comes back empty either way. |

So the asymmetry that matters: **an inline measure is opaque.** When a
measure's `libraryId` is null, you have its label and nothing else — no way to
know what it computes, which fields it touches, or whether it neutralizes
selections.

**The consequence is about provenance, not about refusing to read the chart.**
A published chart is governed content regardless of how its measures are
written. But a figure taken from an inline measure cannot be attributed to a
governed definition:

- Say it came from the chart, named — not from a governed measure.
- Don't claim a glossary term backs it. A term links to master items; an
  inline measure has no link to anything.
- If the question turns on precisely what the number includes, say that the
  chart's own definition isn't exposed through this tool set, rather than
  inferring it from the label.

## Master visualizations are out of scope

No MCP tool lists them or exposes their description pane, and no glossary link
reaches one. **Don't reach for one and don't go looking.** Placed on a sheet, such
an item reads as any other chart — so never tell a user a visualization has no
description: it may have one this tool set cannot see.

## Governed content can name the chart to use

A glossary term, category or overview sometimes names the dashboard, sheet or
chart that carries a concept — as the preferred route to it, as an accelerator,
or as context around the concept. **Treat it as it reads**: where it names a
source, prefer that one over rediscovering another; where it adds context, read
it before answering. Confirm the object exists and is published first — a
governed pointer does not make an unpublished sheet usable. Mechanics in
[glossary-guidance.md](glossary-guidance.md#resolving-relations-and-pointers).

## Elsewhere

A composite chart outranking the master items behind it, and the two checks
before relying on one:
[governed-source-mechanics.md](governed-source-mechanics.md#when-one-question-spans-several-governed-concepts).
Narrowing a chart with a selection:
[selections-and-search.md](selections-and-search.md).
