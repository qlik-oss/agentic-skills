# Set Analysis Reference

Set analysis defines the record set an aggregation runs over, independent of the
current selection. Prefer it over `if()` for filtering measures: it is faster
(evaluated once per chart cell, not row-by-row) and clearer.

Contents: Anatomy · Identifiers · Modifiers · Operators · Quoting (critical) ·
Element sets · Dollar expansion · P()/E() · Time patterns · Aggregation notes ·
Alternate states · Pitfalls · Validated examples · MCP usage.

## Anatomy

```
Sum( {<Year={2024}, Region={'EU','US'}>} Sales )
      │ │                               │  └ expression: field(s) to aggregate
      │ └ set modifier(s): <Field={elements}>, comma-separated
      └ set identifier (omitted here → defaults to $, the current selection)
```

A set expression is `{ identifier modifiers }` placed as the first argument of an
aggregation. Every aggregation (`Sum`, `Count`, `Avg`, `Min`, `Max`, `Only`,
`Concat`, `Aggr`, …) accepts one.

## Set identifiers (the base record set)

| Identifier | Meaning |
| --- | --- |
| `$` | Current selection (the default when modifiers are present without an identifier). |
| `1` | The full data set — ignores all selections. |
| `$1` | Selection one step back in the back/forward stack; `$2` two back; `$_1` one step forward. Unreliable in stored/server objects — avoid. |
| `$0` | The current selection (same as `$`); rarely needed. |
| `BookmarkName` or `BookmarkId` | The selection stored in that bookmark. |
| `[AlternateState]` | The selection of a named alternate state, e.g. `{[Group1]}`. |

Combine an identifier with modifiers: `{1<Year={2024}>}` = all data, then force
`Year=2024`. `{$<Year={2024}>}` = current selection, but override `Year` to 2024.

Set expressions can nest: `Sum( {<Region={'EU'}>} Aggr(Sum({<Year={2024}>} Sales), Customer) )`.

## Set modifiers (adjust field selections)

A modifier is `<Field operator {element set}>`. Multiple modifiers are
comma-separated and combined with **AND** (intersection of conditions):

```
{<deal_status={'OPEN'}, IsNNMDeal={1}, CalendarYear={2024}>}
```

To **ignore** a field's current selection (treat it as unselected / all values):

```
{<Region=>}          // forget any Region selection
```

This differs from `{<Region={"*"}>}` (a wildcard *search* that matches all present
values) — use the empty `Region=` form to clear a selection.

## Operators

**Element-set operators** (inside `<Field OP {…}>`) — how the element set combines
with the field's current selection:

| Op | Meaning |
| --- | --- |
| `=` | Replace the selection (default). |
| `+=` | Add to the current selection (union). |
| `-=` | Remove from the current selection. |
| `*=` | Intersect with the current selection. |
| `/=` | Symmetric difference. |

**Set operators** (between whole sets / identifiers): `+` union, `-` exclusion
(difference), `*` intersection, `/` symmetric difference. Example:
`Sum( {1-$} Sales )` = records **not** in the current selection.

## Quoting — the single biggest source of bugs

The server's own `create_data_object` guidance encodes these rules. Get them wrong
and you silently match nothing.

| Case | Quoting | Example |
| --- | --- | --- |
| Field name | none; `[brackets]` if it has spaces/special chars | `Sum(Sales)`, `Sum([Total Sales])` |
| Literal string value (exact) | **single** quotes | `<Country={'USA'}>` |
| Numeric literal value (exact) | unquoted (or single) | `<Year={2024}>` |
| Search: comparison, wildcard, or expression | **double** quotes | `<Year={">=2024"}>`, `<Name={"A*"}>` |
| String literal inside an `if()`/expression | single quotes | `if(Status='WON', 1, 0)` |

Rule of thumb: **single quotes = exact element match; double quotes = a search
string that Qlik evaluates.** `{'2024'}` matches the exact value `2024`;
`{">=2024"}` matches every value ≥ 2024.

