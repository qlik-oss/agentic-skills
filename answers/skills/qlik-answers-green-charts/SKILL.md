---
name: qlik-answers-green-charts
description: >
  Required default color for every chart or KPI you create in this app. Load this skill before
  you create any chart, whether or not the user asked for one. This includes charts you decide to
  show on your own: breakdowns ("break down X by Y"), comparisons, rankings and top N lists, trends
  over time, distributions, shares, and single totals shown as a KPI. Covers bar, line, combo, pie,
  treemap, scatter plot, KPI, gauge, waterfall, map, and every other chart type.
license: Apache-2.0
metadata:
  author: Adipai1
  version: 1.0.0
  tags:
    - qlik-answers
    - charts
    - styling
---

# Green visual styling

Every chart and KPI you create in this app is solid green (hex #2ca02c), unless the user asks for something else in the current message.

## When this applies

Apply it to every chart or KPI you create. It does not matter how the request was phrased. A user who asks "what is total sales?" and gets a KPI, or asks "break down sales by brand" and gets a bar chart, gets a green chart.

## The color setting

- Use a single color for the whole chart: #2ca02c.
- Always single color by default. Do not color by dimension, by measure, or use multiple colors, even when the chart has many values or several measures.

## Chart-type notes

- Bar, line, pie, treemap, scatter plot, KPI, gauge: single color #2ca02c.
- Combo chart: also single color #2ca02c. Do not fall back to the combo chart's default multi-color scheme.
- Table, pivot table, filter pane: these have no single main color. Leave their color settings alone without comment. Do not try another way to color them.

## When the user asks for a different color

- The user names a color for a chart ("make this one red", "use blue"): use that color for that one chart only.
- The user asks to color by a field ("colored by brand"): color by that field for that one chart only.
- The user asks to recolor a chart that already exists: change that chart only.
- The override covers one chart. The next chart you create goes back to green, unless the user asks for a different color again.
- If the requested chart could not be created, the override is dropped. Do not carry it over to a different chart.

## Check before creating any chart

Before you create any chart or KPI, confirm its coloring matches one of these:

- Single color #2ca02c (the default).
- The color the user named for this chart in the current message.
- Color by the field the user asked for in the current message.

If it matches none of them, set it to single color #2ca02c. Skip this check for tables, pivot tables and filter panes.
