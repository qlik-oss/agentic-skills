# Qlik Load Script — Syntax & Patterns Reference

Read this **while writing script** — it is the syntax and code-pattern reference. Two companion files cover the phases either side: [writing-scripts.md](writing-scripts.md) for the construction decisions made before the first `LOAD`, and [verification-checklist.md](verification-checklist.md) for the pitfalls table, SQL-habits table and self-check to run once the script is written.

## Table of Contents
1. Statements and Structure
2. LOAD Statement Patterns
3. JOINs
4. CONCATENATE
5. WHERE, GROUP BY, ORDER BY
6. Key Functions
7. Variables and Dollar-Sign Expansion
8. DROP TABLE / DROP FIELD
9. STORE to QVD
10. QUALIFY / UNQUALIFY
11. Mapping Tables
12. Feature Engineering Patterns

---

## 1. Statements and Structure
- Scripts execute **top-to-bottom, sequentially**. Table creation order matters.
- Every `LOAD` or `SELECT` statement creates (or concatenates into) a **named table**.
- Statements are terminated with **semicolons**.
- Comments: `//` for single-line, `/* ... */` for multi-line, `REM ...;` for remark statements.
- Use `SET` or `LET` for variables. `SET` assigns a string literal; `LET` evaluates the expression.

---

## 2. LOAD Statement Patterns

```qlik
// Load from file
TableName:
LOAD
    Field1,
    Field2,
    Expression as DerivedField
FROM [lib://DataFiles/filename.qvd] (qvd);

// Load from another table already in memory
DerivedTable:
LOAD
    Field1,
    Field2,
    Expression as NewField
RESIDENT ExistingTable;

// Load with a preceding LOAD (stacked — outer LOAD transforms the inner LOAD's output)
FinalTable:
LOAD
    *,
    Field1 + Field2 as Combined
;
LOAD
    FieldA as Field1,
    FieldB as Field2
FROM [lib://DataFiles/source.csv] (txt, codepage is utf8, embedded labels, delimiter is ',');
```

### Alias scope — the single most common Qlik mistake

Per the Qlik LOAD documentation: *"fields created through the `as` clause (aliasname) are out of scope and cannot be used inside the same load statement."*

An alias you create in a LOAD **does not exist** for any other expression in that same LOAD. This fails silently or errors — Qlik will not resolve `Margin` here:

```qlik
// ✗ WRONG — Margin does not exist yet within this LOAD
LOAD
    Revenue - Cost          as Margin,
    (Revenue - Cost) / Revenue * 100 as MarginPct,
    Margin / Revenue        as MarginRatio   // ← invalid: Margin is out of scope
RESIDENT Sales;
```

Two correct fixes. **Preceding LOAD** (preferred — no extra table, no extra pass):

```qlik
// ✓ CORRECT — read bottom-up: the lower LOAD runs first and feeds the one above it
Sales_Final:
LOAD
    *,
    Margin / Revenue as MarginRatio      // Margin exists — it came from the LOAD below
;
LOAD
    *,
    Revenue - Cost as Margin
RESIDENT Sales;
```

**RESIDENT in steps** (use when you need the intermediate table, or when stacking more than 2–3 levels hurts readability):

```qlik
// ✓ CORRECT
Sales_Step1:
LOAD
    *,
    Revenue - Cost as Margin
RESIDENT Sales;

Sales_Final:
NoConcatenate
LOAD
    *,
    Margin / Revenue as MarginRatio
RESIDENT Sales_Step1;

DROP TABLE Sales_Step1;
```

Preceding LOAD rules:
- Statements are written **top-down but execute bottom-up**. The bottom statement is the data source; each LOAD above consumes the output of the one below.
- Only the **bottom** statement carries the source clause (`FROM`, `RESIDENT`, `INLINE`, `AUTOGENERATE`). Every LOAD above it has **no** source clause and ends with a bare `;` before the next LOAD.
- Only the **top** statement gets the table label and any prefix (`NoConcatenate`, `CONCATENATE`, `LEFT JOIN`).
- An outer LOAD sees **only** the fields output by the LOAD directly beneath it — not the raw source fields the inner LOAD dropped, and not fields from any other table.
- `GROUP BY` belongs on the statement that does the aggregating (usually the bottom one). You cannot aggregate and then reference the aggregate in the same LOAD — that is exactly the alias-scope rule again.

