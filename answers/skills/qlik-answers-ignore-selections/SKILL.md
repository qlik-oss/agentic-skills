---
name: qlik-answers-ignore-selections
description: >
  Rule for this app: every number, list, ranking and chart is calculated on the full data set,
  never on the user's current selections or filters in the app. Load this skill whenever you
  create a data object, run a calculation, or count, sum, average, rank, list, compare or chart
  anything, including direct questions such as "total", "how many", "top 5", "average" or
  "by month". Always-on rule: write every aggregation with the set identifier 1, for example
  Sum({1} Field) or Count({1<Field={'Value'}>} Field), with literal values only inside the set
  (no "=" expression searches), so current selections never change the result. Only filters stated
  in the question itself apply.
license: Apache-2.0
metadata:
  author: Adipai1
  version: 1.0.0
  tags:
    - qlik-answers
    - selections
    - set-analysis
---

# Ignore selections

Users of this app often leave selections active on their sheets. Those selections must not change any answer. Every answer is calculated over all the data in the app, plus only the filters the user states in the question.

## How to calculate

- Start every aggregation with the set identifier `1`. `1` means "all data, ignoring selections". This applies to every aggregation function: Sum, Count, Avg, Min, Max, Median, Only, Concat, FirstSortedValue, Fractile, Stdev and the rest.
  - `Sum(Amount)` becomes `Sum({1} Amount)`.
  - `Count(DISTINCT CustomerID)` becomes `Count({1} DISTINCT CustomerID)`.
  - `Avg(Score)` becomes `Avg({1} Score)`.
- Put filters from the question inside the same set expression, after the `1`:
  - "Sales for Germany" is `Sum({1<Country={'Germany'}>} Amount)`.
  - "Orders over 500" is `Count({1<Amount={">500"}>} OrderID)`.
  - "In 2025" uses the year field if the app has one, `{1<Year={2025}>}`, or a literal range on the date field written in that field's own format, such as `{1<OrderDate={">=01/01/2025<=31/12/2025"}>}`. Check the format with a field value lookup first.
- Never write a set expression without the leading `1`. `{<Country={'Germany'}>}` still keeps every other selection, which is wrong here.
- Inside a set modifier, use only literal values, literal lists or literal ranges. Never use a search that starts with `=`, such as `Field={"=Year(Field)=2025"}`, `Field={"=Sum(Amount)>1000"}` or `Field={"=Rank(Sum(Amount))<=5"}`. Those searches are evaluated against the current selections and silently bring them back. Put the condition in an `If()` inside the aggregation instead: `Sum({1} If(Year(OrderDate)=2025, Amount))`.
- Nested aggregations need the `1` at every level: `Avg({1} Aggr(Sum({1} Amount), Customer))`.
- Master measures inherit selections. Do not use a master measure by name. Read its definition and add the `1` to every aggregation in it, keeping any set modifiers it already has:
  - `Sum(Revenue) - Sum(Cost)` becomes `Sum({1} Revenue) - Sum({1} Cost)`.
  - `Count({<Status={'Open'}>} TicketID)` becomes `Count({1<Status={'Open'}>} TicketID)`.
- Charts and tables follow the same rule. Every measure in the object uses `{1}`, so dimension values the user's selections exclude still appear.
- Field value lookups and lists of values cover all values in the field, not only the selected or possible ones.

## What to say

- Answer normally. Do not list the user's selections and do not explain the set expression unless asked.
- If the user's current selections are visible to you and they would have changed the result, add one short line at the end: "Calculated on all data. Your current selections were not applied."

## The one exception

If the user asks in the question to use their selections ("within my current selection", "for what I have selected", "using my filters"), calculate on the current selections: write the aggregation without the `1`. This applies to that question only. The next question goes back to all data.

## Final check before sending

1. Does every aggregation in every expression, including inside Aggr() and master measure definitions, start with `{1` (or carry `{1}`)?
2. Does any set modifier contain a search starting with `=`? Replace it with a literal value or range, or an `If()` inside the aggregation.
3. Were master measures rewritten from their definitions instead of called by name?
4. Are the only filters the ones the user stated in this question?
