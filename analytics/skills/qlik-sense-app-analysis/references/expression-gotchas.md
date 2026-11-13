# Qlik Expression & Set Analysis Gotchas

Read this before writing any expression more complex than a single
exact-match filter — for `qlik_create_data_object`, `qlik_add_chart`
measures, or `qlik_create_measure`. Qlik expressions fail quietly far more
often than they error loudly; this is the main list of ways that happens.

## Quoting rules

Qlik uses different quote characters depending on what you're doing, and
mixing them up is the single most common source of silent wrong answers.

| What you're doing | Quote style | Example |
|---|---|---|
| Field reference (no spaces) | none | `Sum(Sales)` |
| Field reference (spaces/special chars) | square brackets | `Sum([Total Sales])` |
| Literal string in an expression | single quotes | `if(Country='USA', 'Domestic', 'International')` |
| Set analysis — **exact match** | single quotes inside braces | `Sum({<Country={'USA','Canada'}>} Sales)` |
| Set analysis — **search mode**: relational operators, wildcards, case-insensitive | double quotes inside braces | `Sum({<Year={">=2024"}>} Sales)`, `Sum({<Product={"*apple*"}>} Sales)` |

### The numeric range trap

```
Wrong:   <Field={'>30'}>   <Field={'>=30'}>
Correct: <Field={">30"}>   <Field={">=30"}>   <Field={">=30<100"}>
```

Single-quote range syntax **looks valid and silently returns 0 rows** — no
error. Any comparison or range inside set analysis needs double quotes to
enable search mode.

### The whitespace trap

No whitespace inside the comparison value: `>=30` not `>= 30`. A space
after the operator changes how Qlik parses the value and can produce wrong
(not necessarily zero) results with no warning.

### The row-count trap

```
Wrong:   Count(1)
Correct: Count(RecNo())   Count([SomeNonNullKeyField])
```

`Count(1)` looks like SQL's `COUNT(*)`, but in Qlik it counts occurrences of
the literal value `1` — which evaluates to `1`, not the row count, with no
error. Use `Count(RecNo())` for an unconditional row count, or
`Count(DISTINCT [KeyField])` when you want distinct rows.

## Verify before you filter

Before applying a selection or writing set analysis against a specific
value — a year, a date, a currency code, a product name — confirm the
value actually exists in the data:

```
1. qlik_search_field_values(fieldName="payment_year", searchTerms=["2022"])
2. Confirm "2022" is in the results
3. Only then use {payment_year={2022}} in set analysis or a selection
```

Selecting or set-analysing on a value that doesn't exist doesn't error —
it just returns nothing, or (for `qlik_select_values`) silently drops that
field from the returned selection state.

The highest-risk case is a proper-noun-shaped literal you typed from
memory rather than copied from a tool result — a company, product, or
category name. The full display name ("American Airlines") is often not
the value actually stored in the field, which may be a shortened form
("American"), a code, or an abbreviation. Treat any such value as an
unverified guess until you've confirmed it via `qlik_get_field_values` or
`qlik_search_field_values` in the same turn — don't wait for a suspicious
result (e.g. an all-null column) to check afterward.

## Common expression patterns

- **Distinct count**: `Count(DISTINCT CustomerID)`
- **Total ignoring dimensions**: `Count(Total OrderID)`
- **Filtered aggregation**: `Sum({<Country={'USA','Canada'}>} Sales)`
- **Range filter**: `Sum({$<Year={">2018"}>} Sales)`
- **Wildcard filter**: `Sum({$<Product={"Car*"}>} Sales)`
- **Nested aggregation** (sub-queries): `Avg(Aggr(Sum(Sales), CustomerID))`
  — always provide an outer aggregation; nested `Aggr()` calls are not
  allowed.
- **Running total**: `RangeSum(Above(Sum(Sales), 0, RowNo()))`
- **Moving average (last 3 periods)**: `RangeAvg(Above(Sum(Sales), 0, 3))`

## Selections vs. set analysis — which to use

| Use `qlik_select_values` when... | Use set analysis in an expression when... |
|---|---|
| You want to filter the whole app/session for several subsequent operations | You need a one-off filter for a single calculation |
| The user is exploring interactively and expects the filter to stick | You're answering a single analytical question and don't want to leave state behind |

Selections persist across every subsequent tool call until cleared. For a
single analytical query, set analysis is almost always the better choice —
it's self-contained and doesn't require a cleanup step afterward.

## Never re-aggregate returned data

Whatever `qlik_get_chart_data` or `qlik_create_data_object` returns is
already the final calculated value. Do not sum, average, or otherwise
recompute it yourself — if you need a different aggregation or cut, change
the expression and call the tool again.