Repeated alias in the same LOAD is also invalid — repeat the full expression, or split into steps:

```qlik
// ✗ WRONG
LOAD Sum(Amount) as Total, Sum(Amount) / Count(1) as AvgAmount ... // Total unusable below
```

---

## 3. JOINs
- Joins are written as a prefix to a `LOAD` or `SELECT` statement, not inline.
- The join target is the table being joined **into** (named in parentheses).
```qlik
// LEFT JOIN — adds columns from RHS to LHS, matching on shared field names
LEFT JOIN (MainTable)
LOAD
    KeyField,
    EnrichmentField1,
    EnrichmentField2
FROM [lib://DataFiles/lookup.qvd] (qvd);

// INNER JOIN
INNER JOIN (MainTable)
LOAD * RESIDENT OtherTable;
```
- **Automatic key detection:** Qlik joins on all fields that share the same name in both tables. There is no `ON` clause. Rename fields if you need to control the join key.
- Join types: `JOIN` (inner), `LEFT JOIN`, `RIGHT JOIN`, `OUTER JOIN`.

---

## 4. CONCATENATE
- Appends rows from one load into an existing table (union).
```qlik
CONCATENATE (TargetTable)
LOAD * RESIDENT SourceTable;
```
### Automatic concatenation — the table name you used may not exist

Qlik auto-concatenates when *"a table is loaded that contains an identical number of fields and matching field names to a table loaded earlier in the script"* — **regardless of the label you gave it.**

The consequence that bites hardest: **your label is silently discarded.** The rows are appended to the earlier table, no table by your name is ever created, and every later `RESIDENT MyNewTable`, `DROP TABLE MyNewTable`, or `STORE MyNewTable` fails at reload with "Table not found". This is not a warning — the script runs happily until the first reference.

The trigger is the **set of field names**, not their order and not the data. `LOAD * RESIDENT X` into a new label is therefore *always* an auto-concatenation candidate, because the field set is identical by construction. So is any pair of filtered subsets of the same table (Train/Test splits, per-category tables), and any table built by re-loading the same fields.

**Rule: put `NoConcatenate` on every `LOAD` whose field set could match an existing table.** The cost of an unnecessary `NoConcatenate` is zero; the cost of a missing one is a broken reload.

```qlik
// ✓ Label first, then the prefix, then LOAD
NewTable:
NoConcatenate
LOAD * RESIDENT SomeTable;
```

> Note the order: `TableName:` comes **before** `NoConcatenate`, which comes before `LOAD`. Putting the prefix above the label is wrong.

**Self-check before writing any `RESIDENT`, `DROP TABLE`, `STORE`, or `JOIN (…)`:** point to the exact `LOAD` that created that table name, and confirm it either has a different field set from every earlier table or carries `NoConcatenate`. If you cannot, the table does not exist under that name.

When you *do* want to append rows, say so explicitly rather than relying on the automatic behaviour — `CONCATENATE (TargetTable)` documents the intent and survives later field changes.

---

## 5. WHERE, GROUP BY, ORDER BY
The complete set of clauses a `LOAD` accepts is: `where` | `while`, `group by`, `order by`. That is the whole list.

- `WHERE` filters rows **before** aggregation. Uses Qlik expression syntax (not SQL).
- `GROUP BY` works with aggregation functions in the LOAD. **Every non-aggregated field must appear in GROUP BY.**
- `ORDER BY` sorts rows within a LOAD (rarely needed; mainly for Window functions or specific output ordering).
- `WHILE` repeats a record — used with `IterNo()` for row expansion, not for filtering.

