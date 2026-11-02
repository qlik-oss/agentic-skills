---
name: qlik-dp-to-semantic-view
description: >-
  Convert a Qlik Talend Cloud Data Product into a Snowflake Semantic View, preserving
  governed metadata (descriptions, glossary definitions, relationships, trust scores) as
  semantic-view comments, metrics and relationships. Use for "convert data product to
  semantic view", "make this data product AI-ready in Snowflake", "build a semantic view
  from Qlik", "qlik dp to semantic view". Requires the Qlik MCP server and Snowflake SQL access.
license: Apache-2.0
metadata:
  author: cleveranjos
  version: 1.0.0
  tags:
    - qlik
    - snowflake
    - semantic-view
    - data-products
    - cortex-analyst
---

# Qlik Data Product to Snowflake Semantic View

Convert a Qlik Talend Cloud Data Product into a Snowflake semantic view, end to end, preserving governed metadata (descriptions, glossary definitions, trust scores) as first-class semantic metadata.

**Trigger:** "convert data product to semantic view", "make this data product AI-ready in Snowflake", "build a semantic view from Qlik", "qlik dp to semantic view"

## Why This Works

A Qlik Data Product already contains almost everything a semantic view needs — curated dataset selection, human-written table and field descriptions, profiled types, PII classification, relationship documentation, business glossary terms, and continuously monitored trust scores. The conversion is a **metadata translation**, not a modelling exercise. Do not re-invent descriptions the data steward already wrote.

## Inputs Required

Only one: the **Data Product ID** (or a name to resolve). Everything else is derived.

```
mcp_qlik_qlik_search(query="<name>", resourceType="dataProduct")
mcp_qlik_qlik_get_data_product(dataProductId="<id>")
mcp_qlik_qlik_get_data_product_documentation(dataProductId="<id>")   # richest source — always call
```

If the DP has a glossary, export it in full:

```
mcp_qlik_qlik_search(query="<glossary name>", resourceType="glossary")
mcp_qlik_qlik_get_full_glossary_export(glossaryId="<id>")
```

## Workflow

### Step 1 — Harvest the Data Product

`get_data_product_documentation` returns a single markdown document containing, per dataset: description, row/field counts, a **field table** (name, description, type, distinct values, nulls, sample values, quality, PII classification), **connection information** (host, database, schema, table), data freshness, and trust score. This is the primary input.

Also capture from the DP itself:
- `readMe` — often contains an explicit **Relationships** section and "Common analyses" (verified queries)
- `quality.validity` / `quality.completeness`
- `qlikTrustScore`
- `tags`, `activated`, the DP URL

> **Important:** Confirm the DP is Snowflake-backed.
> Check each dataset's `Connection information -> Source: snowflake` and that `HostName` matches your target account. If datasets are QVD-backed or point at another platform, **stop** — the data must be replicated into Snowflake first. Report which datasets are not Snowflake-resident rather than silently skipping them.

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
| Field with 100% distinct = row count | `primary key` candidate |
| FK described as "Foreign key reference to X" | `relationships` entry |
| `readMe` Relationships section | `relationships (...)` — authoritative when present |
| Glossary term tagged `measure` | `metrics (...)` entry |
| Glossary measure description formula | The metric `expr` |
| Glossary term tagged `entity`+`fact` | Fact table — numerics become `facts` |
| Glossary term tagged `entity`+`dimension` | Dimension table — attributes become `dimensions` |
| Glossary term tagged `entity`+`bridge` | Bridge table — composite `primary key` |
| DATE / TIMESTAMP fields | `time_dimensions` in the `CA` extension |
| PII classification | Note in the column `comment`; consider masking policy |
| "Common analyses" / "Typical use" | `ai_verified_queries` |
| Trust score, validity, DP URL | Semantic view `comment` (provenance) |

### Step 4 — Classify Every Field

Apply in order:

1. **Key** (`*ID`, `*KEY`, distinct count == row count) — `dimensions`, and `primary key` on its own table
2. **Foreign key** — `dimensions` + a `relationships` entry
3. **DATE / TIMESTAMP** — `dimensions`, registered as `time_dimensions` in the `CA` extension
4. **Numeric on a fact/bridge table** (quantity, price, discount, tax, freight, balance, cost, stock level) — `facts`
5. **Numeric that is really a code or flag** (`Discontinued`, `ShipVia`, `O_SHIPPRIORITY`) — `dimensions`, not facts
6. **Everything else** — `dimensions`
7. **Exclude entirely**: free-text `*_COMMENT`/`Notes` blobs, `Picture`/`Photo` file names, `Description` on large tables. They add tokens and no analytical value. Keep short descriptive text on small dimension tables (e.g. `CATEGORIES.DESCRIPTION`, 8 rows).

