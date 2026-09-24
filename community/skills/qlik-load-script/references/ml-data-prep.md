# ML Data Preparation for Qlik Predict — Guidelines, Template & Example

Read this when the task is preparing a dataset for a Qlik Predict experiment. Regardless of task type, also read [writing-scripts.md](writing-scripts.md) before the first `LOAD`, [syntax-and-patterns.md](syntax-and-patterns.md) while writing, and [verification-checklist.md](verification-checklist.md) once the script is written.

## Table of Contents
1. Common data sources
2. Feature engineering philosophy
3. Output structure for Qlik Predict
4. Target column requirements
5. Feature count and field retention
6. Date format convention
6a. The final feature matrix must be an explicit LOAD
6b. Feature Definitions QVD
7. Train/test split approaches
8. Target leakage checklist
9. Class imbalance
10. Final cleanup checklist
11. Script template
12. Worked example

---

## 1. Common data sources
Starting scripts typically load from **CSV** or **QVD** files via `lib://` connections. Match the source format and lib path used in the starting script. When loading CSV files, always specify the format explicitly:
```qlik
FROM [lib://DataFiles/data.csv] (txt, codepage is utf8, embedded labels, delimiter is ',');
```

---

## 2. Feature engineering philosophy
Apply your **data science and ML knowledge** to engineer features that are likely to have genuine predictive signal for the specific use case. Aim for impact over exhaustiveness — a focused set of well-reasoned features is better than a sprawling feature matrix that adds noise. Consider domain context, known drivers from the literature, and the business logic behind the prediction task when choosing what to derive.

---

## 3. Output structure for Qlik Predict
Qlik Predict expects a **flat, single-table dataset**:
- One row = one observation at the defined grain (e.g., one customer, one loan, one month-region).
- One column = the **target** (what you are predicting).
- Remaining columns = **features** (inputs to the model).
- Supported output: QVD (preferred), CSV, XLSX, Parquet.