### There is no HAVING clause

`HAVING` does not exist in Qlik load script. It is not an unsupported keyword you can work around with a flag — the parser will reject the statement.

To filter on an aggregate, aggregate first, then filter in a **second pass** with `WHERE` — via a preceding LOAD or a RESIDENT load. This is the same alias-scope rule as everywhere else: the aggregate must exist before anything can test it.

```qlik
// ✗ WRONG — HAVING is not Qlik
CustomerTotals:
LOAD CustomerID, Sum(Amount) as TotalSpend
RESIDENT Transactions
GROUP BY CustomerID
HAVING Sum(Amount) > 1000;
```

```qlik
// ✓ CORRECT — preceding LOAD filters the aggregated output
CustomerTotals:
LOAD *
WHERE TotalSpend > 1000
;
LOAD
    CustomerID,
    Sum(Amount) as TotalSpend
RESIDENT Transactions
GROUP BY CustomerID;
```

```qlik
// ✓ CORRECT — two-step RESIDENT alternative
AllTotals:
LOAD CustomerID, Sum(Amount) as TotalSpend
RESIDENT Transactions
GROUP BY CustomerID;

CustomerTotals:
NoConcatenate
LOAD * RESIDENT AllTotals WHERE TotalSpend > 1000;

DROP TABLE AllTotals;
```

Note that the `WHERE` in the second form is a *row* filter on already-aggregated rows — it cannot contain `Sum()`, `Count()`, or any other aggregation function.

---

## 6. Key Functions

| Category | Functions |
|---|---|
| **Aggregation** | `Sum()`, `Count()`, `Avg()`, `Min()`, `Max()`, `Count(DISTINCT ...)`, `Only()`, `FirstSortedValue()` *(NULL on ties — see below)*, `Median()`, `Stdev()` |
| **Conditional** | `If(condition, then, else)`, `Pick()`, `Match()`, `MixMatch()`, `WildMatch()` |
| **String** | `Len()`, `Left()`, `Right()`, `Mid()`, `SubField()`, `Replace()`, `Upper()`, `Lower()`, `Trim()`, `PurgeChar()`, `KeepChar()`, `TextBetween()` |
| **Date** | `Today()`, `Now()`, `Year()`, `Month()`, `Day()`, `WeekDay()`, `Week()`, `Date()`, `Date#()`, `Num()`, `Interval()`, `AddMonths()`, `YearStart()`, `MonthStart()` |
| **Null/Missing** | `IsNull()`, `Null()`, `If(Len(Field)=0, ...)`, `Alt()` (SQL `COALESCE()` equivalent — returns the first non-null argument) |
| **Math** | `Ceil()`, `Floor()`, `Round()`, `Fabs()`, `Log()`, `Sqrt()`, `Mod()`, `Div()`, `RangeMin()`, `RangeMax()`, `RangeAvg()`, `RangeSum()` |
| **Type** | `IsNum()`, `IsText()`, `Num()`, `Text()`, `Num#()`, `Date#()`, `Money#()` |
| **Inter-record** | `Previous()`, `Peek()`, `FieldValue()`, `FieldValueCount()` |
| **Window** | `Window(aggr_expr, partition, sort_type, sort_expr, filter_expr, start, end)` |
| **Mapping** | `ApplyMap('MapName', LookupField, DefaultValue)`, `MapSubstring()` |
| **File** | `QvdCreateTime()`, `FileSize()`, `FileTime()` |

### Count() — there is no `Count(*)`

The documented syntax is `Count([distinct] expr)`. The argument is **required** and must be an expression. `Count(*)` is SQL, not Qlik, and is a syntax error.

| Intent | Correct Qlik |
|---|---|
| Count **all rows** in the group, including rows where fields are null | `Count(1)` |
| Count rows where a field has a value (nulls excluded) | `Count(FieldName)` |
| Count unique values of a field | `Count(DISTINCT FieldName)` |
| Count rows meeting a condition | `Sum(If(condition, 1, 0))` |

