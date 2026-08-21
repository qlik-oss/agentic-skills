# Writing Qlik Load Scripts — Construction Discipline

Read this **before writing the first `LOAD`**. It covers how to build a script — the decisions made before and between statements. For the syntax itself see [syntax-and-patterns.md](syntax-and-patterns.md); for the post-writing pass see [verification-checklist.md](verification-checklist.md).

The failures this file guards against are not parse errors. The script reloads cleanly and produces a plausible, wrong result.

## Table of Contents
1. Design the target data model first
2. Table lifecycle
3. Tracing and progress output
4. When the logic is harder than the syntax

---

## 1. Design the target data model first

**An explicit field list in an intermediate LOAD is a filter.** Every field not named there is destroyed for the rest of the script. Nothing warns you. The consequence surfaces much later — as "field not found" if you are lucky, or as a derivation that quietly evaluates to null if you are not.

So do not build forwards from the source and hope you end up somewhere useful. Decide the destination, then build towards it.

**Before writing any LOAD:**

1. **Write the target structure** — the final table's grain (what one row represents) and its field list. For ML prep this is already mandated by [ml-data-prep.md §6a](ml-data-prep.md#6a-the-final-feature-matrix-must-be-an-explicit-load); it applies to every task.
2. **Work towards that target.** For each target field, name the source field(s) it derives from and the step at which it first appears. Fields that only feed a derivation still have to survive until that derivation runs.
3. **Sketch the steps** — source tables, intermediate tables, final assembly — and check that each one moves the data measurably closer to the target. A step that does not is either unnecessary or belongs elsewhere.

**While writing:**

- **Prefer `LOAD *` plus derivations in intermediate tables.** The explicit field list is for the final assembly, where it is the deliverable. In the middle of the script it is a trap with no compensating benefit.
- Where an intermediate genuinely must be explicit — narrowing a wide source table, or controlling join keys — comment which downstream step consumes each non-obvious field it keeps.
- Comment each intermediate table with what it contributes toward the target, not with what it does:

```qlik
// Customer-grain aggregates. 
// SignupDate is used in Assembly to calculate TenureMonths.
CustomerAgg:
LOAD
    CustomerID,
    SignupDate,
    Count(1)    as TxnCount,
    Sum(Amount) as TotalSpend
RESIDENT Transactions
GROUP BY CustomerID, SignupDate;
```