> **Warning:** Ignore Qlik's semantic type inference.
> Qlik's profiler guesses semantic types and is frequently wrong: `S_SUPPKEY` and `OrderID` inferred as *Zip Code*, `O_ORDERSTATUS` and `L_LINESTATUS` as *Gender (PII)*, `L_RETURNFLAG` as *Yes/No*, `R_NAME` as *Continent* with 20% "invalid". Use the **declared base type** (INTEGER, DOUBLE, DATE, STRING) for classification and treat semantic types as a weak hint only. Never propagate a bogus PII classification into the semantic view.

### Step 5 — Derive Metrics

**Glossary measures are authoritative.** Each term tagged `measure` becomes exactly one metric, with the formula lifted from its description. Preserve the distinction between similar measures — do not collapse them.

Worked example from the TPC-H glossary:

| Glossary term | Description formula | Metric |
|---|---|---|
| Revenue | Gross, sum of extended price | `LINEITEM.REVENUE as SUM(L_EXTENDEDPRICE)` |
| Discounted Revenue | `SUM(L_EXTENDEDPRICE * (1 - L_DISCOUNT))` | `LINEITEM.DISCOUNTED_REVENUE as SUM(L_EXTENDEDPRICE * (1 - L_DISCOUNT))` |
| Order Total Price | `ORDERS.O_TOTALPRICE` aggregated | `ORDERS.TOTAL_ORDER_PRICE as SUM(O_TOTALPRICE)` |
| Quantity | `SUM(L_QUANTITY)` | `LINEITEM.TOTAL_QUANTITY as SUM(L_QUANTITY)` |

When there is **no glossary**, add a conservative baseline per table — a count on each entity plus the obvious additive sums — and derive revenue from line-item columns:

```
ORDER_DETAILS.TOTAL_REVENUE as SUM(UNITPRICE * QUANTITY * (1 - DISCOUNT))
```

Always define metrics on the table owning the grain. Never place a line-item sum on the order header.

### Step 6 — Build Relationships

Prefer the `readMe` Relationships block when present; otherwise infer from FK field descriptions. Name them `<CHILD>_TO_<PARENT>` for readability. Direction is always **child references parent**.

Composite keys are declared as a tuple:

```sql
LINEITEM(L_PARTKEY, L_SUPPKEY) references PARTSUPP(PS_PARTKEY, PS_SUPPKEY)
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
      COMMENT = 'Total revenue for order line items after discount.'
  )
  COMMENT = 'Conformed Northwind Traders data model. Source Qlik data product: **AI-Ready Data Product** - https://<tenant>.qlikcloud.com/data-product/<data-product-id> - data quality/trust score continuously monitored by Qlik Cloud (current trust score: 99.62/100). Physical source tables: SUMMIT."silver_layer2".*'
```

### Step 8 — Preserve Provenance

The semantic view `comment` must carry, at minimum:
- Qlik Data Product name and clickable URL
- Current trust score and the fact that Qlik monitors it continuously
- Physical source schema, and the upstream layer it was loaded from

This is what makes the view defensible in a governance review: an auditor can trace any Cortex Analyst answer back to a governed, quality-monitored Qlik data product.

### Step 9 — Add Verified Queries

Turn each "Common analyses" bullet into an `ai_verified_queries` entry.

> **Important:** Always fully qualify the view name inside verified query SQL.
> `SEMANTIC_VIEW(<DB>.<SCHEMA>.<VIEW> ...)` — never the bare name. An unqualified reference passes verify-only validation and works in a session with a current database, then fails when Snowsight validates the saved model: `Cannot perform SELECT. This session does not have a current database.`

```sql
ai_verified_queries (
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

1. **Dry run** — `SELECT SYSTEM$CREATE_SEMANTIC_VIEW_FROM_YAML(<yaml>, TRUE);` when going through YAML. Skip `reflect_semantic_model` for quoted-case sources; it reports false failures.
2. **Create** the view.
3. **Query it directly** — one metric crossed with one dimension per fact table.
4. **Compare against the source** — the metric total from the semantic view must match a plain `SUM` against the physical table. This is what catches join fan-out.
5. **Test natural language** — `call_cortex_analyst` against the created view. If this errors with `invalid column name` (392700), Step 2 was done wrong.
6. **Confirm the `CA` extension** registered time dimensions, so date filtering and time-series questions work.

## Deliverable Checklist

- [ ] Every Snowflake-backed DP dataset present as a logical table
- [ ] Quoted-case handled via aliasing subqueries, not escaped quotes
- [ ] Every table has a primary key and a comment
- [ ] Steward-written field descriptions carried into column comments
- [ ] Every glossary `measure` term has a matching metric with the glossary's own formula
- [ ] Metric names match the glossary term they implement
- [ ] Relationships validated against row counts, not just documentation
- [ ] Date fields registered as time dimensions
- [ ] Provenance comment with DP URL and trust score
- [ ] Verified queries present, view name fully qualified
- [ ] Metric totals reconcile against the physical tables
- [ ] Cortex Analyst answers a natural-language question end to end