`Count(1)` works because `1` is a constant non-null expression evaluated once per row, so it counts every row — this is the direct `COUNT(*)` equivalent. Choose deliberately: `Count(1)` and `Count(SomeField)` differ by exactly the number of nulls in `SomeField`, which silently changes any rate or ratio built on top of them.

```qlik
CustomerFeatures:
LOAD
    CustomerID,
    Count(1)                        as TxnCount,        // every transaction row
    Count(DiscountCode)             as DiscountedTxns,  // only rows with a discount
    Count(DISTINCT ProductCategory) as UniqueCategories,
    Sum(If(Amount > 100, 1, 0))     as LargeTxnCount    // conditional count
RESIDENT Transactions
GROUP BY CustomerID;
```

For a plain row count of an existing table, prefer the built-in variable over an aggregation:
```qlik
LET vRows = NoOfRows('TableName');
```

### Round() — the second argument is a step, not a decimal count

Syntax: `Round(x[, step[, offset]])` — `step` is the **interval to round to** (default `1`), `offset` is the base of that interval (default `0`).

`Round(x, 3)` rounds to the nearest **multiple of 3** (…, 0, 3, 6, 9 …). It does **not** give 3 decimal places. This is the opposite of SQL's `ROUND(x, 3)` and of Python's `round(x, 3)`.

| Intent | Correct Qlik | Result for `x = 3.14159` |
|---|---|---|
| Nearest integer | `Round(x)` | `3` |
| 1 decimal place | `Round(x, 0.1)` | `3.1` |
| 2 decimal places | `Round(x, 0.01)` | `3.14` |
| 3 decimal places | `Round(x, 0.001)` | `3.142` |
| Nearest 5 | `Round(x, 5)` | `5` |
| Nearest 100 | `Round(x, 100)` | `0` |

Rule of thumb: for *N* decimal places the step is `1/10^N` — a number **less than 1**. If you have written a step ≥ 1 you are bucketing, not formatting; make sure that is what you meant.

Related: `Ceil(x[, step[, offset]])` and `Floor(x[, step[, offset]])` take the same step semantics — `Ceil(x, 0.01)`, not `Ceil(x, 2)`. `Round()` at midpoints always rounds **upwards**.

For *display* precision, format instead of rounding — this keeps the underlying value intact:
```qlik
Num(Value, '#,##0.00') as ValueFormatted
```
For ML features, prefer leaving values unrounded unless rounding is a deliberate feature choice (e.g. binning). Rounding a feature discards signal for no modelling benefit.

### FirstSortedValue() — returns NULL on tied ranks

`FirstSortedValue(expr, sortweight[, n])` returns the value of `expr` from the row with the lowest `sortweight` (use `-sortweight` for the highest). Per the Qlik docs, if **two or more rows share that rank, the function returns NULL.**

It fails silently. There is no error, no warning — the field simply has nulls for exactly the entities where a tie occurred, and those nulls then propagate into every ratio, flag and aggregate built on top of it.

Ties are the norm, not the exception. Any of these produces them routinely:
- Dates stored to day precision — two transactions on the same day.
- Equal amounts, prices, or scores.
- Integer ranks, counts, or sequence numbers.
- Any sort key with lower cardinality than the number of rows in the group.

**Prefer a more robust construct.** In order of preference:

1. **`Max()` / `Min()`** — when the value you want *is* the extremum, not a value attached to it. `Max(TransactionDate)` cannot tie with itself.
2. **Aggregate, then join back** — for "the value on the row where X is highest". Deterministic, and built from primitives with no edge-case behaviour to remember.
3. **`Window()` rank, then filter** — a ranked pass on a RESIDENT load with an explicit tiebreak sort key, then a second pass filtering to rank 1. Use when the ranking itself is worth keeping, or when you need the *n*th row rather than the first.
4. **`FirstSortedValue(DISTINCT expr, sortweight)`** — only where the tied rows carry genuinely identical values of `expr`, so the tie is immaterial. `DISTINCT` collapses duplicate value/weight pairs and avoids the null; it does **not** help when the tied rows differ.

