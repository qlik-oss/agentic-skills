# Qlik Load Script — Syntax & Patterns Reference

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
12. Common Pitfalls
13. Feature Engineering Patterns

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
- Without the explicit table name, Qlik auto-concatenates if field names match a prior table — **this is a common source of bugs.** Use `NoConcatenate` to prevent it.
```qlik
NoConcatenate
NewTable:
LOAD * RESIDENT SomeTable;
```

---

## 5. WHERE, GROUP BY, ORDER BY
- `WHERE` filters rows. Uses Qlik expression syntax (not SQL).
- `GROUP BY` works with aggregation functions in the LOAD. **Every non-aggregated field must appear in GROUP BY.**
- `ORDER BY` sorts rows within a LOAD (rarely needed; mainly for Window functions or specific output ordering).

---

## 6. Key Functions

| Category | Functions |
|---|---|
| **Aggregation** | `Sum()`, `Count()`, `Avg()`, `Min()`, `Max()`, `Count(DISTINCT ...)` |
| **Conditional** | `If(condition, then, else)`, `Pick()`, `Match()`, `MixMatch()`, `WildMatch()` |
| **String** | `Len()`, `Left()`, `Right()`, `Mid()`, `SubField()`, `Replace()`, `Upper()`, `Lower()`, `Trim()`, `PurgeChar()`, `KeepChar()`, `TextBetween()` |
| **Date** | `Today()`, `Now()`, `Year()`, `Month()`, `Day()`, `WeekDay()`, `Week()`, `Date()`, `Date#()`, `Num()`, `Interval()`, `AddMonths()`, `YearStart()`, `MonthStart()` |
| **Null/Missing** | `IsNull()`, `Null()`, `If(Len(Field)=0, ...)`, `Alt()`, `Coalesce()` |
| **Math** | `Ceil()`, `Floor()`, `Round()`, `Fabs()`, `Log()`, `Sqrt()`, `Mod()`, `Div()`, `RangeMin()`, `RangeMax()`, `RangeAvg()`, `RangeSum()` |
| **Type** | `IsNum()`, `IsText()`, `Num()`, `Text()`, `Num#()`, `Date#()`, `Money#()` |
| **Inter-record** | `Previous()`, `Peek()`, `FieldValue()`, `FieldValueCount()` |
| **Window** | `Window(aggr_expr, partition, sort_type, sort_expr, filter_expr, start, end)` |
| **Mapping** | `ApplyMap('MapName', LookupField, DefaultValue)`, `MapSubstring()` |
| **File** | `QvdCreateTime()`, `FileSize()`, `FileTime()` |

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

## 12. Common Pitfalls

| Pitfall | What happens | How to avoid |
|---|---|---|
| **Missing semicolons** | Parser error, often cryptic | Every statement ends with `;` |
| **Auto-concatenation** | Two tables with matching fields silently merge into one | Use `NoConcatenate` or rename fields |
| **Join key mismatch** | JOIN matches on ALL shared field names, not just the one you intend | Rename unintended shared fields before joining |
| **GROUP BY mismatch** | Non-aggregated fields missing from GROUP BY cause errors | List every non-aggregated field in GROUP BY |
| **Dual values confusion** | A field can have both a text and numeric representation (dual). Aggregations on text-stored numbers fail silently | Use `Num()`, `Num#()`, or `Text()` to enforce type |
| **Null vs empty string** | `IsNull()` only catches true nulls, not empty strings. `Len(Field)=0` catches empty strings | Use `If(Len(Trim(Field))=0 or IsNull(Field), ...)` for both |
| **RESIDENT after DROP** | Referencing a table you already dropped | Track table lifecycle carefully |
| **Preceding LOAD field visibility** | Outer (preceding) LOAD can only see fields from the inner LOAD, not from other tables | When in doubt, use RESIDENT instead |
| **Dollar-sign expansion timing** | `$(vVar)` evaluates at parse time, not row-by-row | For row-level logic use `Peek()` or field references, not variables |
| **Date interpretation** | Dates loaded from CSV may be strings, not Qlik serial dates | Use `Date#(Field, 'format')` to parse, then format as YYYY-MM-DD: `Date(Date#(Field, 'DD/MM/YYYY'), 'YYYY-MM-DD')` |
| **Window() misuse** | Forgetting partition or sort fields gives nonsensical results | Always specify partition and sort. Test with small data |

---

## 13. Feature Engineering Patterns

### Aggregation to grain (transactional → one row per entity)
```qlik
CustomerFeatures:
LOAD
    CustomerID,
    Count(TransactionID) as TxnCount,
    Sum(Amount) as TotalSpend,
    Avg(Amount) as AvgSpend,
    Max(Amount) as MaxSpend,
    Min(TransactionDate) as FirstPurchaseDate,
    Max(TransactionDate) as LastPurchaseDate,
    Count(DISTINCT ProductCategory) as UniqueCategories
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
    Count(TransactionID) as Frequency,
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
