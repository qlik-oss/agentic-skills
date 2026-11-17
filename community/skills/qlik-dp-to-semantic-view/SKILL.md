---
name: qlik-dp-to-semantic-view
description: >-
  Convert a Qlik Talend Cloud Data Product into a Snowflake Semantic View, preserving
  governed metadata (descriptions, glossary definitions, relationships, trust scores) as
  semantic-view comments, metrics and relationships. Reuses the Data Product's semantic
  model (relationships, measures, dimensions) when one exists, and infers it from keys,
  column names and the glossary when it does not. Use for "convert data product to
  semantic view", "make this data product AI-ready in Snowflake", "build a semantic view
  from Qlik", "qlik dp to semantic view". Requires the Qlik MCP server and Snowflake SQL access.
license: Apache-2.0
compatibility: Requires the Qlik MCP server (data product, glossary and semantic model tools) and SQL access to the Snowflake account that holds the data.
metadata:
  author: cleveranjos
  version: 1.0.1
  tags:
    - qlik
    - snowflake
    - semantic-view
    - data-products
    - cortex-analyst
---

# Qlik Data Product to Snowflake Semantic View

Convert a Qlik Talend Cloud Data Product into a Snowflake semantic view, end to end, preserving governed metadata (descriptions, glossary definitions, trust scores) as first-class semantic metadata.

## Why This Works

A Qlik Data Product already contains almost everything a semantic view needs — curated dataset selection, human-written table and field descriptions, profiled types, PII classification, relationship documentation, business glossary terms, and continuously monitored trust scores. The conversion is first a **metadata translation**: reuse what the data steward already wrote (descriptions, glossary formulas, the semantic model) before modelling anything yourself. Infer only what the Data Product does not state, and confirm with the user where an inference changes results (Step 1b).

## Inputs Required

- The **Data Product ID** (or a name to resolve).
- The **target location** of the semantic view: `<DB>.<SCHEMA>.<VIEW_NAME>`. If the user did not give one, propose the source database and schema with a name derived from the Data Product, and confirm it before creating anything.

Everything else is derived from the Data Product.

Once the target is confirmed, check that the current role can create the view there, before any modelling work:

```sql
SHOW GRANTS ON SCHEMA <DB>.<SCHEMA>;
```

The role needs `CREATE SEMANTIC VIEW` (or `OWNERSHIP`) on the schema, plus `SELECT` on every source table. If it is missing, stop and ask the user whether to use another role or have the privilege granted. Never switch to a higher-privileged role or grant privileges without the user's approval.

Tool names below use the `mcp_qlik_qlik_` prefix as an example. The prefix depends on how the Qlik MCP server is registered in the host; match on the tool's base name (`qlik_get_data_product_semantic_model`, …).

```
mcp_qlik_qlik_search(query="<name>", resourceType="dataProduct")
mcp_qlik_qlik_get_data_product(dataProductId="<id>")
mcp_qlik_qlik_get_data_product_documentation(dataProductId="<id>")   # richest source — always call
mcp_qlik_qlik_get_data_product_semantic_model(dataProductId="<id>")  # decides the path in Step 1b — always call
```

If the DP has a glossary, export it in full:

```
mcp_qlik_qlik_search(query="<glossary name>", resourceType="glossary")
mcp_qlik_qlik_get_full_glossary_export(glossaryId="<id>")
```

## Workflow

### Step 1 — Harvest the Data Product

`qlik_get_data_product_documentation` returns a single markdown document containing, per dataset: description, row/field counts, a **field table** (name, description, type, distinct values, nulls, sample values, quality, PII classification), **connection information** (host, database, schema, table), data freshness, and trust score. This is the primary input.

Also capture from the DP itself:
- `readMe` — often contains an explicit **Relationships** section and "Common analyses" (verified queries)
- `quality.validity` / `quality.completeness`
- `qlikTrustScore`
- `tags`, `activated`, the DP URL

