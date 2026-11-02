# Qlik Load Script — Pitfalls & Verification Checklist

Read this **after writing script, and again after every revision**. Since the script cannot be executed against the Qlik engine while authoring, this pass is the only validation it gets — treat it as required, not optional. Check the script **as written on disk**, not your memory of writing it.

For syntax and code patterns see [syntax-and-patterns.md](syntax-and-patterns.md); for construction discipline see [writing-scripts.md](writing-scripts.md).

---

## 1. Common Pitfalls

| Pitfall | What happens | How to avoid |
|---|---|---|
| **Missing semicolons** | Parser error, often cryptic | Every statement ends with `;` |
| **Auto-concatenation** | Table with a matching field set merges into the earlier table; **your label never exists**, so later `RESIDENT`/`DROP`/`STORE` fail | `NoConcatenate` on every LOAD whose field set could match an earlier table — see [syntax §4](syntax-and-patterns.md#4-concatenate) |
| **Table left alive by an include** | An `$(Include=…)` script shares the caller's namespace; a table it leaves behind becomes an auto-concatenation target for the caller | Includes drop everything they do not deliberately hand back — see [writing-scripts §2](writing-scripts.md#2-table-lifecycle) |
| **Alias used in the same LOAD** | A field created with `as` is out of scope for every other expression in that LOAD | Split into a preceding LOAD or a RESIDENT step — see [syntax §2](syntax-and-patterns.md#2-load-statement-patterns) |
| **`Count(*)`** | Syntax error — not Qlik | `Count(1)` for all rows, `Count(Field)` for non-null values |
| **`HAVING`** | Syntax error — not Qlik | Aggregate, then filter with `WHERE` in a preceding/RESIDENT load — see [syntax §5](syntax-and-patterns.md#5-where-group-by-order-by) |
| **`Round(x, 2)` for 2 dp** | Rounds to the nearest multiple of 2 | Step is an interval: `Round(x, 0.01)` — see [syntax §6](syntax-and-patterns.md#6-key-functions) |
| **`FirstSortedValue()` on tied ranks** | Returns **NULL** when two or more rows share the top rank — silently, and the nulls propagate into every ratio and flag built on the field | Use `Max()`/`Min()`, or aggregate-then-join, or a `Window()` rank with an explicit tiebreak — see [syntax §6](syntax-and-patterns.md#6-key-functions) |
| **Field silently dropped by an intermediate LOAD** | An explicit field list destroys every field it does not name. Fails much later, or produces nulls with no error at all | Design the target model first and prefer `LOAD *` in intermediates — see [writing-scripts §1](writing-scripts.md#1-design-the-target-data-model-first) |
| **Expression inside `TRACE`** | `TRACE` emits literal text; the expression is printed, not evaluated | Assign to a variable with `LET`, then trace `$(vVar)` — see [writing-scripts §3](writing-scripts.md#3-tracing-and-progress-output) |
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

## 2. SQL Habits That Break in Qlik

Qlik load script *looks* like SQL, which is exactly why SQL reflexes slip through unnoticed. Everything in the left column is a syntax error or a silent wrong answer. Check any script you write against this list before returning it.

| SQL habit | Status in Qlik | Qlik equivalent |
|---|---|---|
| `COUNT(*)` | Invalid | `Count(1)`, or `Count(Field)` for non-nulls |
| `HAVING <agg> > n` | Invalid — no such clause | Aggregate, then `WHERE` in a preceding/RESIDENT load |
| `ROUND(x, 2)` = 2 dp | Valid syntax, **wrong result** — rounds to multiples of 2 | `Round(x, 0.01)` |
| Alias reused later in the same `SELECT` list | Invalid — alias is out of scope | Preceding LOAD or RESIDENT step |
| `JOIN … ON a.k = b.k` | Invalid — no `ON` clause | Join is a prefix; keys are **all** identically-named fields. Rename to control |
| `SELECT … FROM a, b` (multi-table FROM) | Invalid | One source per LOAD; combine via JOIN prefix or `CONCATENATE` |
| `UNION` / `UNION ALL` | Invalid | `CONCATENATE (Target) LOAD …` (union all). For union-distinct, add `LOAD distinct` on a RESIDENT pass |
| `CASE WHEN … THEN … END` | Invalid | `If(cond, then, else)`, nested; or `Pick(Match(…), …)` |
| `COALESCE(a, b, c)` | Invalid | `Alt(a, b, c)` |
| `ISNULL(x)` returning a value | `IsNull(x)` returns a boolean only | `Alt(x, default)` or `If(IsNull(x), default, x)` |
| `SUBSTRING(s, 2, 3)` | Invalid | `Mid(s, 2, 3)` |
| `LEN(s)` / `LENGTH(s)` | `Len(s)` ✓ | — |
| `GETDATE()` / `CURRENT_DATE` | Invalid | `Today()` / `Now()` |
| `DATEDIFF(d, a, b)` | Invalid | `b - a` (dates are numeric serials); or `Interval(b - a, 'D')` |
| `x <> y` | Valid ✓ (`<>` is Qlik's not-equal) | — |
| `AS` alias before the expression | Invalid | Expression first: `expr as Alias` |
| Subquery in `FROM` / `WHERE` | Invalid — no subqueries | Materialise as a table first, or use a preceding LOAD |
| `WITH` / CTEs | Invalid | Intermediate tables + `DROP TABLE` |
| `DISTINCT` inside an aggregate | `Count(DISTINCT f)` ✓; `LOAD distinct` ✓ | — |
| `LIMIT` / `TOP n` | Invalid | `FIRST n LOAD …` prefix |
| `ORDER BY` on a `FROM`-file load | Only valid on `RESIDENT` loads | Load first, then re-load `RESIDENT … ORDER BY` |
| Window functions `OVER (PARTITION BY … ORDER BY …)` | Invalid | `Window(agg, partition, sort_type, sort_expr, filter, start, end)` on a RESIDENT load |
| `NULL` string comparisons (`x = NULL`) | Never true | `IsNull(x)`, and `Len(Trim(x)) = 0` for empties |
| `+` for string concatenation | Numeric addition | `&` concatenates: `First & ' ' & Last` |
| `%` for modulo | Invalid | `Mod(a, b)` |
| `/` integer division | Always float | `Div(a, b)` for integer division |

---

## Self-check before returning any script

Work through this list against the script you just wrote — most of these are invisible at reload time until the specific line executes:

1. **Every table reference resolves.** For each `RESIDENT`, `DROP TABLE`, `STORE`, `JOIN (…)`, `CONCATENATE (…)`, name the `LOAD` that created it, and confirm it wasn't auto-concatenated away ([syntax §4](syntax-and-patterns.md#4-concatenate)) or already dropped.
2. **No alias is used in the LOAD that defines it** ([syntax §2](syntax-and-patterns.md#2-load-statement-patterns)). Scan each LOAD's field list for names that appear both as an `as` target and inside another expression.
3. **No `Count(*)`, no `HAVING`, no `ON` clause, no subquery, no `CASE`** — see the table above.
4. **Every `Round`/`Ceil`/`Floor` second argument** is an interval, and matches the intent.
5. **Every `GROUP BY` lists all non-aggregated fields** in that LOAD, exactly.
6. **Every aggregating LOAD has a `GROUP BY`** unless you genuinely want a single total row.
7. **Every function used is one you can point to in the Qlik docs.** If not, replace it or flag with `// TODO: verify`.
8. **Every non-file LOAD that could collide on field names carries `NoConcatenate`.**
9. **Preceding LOAD stacks:** only the bottom statement has a source clause; only the top has the label and prefix; each intermediate ends with a bare `;`.
10. **Every temporary table is dropped**, and nothing is referenced after its `DROP`.
11. **No `FirstSortedValue()`** without an explicit tiebreak, or a stated reason why ties cannot occur in that data. Ties return NULL silently.
12. **Every `TRACE` contains only literal text and `$(v…)` expansions** — no function calls, no arithmetic. Anything computed is assigned with `LET` on the line above.
13. **Field lineage.** For every field in the final assembly, trace it back through each LOAD to its source and confirm it is named — or covered by `*` — at every intermediate step. Do the same for every field used inside a derivation, a `WHERE`, a `GROUP BY`, or a join key: a field can be dropped before the step that needed it, and that produces nulls rather than an error.
14. **Every table has a drop point**, and no included script leaves a table live that the caller does not expect.
15. **Comments describe the code as it stands** — none restate the code, describe code you removed, or narrate the revision you just made. See the commenting style in SKILL.md.