## Element set contents

| Content | Example |
| --- | --- |
| Explicit list | `{'A','B','C'}` or `{1,2,3}` |
| Numeric range search | `{">=100"}`, `{">10<=100"}` |
| Text wildcard search | `{"A*"}`, `{"*phone*"}`, `{"???"}` (`?` = one char) |
| Expression search (per element) | `{"=Sum(amount_reporting)>1000000"}` |
| Dollar-expanded value | `{$(=Max(Year))}`, `{"$(=Only(vThreshold))"}` |
| Values possible/excluded in another field | `P(...)` / `E(...)` — see below |

An expression search (`{"=…"}`) evaluates the expression for each field value and
keeps the values where it is true — powerful but costly on high-cardinality fields.

## Dollar-sign expansion inside set analysis

`$(=expr)` expands **once**, at chart level, to a scalar before the set is
evaluated — it is not per-row. `$(vVar)` expands a variable's text.

```
{<CalendarYear={$(=Max(CalendarYear))}>}     // latest year in scope
{<Year={$(vCurrentYear)}>}                    // from a variable
{<Date={">=$(=YearStart(Today()))<=$(=Today())"}>}   // YTD boundary (search)
```

Because it is scalar, `$(=…)` is correct for a boundary or a single value, and
wrong when you need a per-row comparison — use a field flag for that.

## P() and E() — indirect set analysis

`P({set} Field)` returns the **possible** values of `Field` under `set`; `E()`
returns the **excluded** values. Use them to filter one field by activity in another:

```
// Customers who have at least one WON deal, evaluated over all their deals:
Sum( {<customer_id = P({<deal_status={'WON'}>} customer_id)>} amount_reporting )

// Products never sold in EU:
Count( {<product_code = E({<region={'EU'}>} product_code)>} DISTINCT product_code )
```

`P()`/`E()` are the closest MCP-available substitute for "what's excluded" analysis,
since the associative field-state tools are not exposed on this server.

## Time-intelligence patterns

Prefer a data-model flag (`IsCurrentYear`, `IsYTD`) when one exists — it is faster
and less error-prone than boundary math. Set-analysis equivalents:

| Goal | Expression |
| --- | --- |
| Current year | `{<Year={$(=Max(Year))}>}` |
| Prior year (respect other selections) | `{<Year={$(=Max(Year)-1)}>}` |
| Year-to-date | `{<Date={">=$(=YearStart(Today()))<=$(=Today())"}>}` |
| Month-to-date | `{<Date={">=$(=MonthStart(Today()))<=$(=Today())"}>}` |
| Quarter-to-date | `{<Date={">=$(=QuarterStart(Today()))<=$(=Today())"}>}` |
| Same period last year (YTD) | `{<Date={">=$(=YearStart(AddYears(Today(),-1)))<=$(=AddYears(Today(),-1))"}>}` |
| Rolling 12 months | `{<Date={">=$(=AddMonths(Today(),-12))<=$(=Today())"}>}` |
| Full prior year (clear month/day) | `{<Year={$(=Max(Year)-1)}, Month=, Date=>}` |
| Exclude a value | `{<Status-={'Cancelled'}>}` |
| Ignore a field's selection | `{<Region=>}` |
| Force a value on top of selection | `{<Region+={'EU'}>}` |

Year-over-year and running totals are not pure set analysis:

```
// YoY %
( Sum({<Year={$(=Max(Year))}>} Sales) - Sum({<Year={$(=Max(Year)-1)}>} Sales) )
  / Sum({<Year={$(=Max(Year)-1)}>} Sales)

// Running total across a dimension → RangeSum(Above(...)) or Aggr(), not set analysis
RangeSum( Above( Sum({<Year={2024}>} Sales), 0, RowNo() ) )
```

## Aggregation notes

- **Distinct counts:** `Count( {<deal_status={'WON'}>} DISTINCT [$keyOpportunity] )`.
- **Share of total:** put the set on the denominator, e.g. region share of a
  selection-independent total: `Sum(Sales) / Sum({<Region=>} TOTAL Sales)`.