Worked example — the product category of each customer's most recent transaction:

```qlik
// ✗ FRAGILE — NULL for every customer with two transactions on their latest date
LatestCategory:
LOAD
    CustomerID,
    FirstSortedValue(ProductCategory, -TransactionDate) as LatestCategory
RESIDENT Transactions
GROUP BY CustomerID;
```

```qlik
// ✓ ROBUST — aggregate to the key, then join back
// Ties on TransactionDate are broken by TransactionID, so exactly one row wins.

// 1. Each customer's latest transaction date.
LatestTxnKey:
LOAD
    CustomerID,
    Max(TransactionDate) as TransactionDate
RESIDENT Transactions
GROUP BY CustomerID;

// 2. Keep only the transactions on that date — still multiple rows where a
//    customer transacted twice on their latest day.
INNER JOIN (LatestTxnKey)
LOAD
    CustomerID,
    TransactionDate,
    TransactionID
RESIDENT Transactions;

// 3. Break the tie explicitly: the highest TransactionID wins.
LatestTxn:
NoConcatenate
LOAD
    CustomerID,
    Max(TransactionID) as TransactionID
RESIDENT LatestTxnKey
GROUP BY CustomerID;

DROP TABLE LatestTxnKey;

// 4. TransactionID is unique, so this join cannot fan out.
LEFT JOIN (LatestTxn)
LOAD
    TransactionID,
    ProductCategory as LatestCategory
RESIDENT Transactions;
```

> The second pass is doing the work `FirstSortedValue` hides: it names the tiebreak explicitly. If you cannot name a tiebreak for your data, you do not have a well-defined "first" value, and that is a design question rather than a function-choice one.

---

## 7. Variables and Dollar-Sign Expansion

```qlik
SET vMyVar = Hello;           // vMyVar contains the string 'Hello'
LET vToday = Today();         // vToday contains today's date (evaluated)
LET vRowCount = NoOfRows('TableName');

// Dollar-sign expansion substitutes variable values into expressions
LOAD * RESIDENT MyTable WHERE Amount > $(vThreshold);
```
- `$(vVar)` expands before the expression is evaluated.
- For string values in WHERE clauses: `WHERE Field = '$(vStringVar)'`
- Dollar-sign expansion happens at parse time, not runtime. Be careful with timing.

---

## 8. DROP TABLE / DROP FIELD

```qlik
DROP TABLE TempTable;
DROP TABLES Table1, Table2, Table3;
DROP FIELD FieldName FROM TableName;
DROP FIELDS Field1, Field2;
```

---

## 9. STORE to QVD

```qlik
STORE TableName INTO [lib://DataFiles/output.qvd] (qvd);
STORE TableName INTO [lib://DataFiles/output.csv] (txt);
```

---

## 10. QUALIFY / UNQUALIFY
- `QUALIFY *;` prefixes all field names with `TableName.FieldName` to prevent automatic associations.
- `UNQUALIFY *;` turns it off.
- Use sparingly and deliberately. Usually it is better to rename fields explicitly.

---

## 11. Mapping Tables

```qlik
MapRegion:
MAPPING LOAD
    StateCode,
    RegionName
FROM [lib://DataFiles/region_mapping.csv] (txt, ...);

// Usage:
MainTable:
LOAD
    *,
    ApplyMap('MapRegion', StateCode, 'Unknown') as Region
RESIDENT RawData;
```

---

## 12. Feature Engineering Patterns

### Aggregation to grain (transactional → one row per entity)
```qlik
CustomerFeatures:
LOAD
    CustomerID,
    Count(1) as TxnCount,                    // every row; Count(TransactionID) would drop nulls
    Sum(Amount) as TotalSpend,
    Avg(Amount) as AvgSpend,
    Max(Amount) as MaxSpend,
    Min(TransactionDate) as FirstPurchaseDate,
    Max(TransactionDate) as LastPurchaseDate,
    Count(DISTINCT ProductCategory) as UniqueCategories
RESIDENT Transactions
GROUP BY CustomerID;
```