> **Important:** Confirm the DP is Snowflake-backed.
> Check each dataset's `Connection information -> Source: snowflake` and that `HostName` matches your target account. If datasets are QVD-backed or point at another platform, **stop** — the data must be replicated into Snowflake first. Report which datasets are not Snowflake-resident rather than silently skipping them.

### Step 1b — Semantic Model or Inference? (Decide Before Modelling)

`qlik_get_data_product_semantic_model` returns `tables`, `relationships`, `measures` and `dimensions`. This step only **decides** where relationships, dimensions and metrics come from; Steps 2–6 then apply that decision. Which path you take depends on what the model holds:

| Semantic model state | Relationships | Dimensions and metrics |
|---|---|---|
| Relationships **and** measures/dimensions | Path A (ask the user) | Path A |
| Relationships only | Path A (ask the user) | Path B |
| Measures/dimensions only, no relationships | Path B | Path A |
| Empty or missing | Path B | Path B |

In the two mixed rows, follow each path for its own column and send the user **one** combined question: the Path A choice plus the Path B gaps.

Before reusing anything, check the model's coverage. A table, measure or dimension whose `state` is not `VALID` (or with `referencesInaccessibleTable` set) is not reusable: report it and treat it as missing. A Data Product dataset that has no table in the semantic model still becomes a logical table; infer its relationships as in Path B.

#### Path A — Reuse the semantic model

The steward has already modelled relationships, measures and dimensions. Do not throw that away, but do not copy it blindly either. A Qlik semantic model is shaped by the **associative engine**: every relationship becomes a shared field name, so the modeller has to avoid circular references and synthetic keys. That forces compromises a semantic view does not need, for example:

- A shared lookup table linked to only one parent (`NATION` describes the customer only, so supplier geography is missing).
- A composite key reduced to one field (`PARTSUPP` linked by `Part Key` only, not `(Part Key, Supplier Key)`), so measures cover every supplier of a part.
- Keys left unlinked on purpose (`S_NATIONKEY`, `PS_SUPPKEY` as plain fields).

Snowflake semantic views allow several relationship paths and composite keys, so these compromises can be fixed.

**1. Summarize the semantic model to the user**:
- the counts of tables, relationships, measures and dimensions
- every relationship as `CHILD(cols) -> PARENT(cols)` with its cardinality
- any **compromises you detect**, compared against the table keys and column names: unlinked `*KEY`/`*ID` columns, composite keys reduced to one field, lookup tables serving only one of several parents, `MANY_MANY`/`UNDEFINED` cardinality

**2. Ask once, before writing any DDL**:

> The data product has a semantic model with N relationships, M measures and D dimensions. Should I:
> 1. **Replicate it as-is**: same relationships, measures and dimensions, translated to Snowflake.
> 2. **Infer relationships from table keys and column names**: keep the semantic model's measures and dimensions, but rebuild the joins. This fixes the compromises listed above, e.g. a composite `LINEITEM -> PARTSUPP` key and a separate supplier nation path.

Recommend option 2 when you found compromises, and option 1 when the model matches the keys. Wait for the answer: the choice changes which joins exist, so every metric total depends on it.

**3. Translate the semantic model to the semantic view** (in Steps 3–6, after the case check in Step 2):