An ML prep script therefore produces **three** outputs: `training_data.qvd`, `testing_data.qvd`, and `feature_definitions.qvd` (the business-facing data dictionary — see [§6b](#6b-feature-definitions-qvd)).

---

## 4. Target column requirements

| Experiment Type | Target Requirement |
|---|---|
| Binary classification | Exactly 2 unique values (e.g., `Yes`/`No`, `1`/`0`, `Churn`/`Active`) |
| Multiclass classification | 3–10 unique categorical values |
| Regression | Numeric with >10 unique values |
| Time series | Numeric target + date index column + optional group columns (max 2) |

---

## 5. Feature count and field retention
- **Aim for impactful features** without overcomplicating the feature matrix. Focus on features with clear predictive signal rather than exhaustively deriving every possible combination. Use your data science and ML knowledge to prioritise features that are likely to matter for the specific use case.
- **Always retain ID/key fields** (e.g., CustomerID, LoanID, PolicyNumber). These are not used as features during training, but they are essential for linking predictions back to the original data after model deployment. Qlik Predict will ignore high-cardinality identifiers automatically — keeping them in the dataset does no harm.
- Remove fields that are direct derivatives or consequences of the target (leakage).

---

## 6. Date format convention
Date fields should be stored in **YYYY-MM-DD** format (ISO 8601) for reliability across Qlik environments. Qlik Predict automatically derives date dimensions (year, month, day of week, quarter, etc.) from fields it profiles as dates, so you generally do **not** need to manually decompose dates into separate year/month/day columns. Focus manual date engineering on features Qlik Predict cannot auto-derive: date differences, durations, and domain-specific periods.

```qlik
// Format dates as YYYY-MM-DD for reliable interpretation
Date(Date#(RawDateField, 'DD/MM/YYYY'), 'YYYY-MM-DD') as EventDate,
// Manual date engineering — only for features Qlik Predict won't auto-derive
Today() - Date#(RawDateField, 'DD/MM/YYYY') as DaysSinceEvent
```

---

## 6a. The final feature matrix must be an explicit LOAD

Intermediate tables may use `LOAD *`. **The final feature matrix must not.** It is the deliverable — the user reads it to understand what the model is being given, and selects fields from it in Qlik Predict. `LOAD *` hides the structure and makes the column set an accident of upstream code.

Requirements for the final assembly LOAD:
- **List every field explicitly**, one per line.
- **Comment every field** with a short description of what it means — units, grain, and time window where relevant. This is the data dictionary; it should stand alone without cross-referencing the upstream logic.
- **Group fields logically** with a banner comment per group — identifiers, target, then feature families (e.g. demographics, behavioural, monetary, temporal). Grouping is what makes field selection in Qlik Predict manageable.
- **Order groups meaningfully:** identifiers first, target next (so it is impossible to miss), features after.
- Align the `as` aliases and trailing comments so the block reads as a table.

```qlik
///$tab Final Assembly
// Final feature matrix — one row per customer, as at the observation date.
// Explicit field list: this is the data dictionary for the Qlik Predict experiment.

FeatureMatrix:
NoConcatenate
LOAD
    // --- Identifiers (excluded from training; used to join predictions back) ---
    CustomerID,                                 // Primary key from the CRM
    Region,                                     // Sales region at observation date

    // --- Target ---
    Churn_Flag,                                 // 1 = cancelled within 90 days of observation date

    // --- Tenure & demographics ---
    TenureMonths,                               // Whole months from SignupDate to observation date
    AgeYears,                                   // Age at observation date
    PlanTier,                                   // Bronze / Silver / Gold at observation date

    // --- Transaction behaviour (trailing 12 months) ---
    TxnCount,                                   // All transactions, including zero-value
    UniqueCategories,                           // Distinct product categories purchased
    DaysSinceLastTxn,                           // Recency; null-safe, capped at 365

    // --- Monetary (trailing 12 months, local currency) ---
    TotalSpend,
    AvgTxnValue,                                // TotalSpend / TxnCount; 0 where TxnCount = 0
    ReturnedShare,                              // Returned value as a share of TotalSpend, 0–1

    // --- Engagement trend ---
    SpendTrend_3v12                             // Mean monthly spend last 3m / last 12m; >1 = accelerating

RESIDENT FeatureBuild;

DROP TABLE FeatureBuild;
```

Fields whose meaning is fully carried by the name (`TotalSpend`) need no comment; the ones that hide a decision — a window, a cap, a null convention, a denominator — always do. If you find you cannot write a one-line description of a feature, that is a signal the feature is not well-defined enough to include.

This field list is also the source for the [Feature Definitions QVD](#6b-feature-definitions-qvd) — build that immediately after, from this list.

---

## 6b. Feature Definitions QVD

Every ML prep script must also output a **Feature Definitions QVD** alongside the training/testing files. It is a small INLINE table — one row per field in the final feature matrix — that documents the dataset for business consumers.

**Intended use:** loading into business-facing Qlik Sense apps, so that a user looking at a prediction can see what each driver actually means. **The audience has no ML background.** Write for a business reader, not for the data scientist who built the model.

### Structure

| Field | Contents |
|---|---|
| `FeatureName` | Field name exactly as it appears in the feature matrix — this is the join key back to the model output |
| `DataType` | Plain-English type: `Text`, `Number`, `Integer`, `Currency`, `Percentage`, `Date`, `Flag` |
| `FeatureCategory` | Domain-specific grouping — mirror the groups used in the final matrix (§6a) so the two stay consistent |
| `FeatureDescription` | One sentence, business language, explaining what the field measures |

### Writing the descriptions

- **Plain business English.** No ML jargon: no "feature", "encoded", "normalised", "cardinality", "lag", "leakage", "one-hot".
- **One sentence, present tense, no field-name echo.** `SpendTrend_3v12` → "Compares the customer's average monthly spend over the last 3 months against the last 12 months. Above 1 means spending is increasing." — not "Ratio of 3-month to 12-month spend feature."
- **State the unit and time window** in words the reader already uses: "in the last 12 months", "in pounds", "as a percentage of total orders".
- **Explain what values mean** where it isn't obvious — especially flags (`1 = the customer cancelled`), ratios, and capped or defaulted values.
- **Say why it matters** only if it isn't self-evident and can be said in a short clause.
- Keep each description to roughly one line. If it needs a paragraph, the field name is probably wrong.

### Pattern

```qlik
///$tab Feature Definitions
// Business-facing data dictionary for the feature matrix. Consumed by the
// Qlik Sense app that presents predictions — descriptions are written for
// business users, not data scientists.
// Keep in sync with the final feature matrix in Final Assembly.

FeatureDefinitions:
LOAD * INLINE [
FeatureName|DataType|FeatureCategory|FeatureDescription
CustomerID|Text|Identifier|Unique reference for the customer, used to match predictions back to the customer record.
Region|Text|Identifier|The sales region the customer belonged to at the point the data was taken.
Churn_Flag|Flag|Outcome|Whether the customer cancelled within 90 days. 1 means they cancelled, 0 means they stayed.
TenureMonths|Integer|Customer Profile|How many complete months the customer has been with us.
AgeYears|Integer|Customer Profile|The customer's age in years.
PlanTier|Text|Customer Profile|The customer's subscription level: Bronze, Silver or Gold.
TxnCount|Integer|Purchasing Activity|Number of purchases the customer made in the last 12 months.
UniqueCategories|Integer|Purchasing Activity|How many different product categories the customer bought from in the last 12 months. A wider spread usually indicates a more engaged customer.
DaysSinceLastTxn|Integer|Purchasing Activity|Days since the customer's most recent purchase. Customers with no purchases in the last year are shown as 365.
TotalSpend|Currency|Spending|Total amount the customer spent in the last 12 months.
AvgTxnValue|Currency|Spending|Average value of each purchase over the last 12 months. Shown as 0 where the customer made no purchases.
ReturnedShare|Percentage|Spending|The share of the customer's spend that was returned, from 0% to 100%.
SpendTrend_3v12|Number|Spending|Compares average monthly spend over the last 3 months against the last 12 months. Above 1 means spending is increasing, below 1 means it is falling.
] (delimiter is '|');

STORE FeatureDefinitions INTO [lib://DataFiles/feature_definitions.qvd] (qvd);
DROP TABLE FeatureDefinitions;
```

> **Why `delimiter is '|'`:** INLINE tables default to comma-separated, and descriptions written in plain English will contain commas. The pipe delimiter avoids having to quote every row. Do not use a character that appears in the descriptions themselves.

Write this block **after** the final feature matrix and derive it directly from that field list — every field in the matrix gets exactly one row here, in the same order and the same grouping. When you add, rename or remove a feature, update this table in the same edit; a definitions file that has drifted from the matrix is worse than none.

---

## 7. Train/test split approaches

The split produces a **held-out validation set** that simulates real-world unseen data after model training and deployment — critical for POC credibility. Qlik Predict handles its own internal cross-validation and evaluation metrics during training; the test set you create here is a separate, external validation asset. Choose the approach that fits the use case.

**Approach 1 — Random split (default for most use cases)**
```qlik
// Random 80/20 split (non-deterministic across reloads)

WithSplit:
LOAD
    *,
    If(Rand() <= 0.8, 'Train', 'Test') as SplitFlag
RESIDENT FinalFeatures;

DROP TABLE FinalFeatures;

LET vSourceRows = NoOfRows('WithSplit');

// Store separately
Training:
NoConcatenate
LOAD * RESIDENT WithSplit WHERE SplitFlag = 'Train';
DROP FIELD SplitFlag FROM Training;
LET vTrainRows = NoOfRows('Training');
STORE Training INTO [lib://DataFiles/training_data.qvd] (qvd);
DROP TABLE Training;

Testing:
NoConcatenate
LOAD * RESIDENT WithSplit WHERE SplitFlag = 'Test';
DROP FIELD SplitFlag FROM Testing;
LET vTestRows = NoOfRows('Testing');
STORE Testing INTO [lib://DataFiles/testing_data.qvd] (qvd);
DROP TABLE Testing;

DROP TABLE WithSplit;

// Counts must sum to the source — a mismatch means rows were lost in the split.
LET vSplitTotal = $(vTrainRows) + $(vTestRows);
TRACE >>> split: $(vTrainRows) train + $(vTestRows) test = $(vSplitTotal) of $(vSourceRows) source rows;
```

**Approach 2 — Time-based split (when temporal ordering matters)**

Use this when the prediction task is inherently time-dependent (e.g., forecasting, next-month churn, seasonal risk). Splitting on time prevents future data from leaking into the training set and better simulates production conditions.
```qlik
// Split on a date threshold — all data before cutoff = Train, after = Test
LET vCutoffDate = Num(MakeDate(2025, 1, 1));

Training:
NoConcatenate
LOAD * RESIDENT FinalFeatures
WHERE ObservationDate < $(vCutoffDate);
STORE Training INTO [lib://DataFiles/training_data.qvd] (qvd);
DROP TABLE Training;

Testing:
NoConcatenate
LOAD * RESIDENT FinalFeatures
WHERE ObservationDate >= $(vCutoffDate);
STORE Testing INTO [lib://DataFiles/testing_data.qvd] (qvd);
DROP TABLE Testing;

DROP TABLE FinalFeatures;
```

> **Why `NoConcatenate` here:** `Training` and `Testing` are filtered subsets of the same table, so their field sets are identical by construction — exactly the auto-concatenation trigger. Without the prefix, `Testing` would silently merge into `Training` and its `STORE`/`DROP` would fail. See [auto-concatenation](syntax-and-patterns.md#4-concatenate).

> **Why trace the counts:** the split is the one place where rows can vanish without any error — a `WHERE` that matches neither branch, or a null `SplitFlag`. Since you cannot run the script, the trace is the user's first chance to see it. Apply the same convention to the time-based split. Note that each count is computed with `LET` **before** the table is dropped, then interpolated — `TRACE` does not evaluate expressions ([writing-scripts §3](writing-scripts.md#3-tracing-and-progress-output)).

---

## 8. Target leakage checklist
Before finalizing any ML prep script, verify:
- [ ] No field is a direct consequence of the target (e.g., `Cancellation_Date` when predicting churn).
- [ ] No field is populated only after the event being predicted.
- [ ] Lag/window features exclude the current row (offsets start at -1 or earlier).
- [ ] No aggregation inadvertently includes future data.
- [ ] Ask: **"Would I know this value at the moment I need to make the prediction?"**

---

## 9. Class imbalance (binary classification)
If the minority class is <20% of rows, flag this in a comment and suggest:
1. Redefining the target window (broaden the positive class definition).
2. Undersampling the majority class via `Rand()`.
3. Oversampling the minority class via `CONCATENATE`.
4. Letting Qlik Predict's intelligent optimization handle auto-balancing (works for moderate imbalance, 5–20%).

---

## 10. Final cleanup checklist
Before outputting the final script:
- [ ] The [self-check](verification-checklist.md#self-check-before-returning-any-script) has been walked through against the actual script text.
- [ ] Every table name referenced by `RESIDENT`/`STORE`/`DROP`/`JOIN` was actually created under that name (no auto-concatenation), and still exists at that point.
- [ ] All temporary/intermediate tables are `DROP`ped, each at the point it stops being needed rather than in a block at the end.
- [ ] **Field lineage holds:** every field in the final matrix — and every field feeding a derivation, `WHERE`, `GROUP BY` or join key — is named or covered by `*` at each intermediate step. Nothing needed downstream was dropped by an explicit intermediate LOAD.
- [ ] **Row counts are traced** after each `STORE` and after the split, with each count assigned by `LET` first and only `$(vVar)` inside the `TRACE`.
- [ ] ID/key fields are retained for linking predictions back to source data. Only drop temporary helper columns.
- [ ] The final feature matrix is an **explicit** LOAD — every field named, logically grouped, each non-obvious field commented ([§6a](#6a-the-final-feature-matrix-must-be-an-explicit-load)). No `LOAD *` in the final assembly.
- [ ] A **Feature Definitions QVD** is produced ([§6b](#6b-feature-definitions-qvd)) — one row per field in the matrix, same order and grouping, descriptions in plain business English with no ML jargon.
- [ ] The target column is clearly identified in a comment.
- [ ] Field names are descriptive (no raw abbreviations unless domain-standard).
- [ ] Comments follow the commenting style in SKILL.md: tab and block headers present, no restated code, no revision history inline, no stale comments left behind by edits.
- [ ] Null handling is explicit for critical fields.
- [ ] STORE path defaults to `lib://DataFiles/...` unless the starting script uses a different lib connection — match it.
- [ ] Script includes a header comment block with: purpose, target field, grain, date generated.

---

## 11. Script template

When generating a new ML prep script from scratch, use this structure:

```qlik
///$tab Main
/**
 * ML Data Preparation Script
 * Purpose:     [describe the prediction task]
 * Target:      [field name] ([binary/regression/multiclass/time series])
 * Grain:       One row per [entity]
 * Generated:   [date]
 * Source data: [describe inputs]
 */

///$tab Change Log
/**
 * [date]  [initials]  Initial version.
 */
// Omit this tab for short, single-purpose scripts. Where it exists, all
// revision history lives here — never inline against the code.

///$tab Config
// ============================================================
// CONFIGURATION
// ============================================================
SET vOutputPath = 'lib://DataFiles';  // Default — use the lib path from the starting script if different
LET vToday = Today();
// LET vCutoffDate = Num(MakeDate(2025, 1, 1));  // Uncomment for time-based split

///$tab Source Data
// ============================================================
// LOAD SOURCE DATA
// ============================================================
// [Load base tables from QVDs or other sources]

///$tab Feature Engineering
// ============================================================
// FEATURE ENGINEERING
// ============================================================
// [What this section derives and why — one or two lines]
// [Aggregation, derived fields, joins, enrichment]

///$tab Final Assembly
// ============================================================
// ASSEMBLE FINAL DATASET
// ============================================================
// [Explicit field list — every field named, grouped and commented. See §6a]
// [Drop helper tables]
// [Drop leaky or unnecessary fields]

///$tab Feature Definitions
// ============================================================
// FEATURE DEFINITIONS
// ============================================================
// [INLINE dictionary — one row per field in the matrix above, in the same
//  order and grouping. Business-language descriptions. See §6b]
// [STORE to feature_definitions.qvd]

///$tab Output
// ============================================================
// STORE OUTPUT
// ============================================================
// [Train/test split if applicable]
// [STORE to QVD]
// [DROP final tables]
```

> **Note on `///$tab` comments:** These are Qlik script section markers. They create named tabs in the Qlik Cloud script editor. Use them to organize long scripts into logical sections.

---

## 12. Worked example

**User prompt:**
> "I have `lib://DataFiles/transactions.qvd` (one row per transaction: `CustomerID`, `TransactionDate`, `Amount`, `ProductCategory`, `Returned`) and `lib://DataFiles/customers.qvd` (one row per customer: `CustomerID`, `SignupDate`, `Region`). Build an ML prep script that predicts whether a customer cancels (`CancellationDate` is populated) in the next 90 days. Output training/testing QVDs."

**Expected response:**
1. State back the task: target = binary flag derived from `CancellationDate` (leaky field to drop after deriving the target), grain = one row per customer, source = the two QVDs above. Sketch the final field list **before** writing any LOAD, and note that `SignupDate` and `CancellationDate` must survive the intermediate steps even though neither appears in the matrix — one feeds tenure, the other the target.
2. Write a script (following the [script template](#11-script-template)) that: loads both QVDs, aggregates `transactions` to customer grain (`TxnCount` via `Count(1)`, `TotalSpend`, `AvgSpend`, `Recency_Days`, `Count(DISTINCT ProductCategory)`, return rate — see [Feature Engineering Patterns](syntax-and-patterns.md#12-feature-engineering-patterns)), joins onto `customers`, derives `Churn_Flag` from `CancellationDate` then drops `CancellationDate` itself (leakage), applies the random 80/20 split from [§7](#7-traintest-split-approaches), and stores `training_data.qvd` / `testing_data.qvd`. The final assembly is an explicit, grouped, commented field list per [§6a](#6a-the-final-feature-matrix-must-be-an-explicit-load) — not `LOAD *` — followed by a Feature Definitions INLINE table stored to `feature_definitions.qvd` ([§6b](#6b-feature-definitions-qvd)), describing each field in plain business language for the Qlik Sense app that will surface the predictions.
3. Note the ratio features (return rate, avg transaction value) must be derived in a **second** LOAD above the aggregation — the aggregate aliases are out of scope in the LOAD that creates them. See [aggregate, then derive](syntax-and-patterns.md#12-feature-engineering-patterns).
4. Trace the row count after each `STORE` and after the split, assigning each count with `LET` first — the join from `transactions` to `customers` is the point where a duplicate key would fan out unnoticed.
5. Flag any uncertain function calls with `// TODO: verify`, and call out the leakage check (`CancellationDate` removed) explicitly after the script.
