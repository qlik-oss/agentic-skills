# Visualization Guidelines

Detail behind [`SKILL.md`](../SKILL.md)'s "Visualizing results" and "Offer a
one-page dashboard/report" sections. Read this before rendering a chart or
building a standalone report.

## Default to visual, not text

A wall of text or numbers is a worse answer than a chart whenever the data has a
shape — a trend, a comparison across categories, a distribution, a ranking.
If a tool call (`qlik_get_chart_data`, `qlik_create_data_object`, a dataset
profile) returns more than a couple of data points, render it rather than just
listing it in prose. Text is fine for a single number, a yes/no, or a
one-row lookup.

## Match the chart to the analytical task

| Task | Chart | Notes |
|---|---|---|
| Trend over time | Line | One line per series; don't exceed ~5-6 series before it becomes unreadable |
| Compare categories | Bar (vertical) | Sort by value, not alphabetically, unless the dimension is inherently ordered (months, age bands) |
| Ranking / top-N | Bar (horizontal) | Horizontal reads better once labels are long or the list exceeds ~8 items |
| Part-to-whole | Stacked bar / treemap | Avoid pie/donut beyond ~5 slices — comparing angles gets unreliable fast |
| Distribution | Histogram | Useful after `qlik_get_dataset_profile` to show what "outliers" actually means |
| Correlation between two measures | Scatter | Label both axes with units |
| Single KPI | Big-number / KPI tile | Pair with a trend arrow or sparkline if a prior period is available |
| Geography | Choropleth/map only if the app already has one | Otherwise a sorted bar by region is clearer than a improvised map |

## How to render, depending on the environment

- **If your environment supports inline visual output** (a rendered
  artifact, canvas, or image — e.g. Claude's Artifacts), build the chart
  there instead of only describing it in text. Keep it self-contained:
  inline CSS/JS/SVG, no external CDN or network calls — many sandboxed
  rendering surfaces block outbound requests, so a chart that depends on one
  will silently fail to render. Make it legible in both light and dark
  themes if the surface can switch between them.
- **If a chart-design or data-visualization skill is available in your
  environment** (a separate skill governing palette, layout, and chart
  hygiene), invoke it for the actual styling — don't improvise a palette or
  layout system from scratch when one already exists.
- **If no visual-rendering surface is available**, fall back to a clearly
  formatted markdown table: sorted meaningfully, rounded to sensible
  precision, units in the header row — and say plainly that this is a text
  fallback rather than silently under-delivering.
- **Reuse before rebuilding.** If `qlik_get_sheet_details` shows this exact
  cut of data already has a chart on a sheet in the app, pull it with
  `qlik_get_chart_data` and tell the user where it already lives, rather
  than only rendering a fresh one in chat. This is the same "governed answer
  before ad hoc one" discipline the rest of this skill applies to queries.

## Chart hygiene

- Aim for quick to scan, easily readable and comprehensible content. 
- Label axes with units — currency symbol, `%`, or the measure name; a bare
  number is ambiguous.
- Label data points on charts like scatterplots and show values on barcharts 
  and line charts whenever density allows.
- Sort meaningfully: rank order for comparisons/rankings, chronological for
  time series. Alphabetical sort is rarely the right default.
- Round to a precision the audience will actually use — don't show 4 decimal
  places on a currency KPI.
- Use one consistent color per series across every chart in the same answer
  or report; don't let the same series shift color between sections.
- Provide labelled chart legends whenever it would improve readability.
- Avoid 3D effects entirely — they distort the comparison the chart exists
  to make.

## Offering a one-page dashboard/report

Some questions are complex enough that answering them well requires several
charts and analyses stitched together — a multi-part ask, an "overview" or
"summarize" request, an executive-style question spanning more than one
metric or time period.

**Offer, don't assume.** When you recognize this shape, say so and ask
before building it: something like *"This touches four separate metrics —
would you like me to also put together a one-page HTML summary alongside the
inline answers?"* Building a standalone report is a bigger deliverable than
a normal chat answer, takes longer, and not every user wants one — so only
build it after they confirm. Never produce one as a side effect of answering
a simpler question, and never build it inside the Qlik app itself (that's a
different, separately-confirmed action — see "Confirm intent" in
[`governance-workflows.md`](governance-workflows.md) and `qlik_create_sheet`
in [`qlik-mcp-tool-reference.md`](qlik-mcp-tool-reference.md)).

**Once confirmed**, build a single self-contained HTML file:

- No external network calls — inline all CSS/JS/SVG, no CDN scripts or
  remote fonts/images. Sandboxed rendering surfaces typically block them,
  and a report that half-renders is worse than a plain-text answer.
- One section per sub-question or metric, each with its own chart(s) chosen
  from the table above.
- A short provenance line per section — same discipline as any other answer
  from this skill (see "Reporting with provenance" in `SKILL.md`): source,
  trust score if checked, freshness, owning app/space.
- Legible in both light and dark themes if the target surface supports a
  theme toggle.
- A summary/highlights section at the top if the report has more than
  ~3 sections — don't make the reader scroll through everything to find the
  headline number.