- **`TOTAL` qualifier** disregards the chart dimensions; combine with set analysis:
  `Sum( TOTAL <Region> {<Year={2024}>} Sales )` totals within Region only.
- **`Aggr()`** for nested aggregation carries its own inner set:
  `Avg( Aggr( Sum({<Year={2024}>} Sales), Customer ) )`.

## Alternate states

Reference a state as the identifier, alone or with modifiers:

```
Sum( {[Group1]} Sales )                 // Group1's selection
Sum( {[Group1]<Year={2024}>} Sales )    // Group1's selection, Year forced
Sum( {[Group1]} Sales ) - Sum( {[Group2]} Sales )   // compare two states
```

Via MCP, pass a state with `stateName` on the selection tools; in an expression,
name the state in the identifier as above.

## Pitfalls

| Pitfall | Fix |
| --- | --- |
| Single vs double quotes | `{'2024'}` exact; `{">=2024"}` search. Wrong choice → silently empty. |
| `$(=…)` is scalar, once | Correct for a boundary; for per-row logic use a data-model flag. |
| Clearing a field | Use `<Field=>`, not `<Field={"*"}>`. |
| Case sensitivity | Element values are matched against stored case; searches follow the app's search settings. |
| `$1` in stored objects | Back/forward identifiers depend on session history — unreliable in server/embedded objects. |
| Field vs literal | Unquoted token is a field; quote literals. `{Country}` (field, usually wrong) vs `{'Country'}` (value). |
| Modifier scope | Modifiers set the record set, not row context; an aggregation still needs the right dimension/`Aggr` for nested logic. |
| Performance | Expression searches `{"=…"}` on high-cardinality fields are expensive; prefer explicit lists, flags, or `P()`/`E()`. |
| Duals | Fields with dual (text+number) values: match on the representation Qlik stores; test with `qlik_get_field_values`. |

## Validated examples (from Demo Banking, live)

```
// Exact match + variable-expanded year (single quotes for the literal):
{<deal_status={'WON'}, CalendarYear={$(vCurrentYear)}>} Sum(amount_reporting)

// Mixed exact + search in one modifier (double quotes for the comparison):
{<deal_status={'OPEN'}, IsNNMDeal={1}, stage_sequence={">=4"},
  CalendarYear={$(vCurrentYear)}>} Sum(amount_reporting)

// Set analysis on the front of the expression:
Sum( {<IsWhaleDeal={1}, deal_status={'OPEN'}>} amount_reporting )

// Distinct count over a key with a status filter:
Count( {<deal_status={'WON'}>} DISTINCT [$keyOpportunity] )

// Prior-year comparison using a variable identifier:
{<deal_status={'WON'}, CalendarYear={$(vPriorYear)}>} Sum(amount_reporting)
```

Note the app's pattern: boolean flags (`IsNNMDeal`, `IsWhaleDeal`) and a status
field (`deal_status`) do the heavy lifting with exact matches; searches (`">=4"`)
are reserved for genuine ranges. This is the recommended style — model flags first,
searches only when needed.

## Using set analysis through the Qlik MCP server

- Put the full expression in a `qlik_create_data_object` measure's `expression`
  (or in `qlik_create_measure`). Prefer an existing governed measure by `libraryId`
  when one already encodes the logic.
- Mind two quoting layers: JSON string escaping (the transport) and Qlik quoting
  (single vs double). Inside the JSON string, keep Qlik's single/double quotes
  exactly as above; escape the JSON quotes, not the Qlik ones.
- Verify element values exist before an exact match with `qlik_search_field_values`
  / `qlik_get_field_values` — a mistyped literal yields an empty set with no error.
- After `qlik_select_values`, the selection persists; a measure's set analysis is
  applied **on top of** that selection unless you reset the base with `1` or clear a
  field with `<Field=>`.