The field-lineage check in [verification-checklist.md](verification-checklist.md#self-check-before-returning-any-script) closes this loop after the script is written. Designing the target first is what makes that check pass on the first attempt rather than the third.

---

## 2. Table lifecycle

Every table you create has three moments: where it is created, what it is used for, and **where it dies**. Plan all three. Write the `DROP TABLE` at the point you stop needing the table, not in a cleanup block at the end of the script.

Two independent reasons, and both matter:

- **A dropped table cannot be an auto-concatenation target.** Auto-concatenation triggers on a matching field set against any table *still in memory*. Every table you leave alive is a hazard for every later LOAD — see [syntax-and-patterns.md §4](syntax-and-patterns.md#4-concatenate).
- **Qlik holds every live table in RAM for the whole reload.** Intermediate tables left alive multiply the memory footprint of the reload for no benefit.

`NoConcatenate` and dropping are complements, not alternatives: `NoConcatenate` protects the label of the table you are creating; dropping removes the collision target so the question does not arise.

```qlik
CustomerAgg:
LOAD CustomerID, Count(1) as TxnCount RESIDENT Transactions GROUP BY CustomerID;

LEFT JOIN (Customers)
LOAD * RESIDENT CustomerAgg;

DROP TABLE CustomerAgg;   // consumed by the join above; nothing else needs it
```

### Included scripts

`$(Include=…)` and `$(Must_Include=…)` are textual insertions, not modules. The included file's tables are created in **the same namespace** as the caller's, and they stay live after the include returns. A table left alive by an include is therefore an auto-concatenation target for every LOAD in the caller that happens to match its field set — the caller's label is silently discarded and its later `RESIDENT`/`STORE`/`DROP` fails.

- An included script must **drop everything it does not deliberately hand back**, and should state in a header comment which tables it leaves behind.
- The caller must not assume the include's namespace is empty. If you did not write the include, read it before assuming which tables exist.

### Keep the table inventory

Maintain the running table inventory from SKILL.md workflow step 4, with four columns: **name**, **field set**, **`NoConcatenate`?**, **drop point**. Consult it before every `RESIDENT`, `JOIN`, `STORE`, and `DROP`. A table with no drop point recorded is either the final output or an oversight.

---

## 3. Tracing and progress output

`TRACE` writes text to the reload log. It emits its argument as **literal text after dollar-sign expansion** — it does not evaluate expressions. This prints the literal string `Rows: NoOfRows('Transactions')`:

```qlik
// ✗ WRONG — TRACE does not evaluate expressions
TRACE Rows: NoOfRows('Transactions');
```

Compute into a variable first, then interpolate:

```qlik
// ✓ CORRECT
LET vNoOfRows = NoOfRows('Feature_Definitions');
TRACE >>> feature_definitions.qvd rows: $(vNoOfRows);
```

Mechanics:
- No quotes are needed or wanted — `TRACE` takes raw text from the keyword to the terminating `;`.
- A `;` **inside** the message terminates the statement early. Keep messages simple; avoid punctuation that could parse.
- `$(vVar)` expands normally; anything else is literal. See [syntax-and-patterns.md §7](syntax-and-patterns.md#7-variables-and-dollar-sign-expansion).
- Use a `>>> ` prefix so the traces are greppable in a long reload log.

### Where tracing earns its place

You cannot execute the script while writing it, so these traces are the user's first opportunity to catch a silent error. Trace at the points where wrongness is invisible in the data:

- **After each `STORE`** — the row count of what was written.
- **After a split** — each part's count *and* whether they sum to the source count.
- **After any join that could fan out** — the row count before and after. A left join to a non-unique key multiplies rows without erroring.

```qlik
LET vSource = NoOfRows('FeatureMatrix');

Training:
NoConcatenate
LOAD * RESIDENT FeatureMatrix WHERE SplitFlag = 'Train';
LET vTrain = NoOfRows('Training');

Testing:
NoConcatenate
LOAD * RESIDENT FeatureMatrix WHERE SplitFlag = 'Test';
LET vTest = NoOfRows('Testing');

LET vSplitTotal = $(vTrain) + $(vTest);
TRACE >>> split: $(vTrain) train + $(vTest) test = $(vSplitTotal) of $(vSource) source rows;
```

Do not trace every statement. A trace that nobody would act on is noise in the log.

---

## 4. When the logic is harder than the syntax

Most Qlik mistakes are syntax reflexes carried over from SQL, and the references cover those. A different failure appears when the *transformation itself* is hard — the script is syntactically fine but computes the wrong thing, and there is no way to tell without running it.

For those cases only, prototype the logic in Python (pandas/NumPy) first.

**Use a prototype only when both hold:**

- **(a)** Representative sample data is available locally, and
- **(b)** the transformation is genuinely complex — multi-step windowing, sessionisation, point-in-time / as-of joins, recursive or iterative logic, anything where you cannot state the expected answer in advance.

If either is absent, write the Qlik script directly. For work a competent Qlik developer would write straight out, the detour costs a translation step and imports pandas habits for no gain.

### The prototype is a verification oracle, not a source to translate

Run the pandas version against the sample data to establish **the expected answer**: output row count, grain, key aggregate values, null counts, a few spot-checked rows. Those numbers are the deliverable of this step.

They then become:
- the `TRACE` checkpoints from §3 above, and
- an `// Expected: 4,812 rows, mean TotalSpend 341.20` comment at the relevant point in the script,

so the user can confirm on the first reload that the Qlik version agrees with the validated logic.

**Write the Qlik script from the specification the prototype validated — never transliterate its code.** Line-by-line conversion is how pandas idioms enter a Qlik script.

### Converting: name the Qlik construct

> The failure is not any particular idiom — it is assuming a one-to-one mapping exists. For each operation in the prototype, name the Qlik construct that produces the same result and point to it in the Qlik docs. If you cannot name one, the design needs rethinking, not the syntax: restructure around what Qlik does naturally — a RESIDENT pass, a join, a mapping table, an ordered load with `Peek()` — rather than hunting for a function that mimics pandas.

The table below is **illustrative, not exhaustive**. It shows the check applied to common operations; apply the same check to every operation in your prototype, including the ones not listed here.

| pandas idiom | Qlik equivalent |
|---|---|
| `df.merge(other, on='k')` | `LEFT JOIN (T) LOAD …` — joins on **all** shared field names; rename to control the key |
| `groupby().transform()` | `Window(agg, partition, sort_type, sort_expr, filter, start, end)` on a RESIDENT load |
| `groupby().agg()` | `LOAD … GROUP BY` — every non-aggregated field must be listed |
| `.shift(1)` | `Previous()` on an ordered load, or `Window(…, -1, -1)` |
| `.cumsum()` | `RangeSum(Peek('Running'), Value)` on an ordered load, or a `Window()` running frame |
| `round(x, 2)` | `Round(x, 0.01)` — the second argument is a step, not a decimal count |
| `x % y` | `Mod(x, y)` |
| `fillna(v)` | `Alt(x, v)` |
| `.query()` / `.assign()` chained on just-created columns | Alias scope — one derivation level per LOAD; split into preceding/RESIDENT steps |
| in-place mutation, reassigning `df` | No mutation. Each step is a new table; drop the old one |
| `drop_duplicates()` | `LOAD distinct …` on a RESIDENT pass |
| `idxmax()` / "row with the max" | Aggregate to the max, then join back — see [FirstSortedValue](syntax-and-patterns.md#6-key-functions) |

### The prototype is a working artefact

It is not part of the deliverable. Do not add it to the project, do not reference it from the `.qvs`, and write anything it produces to a scratch location or a separate folder in the project directory. What survives the step is the expected numbers and the validated specification.
