---
name: qlik-load-script
description: "Write, complete, or extend Qlik Sense load scripts (.qvs) for data preparation. Primary use case is preparing flat datasets for ML experiments with Qlik Predict — engineering features, handling train/test splits, and outputting QVD files. Also covers general Qlik load script authoring: completing scripts from starting code, comments, or prompts. Use this skill whenever the user mentions Qlik load script, .qvs files, Qlik data load, QVD output, data preparation for Qlik Predict, or asks for help writing or fixing Qlik script syntax. Also trigger when the user provides a Qlik load script and asks for modifications, extensions, feature engineering, or data transformations. Even if the user just pastes Qlik script code and asks a question about it, use this skill."
license: Apache-2.0
metadata:
  author: nabeel-oz
  version: 1.0.0
  tags:
    - qlik
    - load-script
    - qvs
    - etl
    - data-preparation
    - qlik-predict
    - claude-code
    - cursor
    - coding-agent
---

# Qlik Load Script Generator

## Overview

You are writing **Qlik Sense load script** (.qvs files) for data preparation. You have **no access to live data or a Qlik Cloud environment** — you cannot execute, preview, or validate a script against the Qlik engine. Produce correct, clean, well-commented script that runs with minimal edits.

**Built for coding agents.** This skill is designed primarily for agentic coding tools with file-system access — Claude Code, Cursor, Windsurf, and similar — working inside a project that contains `.qvs` files:
- Read the existing script(s) from disk (via your file-read tool) before editing.
- Edit or create the `.qvs` file(s) directly in the project rather than only printing script into the chat.
- Preserve the surrounding project structure (other tabs, connections, file layout) exactly as found, except where the task asks you to change it.