| Semantic model | Semantic view |
|---|---|
| `tables[].name` | Logical table (physical source from the dataset's connection info, Step 1) |
| `tables[].fields[].name` | Physical column name. Do not use `effectiveName`/`qlikAppFieldName`: those are Qlik app aliases (`Order Key`), not physical columns (`L_ORDERKEY`). On a quoted-case source (Step 2), use the uppercase alias from the aliasing subquery instead |
| `relationships[]` with cardinality `MANY_ONE` | `from` = child, `to` = parent: `<FROM>_TO_<TO> AS FROM(cols) REFERENCES TO(cols)`. Map `fieldIds` to the field `name`s |
| `ONE_MANY` | Swap the direction: the `to` side is the child |
| `ONE_ONE` | Either direction; the referenced side must have a primary key |
| `MANY_MANY` / `UNDEFINED` | Do not declare it. Ask the user for the bridge table or the real key |
| Relationship `description` | A note in the child table's `COMMENT` (relationships take no comment of their own) |
| Measure `sql` expression | Metric `expr`. Qlik stores expressions without validating them, so check that every column exists, and on a quoted-case source rewrite the column names to the uppercase aliases |
| Measure or dimension with only a `qlik` expression | Translate it (rules below), then show the translation to the user |
| Measure `description` | Metric `COMMENT`. Lift any `Synonyms: …` list into `WITH SYNONYMS` |
| Measure/dimension `tags`, `path` | Not carried. Use them only to group items in the summary |
| Measure `format` | Not carried; semantic views have no display format |
| Dimension with a plain column expression | `dimensions` entry on the table that owns the column |
| Dimension with a computed expression (`CASE`, `YEAR(...)`) | Named `dimensions` entry with that `sql` expression; date-derived ones are time dimensions |

**Qlik-to-SQL translation** (only for measures and dimensions with no `sql` dialect):
- `Sum`/`Avg`/`Count`/`Min`/`Max` map to their SQL equivalents. `Count(DISTINCT [Order Key])` becomes `COUNT(DISTINCT O_ORDERKEY)`: replace each Qlik field name with the physical column on the **owning table**.
- Set analysis `Sum({<F={'R'}>} X)` becomes `SUM(CASE WHEN F = 'R' THEN X ELSE 0 END)`, and `{<F={"PROMO*"}>}` becomes `CASE WHEN F LIKE 'PROMO%' …`.
- `If(a > b, 1, 0)` becomes `CASE WHEN a > b THEN 1 ELSE 0 END`.
- Ratios become `numerator / NULLIF(denominator, 0)`.
- Dimension functions: `Year(d)` becomes `YEAR(d)`, `MonthName(d)` becomes `DATE_TRUNC(MONTH, d)`, `Pick(Match(F, 'A', 'B'), 'x', 'y')` becomes `CASE F WHEN 'A' THEN 'x' WHEN 'B' THEN 'y' END`, `SubField(F, ' ', n)` becomes `SPLIT_PART(F, ' ', n)`.
- `Aggr()`, `Above()`, `RangeSum()`, `$(...)` expansion, and set modifiers that clear selections (`{1}`, `{<F=>}`) have no direct equivalent. Report these to the user and leave them out; a guessed translation would produce a metric that looks governed but is not.

**Placing a metric on a table**: a metric lives on the table that owns its grain (Step 5). If a semantic model measure mixes columns from two tables (e.g. a `LINEITEM` amount filtered by `PART.P_TYPE`), flag it. Then either define it on the fact table using the related table's dimension, if the dry run in Step 10 accepts it, or ask the user how to handle it.

**When sources disagree**: if a semantic model measure and a glossary measure term have the same name but different formulas, show both formulas and ask which wins. Do not merge them, and do not pick one silently.

#### Path B — Infer what the semantic model does not give

Work through Steps 2–6 to draft the classification, metrics and relationships, but do not create the view yet. For relationships, use these sources in order:
1. the `readMe` Relationships section
2. FK wording in field descriptions ("Foreign key reference to X")
3. glossary `entity` terms
4. key and column-name matching: shared prefixes or stems (`O_CUSTKEY` ↔ `C_CUSTKEY`, `OrderID` ↔ `OrderID`), validated with row counts and uniqueness queries

Once the draft is complete, and before Step 7, **confirm the important gaps in one consolidated question**, not one at a time. Ask only about decisions that change results:

- **Unprovable relationships**: a candidate join whose key is not unique on the parent, or whose match rate is low.
- **Composite keys**: whether `LINEITEM -> PARTSUPP` should be `(PARTKEY, SUPPKEY)`.
- **Role-playing lookups**: one table serving several parents (`NATION` for customer and supplier), and whether to add a second path or an aliased logical table.
- **Ambiguous measures**: several plausible definitions (gross vs discounted vs taxed revenue) and no glossary term to settle it.
- **No glossary at all**: present the conservative baseline metrics from Step 5 and ask which business measures to add.
- **Grain risks**: a numeric on a header table (`O_TOTALPRICE`) that will be double-counted if summed against line-level dimensions.

State each assumption you will make if the user does not answer, so they can just approve. Do not ask about anything the data already settles (validated keys, obvious dimensions, descriptions the steward wrote).

### Step 2 — Case Check (Non-Negotiable)

Read the physical `Database`/`Schema`/`Table` from each dataset's connection info and inspect the real columns:

```sql
DESCRIBE TABLE <DB>."<schema>"."<table>";
```

Two outcomes drive the whole DDL shape:

| Source shape | Example | Table definition strategy |
|---|---|---|
| **Quoted-case** (lower/mixed) | `SUMMIT."silver_layer2"."customers"`, column `"CustomerID"` | `base_table.definition` subquery aliasing **every** column to unquoted uppercase |
| **Default-case** (already upper) | `ANALYTICS_DB.PUBLIC.CUSTOMER`, column `C_CUSTKEY` | Reference the table directly |

Qlik Agentic Pipeline / onboarding layers almost always produce **quoted-case** output — assume quoted until proven otherwise.

> **Danger:** Never quote identifiers directly in expressions.
> Wrapping `expr`/`primary_key`/relationship columns in escaped double quotes works for `SELECT ... FROM SEMANTIC_VIEW(...)` but **permanently breaks Cortex Analyst, Agents, and Snowsight suggestions** for that view, with no YAML-level fix (error 392700: `invalid column name`). Always use the aliasing subquery instead.

### Step 3 — Map DP Constructs to Semantic View Constructs

| Qlik Data Product | Snowflake Semantic View |
|---|---|
| Dataset | Logical table in `tables (...)` |
| Dataset description | Table `comment` (trim to one sentence) |
| Connection info DB/schema/table | Physical source or subquery `FROM` target |
| Field | `dimensions`, `facts`, or time dimension |
| Field description | Column `comment` — use verbatim when present |
| Field with 100% distinct = row count | `primary key` candidate (validate uniqueness + non-null before declaring) |
| FK described as "Foreign key reference to X" | `relationships` entry |
| Semantic model relationships, measures, dimensions | `relationships`, `metrics`, `dimensions` (Path A, Step 1b) |
| `readMe` Relationships section | `relationships (...)` — first source when inferring (Path B, or Path A option 2) |
| Glossary measure term (tagged `measure`, or filed under a metrics/KPI category) | `metrics (...)` entry |
| Glossary measure description formula | The metric `expr` |
| Glossary term tagged `entity`+`fact` | Fact table — numerics become `facts` |
| Glossary term tagged `entity`+`dimension` | Dimension table — attributes become `dimensions` |
| Glossary term tagged `entity`+`bridge` | Bridge table — composite `primary key` |
| DATE / TIMESTAMP fields | `time_dimensions` in the `CA` extension |
| PII classification | Note in the column `comment`; consider masking policy |
| "Common analyses" / "Typical use" | `AI_VERIFIED_QUERIES` |
| Trust score, validity, DP URL | Semantic view `comment` (provenance) |

### Step 4 — Classify Every Field

Apply in order:

1. **Foreign key** (references another table, values may repeat) — `dimensions` + a `relationships` entry. Never a `primary key` on the referencing table (e.g. `ORDER_DETAILS.OrderID` repeats for multi-line orders).
2. **Validated key** — `dimensions`, and `primary key` on its own table. A `*ID` / `*KEY` name is only a hint: declare the primary key only after the complete key tuple is proven unique and non-null, e.g. `SELECT COUNT(*) = COUNT(DISTINCT OrderID, ProductID) AND COUNT_IF(OrderID IS NULL OR ProductID IS NULL) = 0 FROM ORDER_DETAILS;`. Bridge tables usually need a composite key (`ORDER_DETAILS` → `(OrderID, ProductID)`).
3. **DATE / TIMESTAMP** — `dimensions`, registered as `time_dimensions` in the `CA` extension
4. **Numeric that is really a code or flag** (`Discontinued`, `ShipVia`, `O_SHIPPRIORITY`; low cardinality or enumerated meaning, summing it is meaningless) — `dimensions`, not facts. Check this before the fact rule.
5. **Numeric amount or quantity** (quantity, price, discount, tax, freight, balance, cost, stock level) — `facts`, on whichever table holds it. On a dimension or header table (`C_ACCTBAL`, `P_RETAILPRICE`, `O_TOTALPRICE`) it is still a fact, but say in its comment that it repeats per child row, so it must be averaged or summed at its own grain only
6. **Everything else** — `dimensions`
7. **Exclude entirely**: free-text `*_COMMENT`/`Notes` blobs, `Picture`/`Photo` file names, `Description` on large tables. They add tokens and no analytical value. Keep short descriptive text on small dimension tables (e.g. `CATEGORIES.DESCRIPTION`, 8 rows).

> **Warning:** Ignore Qlik's semantic type inference.
> Qlik's profiler guesses semantic types and is frequently wrong: `S_SUPPKEY` and `OrderID` inferred as *Zip Code*, `O_ORDERSTATUS` and `L_LINESTATUS` as *Gender (PII)*, `L_RETURNFLAG` as *Yes/No*, `R_NAME` as *Continent* with 20% "invalid". Use the **declared base type** (INTEGER, DOUBLE, DATE, STRING) for classification and treat semantic types as a weak hint only. Never propagate a bogus PII classification into the semantic view.

### Step 5 — Derive Metrics

Sources, in order of precedence:

1. **Semantic model measures** (Path A): each becomes one metric, translated as in Step 1b.
2. **Glossary measure terms**: each term tagged `measure`, or filed under a metrics/KPI category, that the semantic model does not already cover becomes exactly one metric, with the formula lifted from its description. On Path B this is the starting point. If a glossary term and a semantic model measure share a name but not a formula, ask the user (Step 1b).
3. **Baseline metrics**, only when neither source exists (below).

Preserve the distinction between similar measures — do not collapse them.

Worked example from the TPC-H glossary:

| Glossary term | Description formula | Metric |
|---|---|---|
| Revenue | Gross, sum of extended price | `LINEITEM.REVENUE as SUM(L_EXTENDEDPRICE)` |
| Discounted Revenue | `SUM(L_EXTENDEDPRICE * (1 - L_DISCOUNT))` | `LINEITEM.DISCOUNTED_REVENUE as SUM(L_EXTENDEDPRICE * (1 - L_DISCOUNT))` |
| Order Total Price | `ORDERS.O_TOTALPRICE` aggregated | `ORDERS.TOTAL_ORDER_PRICE as SUM(O_TOTALPRICE)` |
| Quantity | `SUM(L_QUANTITY)` | `LINEITEM.TOTAL_QUANTITY as SUM(L_QUANTITY)` |

When there is **no semantic model measure and no glossary**, add a conservative baseline per table — a count on each entity plus the obvious additive sums — and derive revenue from line-item columns:

```
ORDER_DETAILS.TOTAL_REVENUE AS SUM(UNITPRICE * QUANTITY * (1 - DISCOUNT))
```

Always define metrics on the table owning the grain. Never place a line-item sum on the order header.

### Step 6 — Build Relationships

Source of relationships:
- **Path A, option 1 (replicate):** the semantic model's relationships, translated as in Step 1b.
- **Path A, option 2 and Path B:** the four sources listed under Path B in Step 1b, in that order (`readMe` Relationships block, FK field descriptions, glossary `entity` terms, key and column-name matching). On option 2, compare the result with the semantic model, and list every relationship you added, changed or dropped in the final summary.

Name them `<CHILD>_TO_<PARENT>` for readability. Direction is always **child references parent**.

Composite keys are declared as a tuple:

```sql
LINEITEM(L_PARTKEY, L_SUPPKEY) REFERENCES PARTSUPP(PS_PARTKEY, PS_SUPPKEY)
```

Check row counts before declaring a relationship — a "1:many" that is actually many:many will fan out and inflate every metric. Validate with a quick count comparison rather than trusting the documentation.

### Step 7 — Assemble the DDL

Abridged Northwind example (the `ORDERS` table referenced in `RELATIONSHIPS` is omitted for brevity; a real view must define every table it relates):

```sql
CREATE OR REPLACE SEMANTIC VIEW <DB>.<SCHEMA>.<NAME>
  TABLES (
    CUSTOMERS AS (
      SELECT
        "CustomerID"  AS CUSTOMERID,
        "CompanyName" AS COMPANYNAME,
        "Country"     AS COUNTRY
      FROM SUMMIT."silver_layer2"."customers"
    ) PRIMARY KEY (CUSTOMERID)
      COMMENT = 'Customer company profiles for Northwind Traders.',
    ORDER_DETAILS AS (
      SELECT
        "odID"      AS ODID,
        "OrderID"   AS ORDERID,
        "ProductID" AS PRODUCTID,
        "UnitPrice" AS UNITPRICE,
        "Quantity"  AS QUANTITY,
        "Discount"  AS DISCOUNT
      FROM SUMMIT."silver_layer2"."order_details"
    ) PRIMARY KEY (ODID)
      COMMENT = 'Line-item detail for each customer order.'
  )
  RELATIONSHIPS (
    ORDERS_TO_CUSTOMERS AS ORDERS(CUSTOMERID) REFERENCES CUSTOMERS(CUSTOMERID),
    ORDER_DETAILS_TO_ORDERS AS ORDER_DETAILS(ORDERID) REFERENCES ORDERS(ORDERID)
  )
  FACTS (
    ORDER_DETAILS.QUANTITY  AS QUANTITY  COMMENT = 'Quantity of the product ordered.',
    ORDER_DETAILS.UNITPRICE AS UNITPRICE COMMENT = 'Unit price at time of sale.',
    ORDER_DETAILS.DISCOUNT  AS DISCOUNT  COMMENT = 'Discount applied to the line item.'
  )
  DIMENSIONS (
    CUSTOMERS.CUSTOMERID  AS CUSTOMERID  COMMENT = 'Unique customer identifier.',
    CUSTOMERS.COMPANYNAME AS COMPANYNAME COMMENT = 'Customer company name.',
    CUSTOMERS.COUNTRY     AS COUNTRY     COMMENT = 'Customer country.'
  )
  METRICS (
    ORDER_DETAILS.TOTAL_REVENUE AS SUM(UNITPRICE * QUANTITY * (1 - DISCOUNT))
      WITH SYNONYMS = ('revenue', 'sales')
      COMMENT = 'Total revenue for order line items after discount.'
  )
  COMMENT = 'Conformed Northwind Traders data model. Source Qlik data product: **AI-Ready Data Product** - https://<tenant>.qlikcloud.com/data-product/<data-product-id> - data quality/trust score continuously monitored by Qlik Cloud (current trust score: 99.62/100). Physical source tables: SUMMIT."silver_layer2".*'
```

Clause order inside each fact, dimension and metric entry is fixed: `<table>.<name> AS <expr> WITH SYNONYMS = ('a', 'b') COMMENT = '...'`. Putting `WITH SYNONYMS` before `AS` is a syntax error (`unexpected 'WITH'`).

### Step 8 — Preserve Provenance

The semantic view `comment` must carry, at minimum:
- Qlik Data Product name and clickable URL
- Current trust score and the fact that Qlik monitors it continuously
- Physical source schema, and the upstream layer it was loaded from

This is what makes the view defensible in a governance review: an auditor can trace any Cortex Analyst answer back to a governed, quality-monitored Qlik data product.

### Step 9 — Add Verified Queries

Turn each "Common analyses" bullet into an `AI_VERIFIED_QUERIES` entry. In DDL this is a trailing clause of `CREATE SEMANTIC VIEW`, after `COMMENT`. If the `readMe` has no such section, write one verified query per fact table from the metrics and dimensions you defined, and say that they are yours, not the steward's.

> **Important:** Always fully qualify the view name inside verified query SQL.
> `SEMANTIC_VIEW(<DB>.<SCHEMA>.<VIEW> ...)` — never the bare name. An unqualified reference passes verify-only validation and works in a session with a current database, then fails when Snowsight validates the saved model: `Cannot perform SELECT. This session does not have a current database.`

```sql
AI_VERIFIED_QUERIES (
  TOTAL_REVENUE_BY_CATEGORY AS (
    QUESTION 'What is the total revenue by product category?'
    ONBOARDING_QUESTION false
    SQL 'SELECT * FROM SEMANTIC_VIEW(
           SUMMIT.PUBLIC.AI_READY_NORTHWIND
           DIMENSIONS categories.CATEGORYNAME
           METRICS order_details.TOTAL_REVENUE )'
  )
)
```

### Step 10 — Validate and Verify

1. **Dry run** — when going through YAML, call the stored procedure with the fully qualified target schema, the YAML string, and `verify_only = TRUE` (validates without creating the view): `CALL SYSTEM$CREATE_SEMANTIC_VIEW_FROM_YAML('SUMMIT.PUBLIC', $$<yaml>$$, TRUE);`. Skip `reflect_semantic_model` for quoted-case sources; it reports false failures.
2. **Create** the view.
3. **Query it directly** — one metric crossed with one dimension per fact table.
4. **Compare against the source** — the metric total from the semantic view must match a plain `SUM` against the physical table. This is what catches join fan-out.
5. **Test natural language** — `call_cortex_analyst` against the created view. If this errors with `invalid column name` (392700), Step 2 was done wrong.
6. **Confirm the `CA` extension** registered time dimensions, so date filtering and time-series questions work.

## Deliverable Checklist

- [ ] Target `<DB>.<SCHEMA>.<VIEW_NAME>` confirmed with the user
- [ ] Current role has `CREATE SEMANTIC VIEW` on the target schema and `SELECT` on the sources
- [ ] Semantic model checked; the user chose replicate or infer (Path A), or confirmed the inferred gaps (Path B)
- [ ] Physical column names used everywhere, never Qlik `effectiveName` aliases
- [ ] Qlik-only measures and dimensions translated to SQL and shown to the user; untranslatable ones reported
- [ ] Every Snowflake-backed DP dataset present as a logical table
- [ ] Quoted-case handled via aliasing subqueries, not escaped quotes
- [ ] Every table has a comment, and every table referenced by a relationship has a validated (unique, non-null) primary key
- [ ] Steward-written field descriptions carried into column comments
- [ ] Every semantic model measure and every glossary measure term has a matching metric; formula conflicts between the two were settled by the user
- [ ] Metric names match the semantic model measure or glossary term they implement
- [ ] Relationships validated against row counts, not just documentation
- [ ] Date fields registered as time dimensions
- [ ] Provenance comment with DP URL and trust score
- [ ] Verified queries present, view name fully qualified
- [ ] Metric totals reconcile against the physical tables
- [ ] Cortex Analyst answers a natural-language question end to end