### Aggregate, then derive from the aggregate (preceding LOAD)
Ratios over aggregates need two levels — the aggregate alias is out of scope in the LOAD that creates it.
```qlik
CustomerFeatures:
LOAD
    *,
    If(TxnCount > 0, TotalSpend / TxnCount, 0) as AvgTxnValue,
    If(TotalSpend > 0, ReturnedSpend / TotalSpend, 0) as ReturnedShare
;
LOAD
    CustomerID,
    Count(1) as TxnCount,
    Sum(Amount) as TotalSpend,
    Sum(If(Returned = 'Yes', Amount, 0)) as ReturnedSpend
RESIDENT Transactions
GROUP BY CustomerID;
```

### Lag features via Window()
```qlik
WithLags:
LOAD
    *,
    Window(Sum(Sales), Region, 'ASC', YearMonth, , -1, -1) as Sales_Lag1,
    Window(Sum(Sales), Region, 'ASC', YearMonth, , -3, -1) as Sales_RollingAvg3
RESIDENT MonthlySales;
```
> Window offsets: `-1, -1` = previous row. `-3, -1` = rolling 3-period window. Current row is excluded to prevent leakage.

### Ratios and proportions
```qlik
LOAD
    *,
    If(TotalTransactions > 0, Returns / TotalTransactions, 0) as ReturnRate,
    If(TotalSpend > 0, ElectronicsSpend / TotalSpend, 0) as ElectronicsShare
RESIDENT CustomerFeatures;
```

### Binary flags
```qlik
LOAD
    *,
    If(DaysSinceLastPurchase > 90, 1, 0) as IsInactive,
    If(AvgSpend > 500, 1, 0) as IsHighSpender
RESIDENT CustomerFeatures;
```

### Binning / bucketing
```qlik
LOAD
    *,
    If(Age < 25, 'Under25',
       If(Age < 40, '25-39',
          If(Age < 55, '40-54', '55+'))) as AgeBucket,
    Class(TotalSpend, 100) as SpendBucket
RESIDENT CustomerFeatures;
```

### Date formatting
```qlik
LOAD
    *,
    // Format dates as YYYY-MM-DD for reliable interpretation
    Date(Date#(RawDateField, 'DD/MM/YYYY'), 'YYYY-MM-DD') as EventDate,
    // Manual date engineering — only for features Qlik Predict won't auto-derive
    Today() - Date#(RawDateField, 'DD/MM/YYYY') as DaysSinceEvent,
    If(WeekDay(Date#(RawDateField, 'DD/MM/YYYY')) >= 5, 1, 0) as IsWeekend
RESIDENT RawData;
```

### RFM (Recency, Frequency, Monetary)
```qlik
RFM:
LOAD
    CustomerID,
    Today() - Max(TransactionDate) as Recency_Days,
    Count(1) as Frequency,
    Sum(Amount) as Monetary
RESIDENT Transactions
GROUP BY CustomerID;
```

### Joining enrichment data
```qlik
LEFT JOIN (MainTable)
LOAD
    KeyField,
    EnrichmentField1,
    EnrichmentField2
FROM [lib://DataFiles/lookup.qvd] (qvd);
```

### Mapping table for categorical encoding
```qlik
RiskMap:
MAPPING LOAD * INLINE [
    Category, RiskScore
    Low, 1
    Medium, 2
    High, 3
    Critical, 4
];

LOAD
    *,
    ApplyMap('RiskMap', RiskCategory, 0) as RiskScore_Numeric
RESIDENT MainTable;
```

---

## Next: verify what you wrote

Run the pitfalls table, SQL-habits table, and numbered self-check in
**[verification-checklist.md](verification-checklist.md)** after writing the script, and again after every revision.