If you are running in a chat-only environment with no file access (e.g. a plain web chat), fall back to outputting complete script blocks for the user to copy and paste — see [Response Format](#response-format).

**Primary use case:** Data preparation scripts for ML experiments using Qlik Predict. The user provides a starting script with base data. You transform, engineer features, and output training/testing QVD files.

**General use case:** Complete or extend any Qlik load script based on starting code, inline comments, and the user's prompt.

## Critical Rules

1. **This is Qlik load script, not SQL.** The syntax resembles SQL but differs in important ways. When unsure, read [references/syntax-and-patterns.md](references/syntax-and-patterns.md) and consult: https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/LoadData/script-syntax-functions.htm
2. **Never invent functions.** If you are not confident a built-in function exists, say so and suggest an alternative you are confident about.
3. **No execution.** You cannot run or test the script against Qlik Cloud, regardless of environment. Flag anything you are uncertain about with a `// TODO: verify` comment so the user can check.
4. **Preserve the user's starting script.** Do not rewrite or restructure parts of the script the user did not ask you to change.
5. **Output complete, runnable script.** Do not output partial snippets with "..." elisions unless the user explicitly asks for a diff. When you have file access, write the complete section back to the `.qvs` file; when outputting to chat, the user is copy-pasting into the Qlik Cloud script editor.

**Before writing any Qlik script**, read [references/syntax-and-patterns.md](references/syntax-and-patterns.md) for the full syntax reference, common pitfalls, and code patterns. This is essential — Qlik syntax has many subtle differences from SQL that cause silent bugs if you rely on SQL intuition.

---

## ML Data Preparation Guidelines

### Common data sources
Starting scripts typically load from **CSV** or **QVD** files via `lib://` connections. Match the source format and lib path used in the starting script. When loading CSV files, always specify the format explicitly:
```qlik
FROM [lib://DataFiles/data.csv] (txt, codepage is utf8, embedded labels, delimiter is ',');
```

### Feature engineering philosophy
Apply your **data science and ML knowledge** to engineer features that are likely to have genuine predictive signal for the specific use case. Aim for impact over exhaustiveness — a focused set of well-reasoned features is better than a sprawling feature matrix that adds noise. Consider domain context, known drivers from the literature, and the business logic behind the prediction task when choosing what to derive.

### Output structure for Qlik Predict
Qlik Predict expects a **flat, single-table dataset**:
- One row = one observation at the defined grain (e.g., one customer, one loan, one month-region).
- One column = the **target** (what you are predicting).
- Remaining columns = **features** (inputs to the model).
- Supported output: QVD (preferred), CSV, XLSX, Parquet.

### Target column requirements
| Experiment Type | Target Requirement |
|---|---|
| Binary classification | Exactly 2 unique values (e.g., `Yes`/`No`, `1`/`0`, `Churn`/`Active`) |
| Multiclass classification | 3–10 unique categorical values |
| Regression | Numeric with >10 unique values |
| Time series | Numeric target + date index column + optional group columns (max 2) |

### Feature count and field retention guidance
- **Aim for impactful features** without overcomplicating the feature matrix. Focus on features with clear predictive signal rather than exhaustively deriving every possible combination. Use your data science and ML knowledge to prioritise features that are likely to matter for the specific use case.
- **Always retain ID/key fields** (e.g., CustomerID, LoanID, PolicyNumber). These are not used as features during training, but they are essential for linking predictions back to the original data after model deployment. Qlik Predict will ignore high-cardinality identifiers automatically — keeping them in the dataset does no harm.
- Remove fields that are direct derivatives or consequences of the target (leakage).

### Date format convention
Date fields should be stored in **YYYY-MM-DD** format (ISO 8601) for reliability across Qlik environments. Qlik Predict automatically derives date dimensions (year, month, day of week, quarter, etc.) from fields it profiles as dates, so you generally do **not** need to manually decompose dates into separate year/month/day columns. Focus manual date engineering on features Qlik Predict cannot auto-derive: date differences, durations, and domain-specific periods.

```qlik
// Format dates as YYYY-MM-DD for reliable interpretation
Date(Date#(RawDateField, 'DD/MM/YYYY'), 'YYYY-MM-DD') as EventDate,
// Manual date engineering — only for features Qlik Predict won't auto-derive
Today() - Date#(RawDateField, 'DD/MM/YYYY') as DaysSinceEvent
```

### Train/Test split approaches

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

// Store separately
Training:
NoConcatenate
LOAD * RESIDENT WithSplit WHERE SplitFlag = 'Train';
DROP FIELD SplitFlag FROM Training;
STORE Training INTO [lib://DataFiles/training_data.qvd] (qvd);
DROP TABLE Training;

Testing:
NoConcatenate
LOAD * RESIDENT WithSplit WHERE SplitFlag = 'Test';
DROP FIELD SplitFlag FROM Testing;
STORE Testing INTO [lib://DataFiles/testing_data.qvd] (qvd);
DROP TABLE Testing;

DROP TABLE WithSplit;
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

### Target leakage checklist
Before finalizing any ML prep script, verify:
- [ ] No field is a direct consequence of the target (e.g., `Cancellation_Date` when predicting churn).
- [ ] No field is populated only after the event being predicted.
- [ ] Lag/window features exclude the current row (offsets start at -1 or earlier).
- [ ] No aggregation inadvertently includes future data.
- [ ] Ask: **"Would I know this value at the moment I need to make the prediction?"**

### Class imbalance (binary classification)
If the minority class is <20% of rows, flag this in a comment and suggest:
1. Redefining the target window (broaden the positive class definition).
2. Undersampling the majority class via `Rand()`.
3. Oversampling the minority class via `CONCATENATE`.
4. Letting Qlik Predict's intelligent optimization handle auto-balancing (works for moderate imbalance, 5–20%).

### Final cleanup checklist
Before outputting the final script:
- [ ] All temporary/intermediate tables are `DROP`ped.
- [ ] ID/key fields are retained for linking predictions back to source data. Only drop temporary helper columns.
- [ ] The target column is clearly identified in a comment.
- [ ] Field names are descriptive (no raw abbreviations unless domain-standard).
- [ ] Null handling is explicit for critical fields.
- [ ] STORE path defaults to `lib://DataFiles/...` unless the starting script uses a different lib connection — match it.
- [ ] Script includes a header comment block with: purpose, target field, grain, date generated.

---

## Script Template

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
// [Aggregation, derived fields, joins, enrichment]

///$tab Final Assembly
// ============================================================
// ASSEMBLE FINAL DATASET
// ============================================================
// [Combine all features into one flat table]
// [Drop helper tables]
// [Drop leaky or unnecessary fields]

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

## Response Format

When the user provides a starting script or prompt:

1. **Understand the task.** State back the prediction target, grain, and key transformations needed. Ask clarifying questions if the intent is ambiguous.
2. **Write the script.** If you have file access (Claude Code, Cursor, etc.), edit or create the `.qvs` file(s) directly. Otherwise, output complete, runnable Qlik load script sections in the chat. Use comments liberally.
3. **Flag uncertainties.** Mark anything you are not 100% sure about with `// TODO: verify — [reason]`.
4. **Explain non-obvious logic.** After the script block, briefly explain any complex Window() calls, tricky joins, or domain-specific choices.
5. **Suggest improvements.** If you see opportunities for additional features, better handling of nulls/outliers, or potential leakage risks, mention them after the main output.

---

## Reference

- **Syntax & patterns reference:** [references/syntax-and-patterns.md](references/syntax-and-patterns.md) — full Qlik load script syntax, common pitfalls, and feature engineering code patterns. **Read this before writing any script.**
- **Qlik Script Syntax & Functions:** https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/LoadData/script-syntax-functions.htm
- **Qlik Predict documentation:** https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/AutoML/home-automl.htm
- **Window function reference:** https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/LoadData/window-functions.htm
