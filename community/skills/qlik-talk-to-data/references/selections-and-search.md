# Selections as an analytical engine

Qlik's associative engine can answer a question that looks like it needs a
fresh calculation just by **narrowing the data with a selection and reading
what already exists** — a master item (via `libraryId`), an existing
chart, a KPI. Instead of pulling rows and computing yourself, pick the
selection that isolates the answer and let the engine do the aggregation.

**Before concluding nothing covers the question, ask:** does an existing
chart or master item already show this metric, just not yet sliced the way
the user asked? If yes, select the missing slice and re-read it — don't
retype its formula, and this skill never writes a fresh one either way (see
[SKILL.md — Governed-source priority](../SKILL.md#governed-source-priority)).

## Template: filling a slicing gap with a selection

Question shape: *"[Governed metric] for [dimension value]?"* or *"[Existing
chart's metric], but only for [dimension value]?"* — where a master item or
chart already covers the metric and the only gap is a filter it isn't
currently sliced by.

1. Confirm the filter value exists (`qlik_get_field_values` or
   `qlik_search_field_values`).
2. `qlik_select_values(field=<the filter dimension>, values=[<confirmed value>])`.
3. Re-read what already exists: `qlik_get_chart_data` on a matching chart,
   or `qlik_create_data_object` with a measure/dimension `libraryId`
   pointing at the matching master item(s) — never a hand-typed
   `expression` that retypes the master item's formula.
4. Decide whether to clear the selection based on whether the next question
   continues this thread (see
   [SKILL.md — Silent failure modes](../SKILL.md#silent-failure-modes)).

The chart or master item's own selection-aware calculation does the
narrowing and aggregation — no risk of the answer drifting from the
governed definition. This applies just as much to a single isolated
question as to the first step of a longer investigation; see
[SKILL.md — Precedence](../SKILL.md#precedence-this-skills-rules-over-mcp-tool-level-hints)
for why a tool's own generic authoring hints don't override this when a
governed item is involved.

## Date and timestamp fields: select with `match`, not `values`

On a field whose values are **dual** — an underlying number carrying a
formatted display text, which is what every date and timestamp field is —
`qlik_select_values` treats the two parameters differently:

- **`values` matches the underlying number.** Passing the displayed text
  (`"2026-08-24"`, `"2026-08"`, a month name) matches nothing. Passing the
  raw serial number works, but nothing in the MCP surface exposes it.
- **`match` matches the displayed text**, exactly as returned by
  `qlik_get_field_values` / `qlik_search_field_values`, and is anchored —
  not a substring search. A partial string selects nothing; append `*` to
  take a whole period (`match="<year>-<month>*"` for one month of daily
  values).

**So: on a date or timestamp field, always select through `match`.**

**Spot the field type before selecting.** `qlik_get_fields` returns
`dataType: "DATETIME"` and `$date`/`$timestamp` tags — that is the trigger,
and it is already in hand from discovery. A second tell: repeated entries in
a `qlik_get_field_values` result (several identical display strings) mean
distinct underlying values sharing one format — dual, and `values` will miss.

Confirming the value does not confirm the parameter: the display text
`qlik_search_field_values` returns is exactly what `values` rejects.

### Filtering a period when only a date field exists

A question about a year, a month or a quarter often meets a model that
exposes only a date. Work it out from the field's type and format **before**
the first selection call — trial and error is not free here (see the
warning-cost note below).

1. **Look for a calendar field first.** A year / quarter / month field is
   normally text or integer, takes `values` directly, and is the cheapest
   and least error-prone route. `qlik_get_fields` already lists them.
2. **No calendar field: read the date field's display format once, then hold
   it.** It is app-specific (`2026-08-24`, `24/08/2026`, `Aug 2026`...) and
   comes free from the value already returned by verification, or one
   `qlik_get_field_values` call. The format is a property of the field, not of
   the question — cache it per field for the session.
3. **Build one `match` in that exact format:**
   - contiguous period → **range**: `match=">=<first day><=<last day>"`,
     written in the field's format — selects exactly the days in the
     interval.
   - period that is a prefix of the format → **wildcard**:
     `match="<prefix>*"`.
4. **A literal in any other format matches nothing** and returns the
   misleading "conflict" warning above — the format is the usual cause, not
   the data.

Two date axes are never combined in one filter when the governed
documentation presents them as separate axes — see
[SKILL.md — Temporal reasoning](../SKILL.md#temporal-reasoning-anchor-to-the-data-not-the-wall-clock).

### A failed selection clears what that field already had

When a selection call comes back with the warning above, the field it names is
left with **no selection at all** — whatever was selected
on it beforehand is gone. Other fields keep their selections.

So a failed attempt is not a no-op, and iterating on syntax until something
sticks quietly widens the population: the next read answers over the whole
field, with no error and no sign that a filter went missing.

**So know what was there before you risk it.** `qlik_get_current_selections` is
the record of the whole active context — read it *before* a selection that could
fail, not only after, and hold that record. Re-applying "the whole intended
selection" means nothing if what the field carried from an earlier question was
never written down.

After any warning, re-apply that whole selection — the field's previous value
included, not only the part that failed — and confirm with
`qlik_get_current_selections` before reading a figure.

### What selecting taught you is held for the session

Verifying a value, reading a field's display format, learning that a field is
dual, finding which `match` shape landed on it — each is a fact about this app,
not about this question. **Hold them beside the other session caches and reuse
them.** The apply-then-verify round trip is what makes selections slow;
rediscovering what was already discovered is the avoidable half of it.

Worth holding, per field: its display format, whether it is dual, the values
already confirmed to exist, and the shape of any `match` that succeeded. Refresh
on the same signals as any other cache (see
[trust-and-quality.md](trust-and-quality.md#refreshing-a-cached-catalogue)) —
never on a timer, and never because a new question came in.

### A "selection conflict" warning is not evidence of an associative conflict

When nothing matches, this MCP server returns
`"Selection conflict or values not applicable for field(s): <field>. Values
may conflict with existing selections."` with the field listed under
`conflictingFields`. **That wording appears verbatim with zero selections
active** — it is the generic "nothing was selected" response, not a finding
about the data.

Never read it as an associative conflict, and never conclude from it that a
combination of filters is impossible in this model. On any such warning:

1. Re-issue the same value through `match` if the field is a date/timestamp
   one (the common cause).
2. Only if that also comes back empty, treat the value as absent and
   re-verify it with `qlik_search_field_values`.
3. Only then consider an actual associative conflict — and confirm it by
   applying the two selections one at a time, checking
   `qlik_get_current_selections` in between, rather than inferring it from
   the warning text.

Reporting a real associative conflict to the user is
[elimination by absence](#elimination-by-absence-a-selection-on-one-table-drops-entities-with-no-row-in-it),
below. Reporting this warning as one states a fact about the customer's data
model that the response does not support.

## Finding the field a value lives in

A question naming a value without naming its field: one call to
`qlik_search_field_values` with `searchTerms` and **no `fieldName`** — it
searches every field and returns those carrying the value. Put every plausible
wording in that single `searchTerms` list; never one call per wording. Search
the value as the user wrote it, prefixes and suffixes included — matching is
case-insensitive substring, so the bare form still finds a decorated value.

| Result | Action |
|---|---|
| One field matches | Select there, using the value exactly as returned. |
| Several fields match | Choose on meaning, never on result order — read each candidate field's governed term first. If the choice changes the figure, name the competing fields and ask. |
| A field matches, but not the one the question implies | A near miss, not a confirmation. Check that field's meaning against the question before selecting. |
| Nothing matches | The value is not held as written — [show what the field holds](#when-a-filter-value-cant-be-found-show-the-field-dont-just-say-no). |

Where a master dimension sits over the matched field, the search returns that
dimension's governed name rather than the raw field name, and it is the
selection target.

**Code fields.** A field can hold codes rather than words, and an empty search
on one settles nothing. Read that field's governed term: its `description` and
`relatedInformation` carry the code-to-meaning mapping. Take the code from
there, then select the code.

Where no governed mapping is published and the codes belong to a **public**
system — countries, currencies, months — map the name to the code from
[public reference knowledge](../SKILL.md#public-reference-knowledge-what-may-be-resolved-without-governed-content),
then search that code: the search is what confirms it. Client-specific codes
never resolve this way.

**Stop rule.** Neither the search nor a governed term resolves the wording:
the information is not available — say so and stop. Never translate the value,
expand an abbreviation, rebuild a code from a label, or fall back on a
neighbouring value.

**A value the search does not return is not in the data.** A similar-looking
value spotted while browsing the field is a candidate, never a confirmation —
one letter apart is a different value, not a spelling of the same one. Name the
candidate and ask; **produce no figure on it until the user confirms**. An
answer computed on a substituted value is wrong even when the substitution is
named in the sentence.

## When a filter value can't be found: show the field, don't just say no

A question naming a value that no search resolves is usually a typo, an
internal nickname, or a value the user assumes exists in a field where it
doesn't. "Not found" alone leaves them with nothing to correct.

**Exhaust the lookup first** — `qlik_search_field_values` (case-insensitive
substring, not spelling correction), then the governed alias surfaces of the
[compliance gate](../SKILL.md#glossary-compliance-gate-run-on-every-answer)
step 1: the user's word may be a governed alias for a value, not the value.

**Then show what the field actually holds**, for whichever field would have
been filtered:

- Low cardinality: `qlik_get_field_values` — the value list is the answer.
- Otherwise, a distribution: `qlik_create_data_object` with the field as a
  dimension (plus a `label`) and a **governed count master item by
  `libraryId`** as the measure, sorted descending, with `limit` for a top-N
  and `showOthers` for the tail. A plain field as a *dimension* is a field
  lookup, not authored calculation — the measure is still governed, and no
  expression is written.

Two mechanics verified on this MCP server:

- `LimitSettings.count` bounds the **total rows returned**, "Others"
  included — `count=5` with `showOthers=true` yields 4 real values plus the
  Others row.
- The measure modifier `normalization` ("percent of total") is **silently
  ignored on a `libraryId` measure**: the response carries the raw counts,
  under whatever label was supplied. Never present its output as a share.
  A percentage is only ever reported when a governed share measure exists —
  computing one from the counts is
  [post-processing](../SKILL.md#role-and-non-negotiable-boundary), which
  this skill does not do.

A null bucket in the distribution is itself a finding: the value may be
missing on the records rather than misspelled in the question.

**Close by handing control back.** Name the field and the metric landed on
in business language, say plainly that the requested value isn't among the
values held, and ask whether that was the intended target — offering to
break it down further or to widen the search. Never apply a guessed
selection to "get an answer anyway"; a figure computed on a value the user
did not ask for is worse than the question coming back.

## `qlik_select_values.match` — confirmed capabilities and defects

**This table reflects what this server does, not what its tool description
announces — as observed in August 2026.** These are server behaviours, not a
documented contract: re-verify a row when the server may have been upgraded, and
treat the defects below as open until re-observed rather than as permanent.

`match` takes a declarative pattern — exact values, wildcards, numeric ranges —
or, under the narrow conditions below, a **selection predicate**.

| Technique | Syntax shape | Status | Notes |
|---|---|---|---|
| Exact value(s) | `values=["<value>"]` | Confirmed, **except on date/timestamp fields** | Multiple values in one field is an OR within that field. `values` matches the *underlying* value, not the displayed one — see [Date and timestamp fields](#date-and-timestamp-fields-select-with-match-not-values). |
| Numeric range | `match=">50"`, `match=">10<=100"` | Confirmed | Matches the tool's own documentation. |
| Wildcard, multi-char | `match="<prefix>*"` | Confirmed | |
| Wildcard, single-char | `match="<pattern>?<pattern>"` | Confirmed | `?` matches exactly one character, distinct from `*`. |
| Quoted phrase | `match="\"<multi-word value>\""` | Tolerated | No evidence quoting changes matching semantics through this tool — `match` doesn't appear to word-split, so quoting a phrase adds no value here (unlike the UI Search box, where it does). |
| Compound, across fields | `selections=[{field:A,...}, {field:B,...}]` | Confirmed | Each entry is a separate `Selection`; the engine ANDs them associatively. This is a call-structure feature, not a `match`-string feature. |
| Selection predicate | `match="=<expression>"` | Confirmed, **conditions apply** | Evaluated as a full Qlik expression to decide which values survive. See [Selection predicates](#selection-predicates-the-one-expression-this-skill-may-write). |
| Fuzzy search | `match="~<term>"` | **Defective — do not use** | See below. |
| Modifier `+`/`-` | `match="<term>-<exclude>"` | Not supported | Fails cleanly: 0 selections plus an explicit `warning` in the response. Safe to attempt, just useless. |

### Fuzzy search (`~`) is a confirmed defect, not an unsupported feature — avoid it entirely

A leading `~` in `match` (intending to fuzzy-match a misspelled or
approximate term) does not perform fuzzy matching. It selects **all** — or
effectively all — distinct values in the field, regardless of the search
term or whether the term relates to any real value in the field. It reproduces
on repeat calls and is independent of the term supplied. A `~` that isn't in
the leading position does not trigger it — that
returns 0 selections plus a warning, the same clean failure as unsupported
modifiers.

**Never construct a `match` string starting with `~`** through this tool.

**Use `qlik_search_field_values` instead — knowing what it is.** It does
case-insensitive substring/text search, not edit-distance correction: it helps
only where the user's guess is a literal substring of the real value, and will
not resolve a transposed or misspelled letter. No MCP-exposed equivalent of the
Qlik Sense UI Search box's fuzzy matching exists — see
[mcp-vs-ui-capability-boundary.md](mcp-vs-ui-capability-boundary.md).

If this row is ever observed to behave correctly, update the table rather than
assuming a fix shipped from a changelog alone.

## Selection predicates: the one expression this skill may write

A `match` string starting with `=` is evaluated as a full Qlik expression to
decide **which values of the selected field survive**. `Rank()`, `Sum()` and
other aggregations evaluate across the whole dataset — checked against an
existing Top-N chart's own result on the same dimension and matched by identity.

**It computes nothing the user sees.** The predicate picks a population; the
figure is then read from a governed master item or chart under that selection,
exactly like any other selection. That is what separates it from a hand-written
measure: there is no governed definition being reimplemented, and nothing to
drift from.

**When it fires.** The question asks for a population **defined by a threshold
or a rank over a measure** — "customers with more than X", "the top N by Y",
"those above average" — and discovery found no governed item, chart or plain
selection that already delivers that population. It is the last step before
"nothing governed covers this", never the first thing reached for.

**What may appear inside it**, in this order:

1. **A governed measure referenced by its library name** —
   `=[<Master Measure>] >= <value>`. **Try this first, always.** Whether this
   server resolves a library reference inside `match` is **not established**; if
   it errors, or selects nothing where values plainly qualify, that is the stop
   rule below — not a cue to expand the measure by hand.
2. **A bare aggregation over a field the question itself names** —
   `=Count(distinct <Field>) >= 5`, `=Sum(<Field>) > 1000000`,
   `=Rank(Sum(<Field>)) <= 3`. Only where the field and the comparison both come
   from the user's own wording, and no governed measure covers the condition.

**The stop rule.** Everything else stops. No set analysis (`{<...>}`), no
`if()`, no logic rebuilt from a master item's expression, no predicate that
reproduces what a governed measure already computes. **A governed measure covers
the condition and the library reference doesn't work: say so and stop.** Writing
its formula out is the reimplementation this skill exists to prevent, and
putting it inside a `match` does not change that.

**Confirm what it selected.** A predicate can match nothing and fail as silently
as any other selection — call `qlik_get_current_selections` after it and check
the result is plausible before reading a figure.

**Name it in provenance.** Verbose mode: the field selected on and the condition
applied, so the population is reproducible. Production mode: the population in
business terms ("the three highest-revenue customers"), never the syntax.

## `qlik_create_data_object` — ordering is a property of the first dimension

The tool's own description documents `SortSettings.index` as selecting which
dimension or measure is ordered, and gives "sort by second dimension" as an
example. **`index` does not select a dimension.** Ordering only ever applies to
dimension 0.

| Asked for | What comes back |
|---|---|
| One entry, `target: dimension`, `index: 1` | Its `order` and `sortType` land on dimension **0**; dimension 1 keeps its default ascending order |
| Two entries, one per dimension | The entry for dimension 0 applies; the other is dropped |
| `target: measure`, single dimension | Works as documented — the reliable ordering route |

There is no global `ORDER BY` spanning the columns and no secondary ordering
key; ordering belongs to the leading dimension, not to the table.

Two routes that work:

- Put the dimension that carries the order **first**, descriptive ones after —
  "the ten oldest accounts" leads with the date, the name follows.
- Order by a **governed measure** over a single dimension.

`LimitSettings.count` cuts along the ordering actually applied, so a top-N
combined with a dropped sort returns the first N of the wrong order — with
nothing on screen to show it.

## Stuck selection mode

`qlik_select_values` / `qlik_clear_selections` can return an error
("Function not allowed on this object in app modal mode") while the
mutation applies anyway. Don't trust the error alone — call
`qlik_get_current_selections` immediately after and check whether the
intended change is already there.

If a retry of the same call plus a fresh `qlik_get_current_selections`
still doesn't show the intended change, stop — don't keep retrying or
inventing further workarounds. Tell the user the app session appears
stuck; this MCP server has no call that can release it, so recovery
(reopening the app, a fresh session) is outside this skill's reach.

**Alternate states are out of scope, and `stateName` is not a way around this.**
This skill works in the default state only. A never-before-used state name on
`qlik_select_values` / `qlik_create_data_object` / `qlik_get_current_selections`
has been observed to silently fall back to the default state instead of creating
an isolated one — including inheriting a stuck selection already on it.
Supporting alternate states deliberately — including one an app already defines —
is out of scope for this skill.

## The silent failure catalogue

`SKILL.md` lists the triggers. This is what each one actually is.

**A value that doesn't exist fails silently.** It doesn't appear in the
result, or it drops from the selection state without a word. Confirm the
value first: `qlik_get_field_values` on a low-cardinality field,
`qlik_search_field_values` on dates, names or codes.

**Selections persist for the whole session until cleared.** That is a tool,
not only a hazard — it is what lets a conversation narrow step by step. It is
also why a figure can change between two identical questions.

**A selection is the only filtering mechanism available.** There is no
set-analysis fallback. Use one even for a single isolated question when it
unlocks a governed item; if no selection over governed content answers the
question, that is "nothing governed covers this", not a cue to write an
expression.

**`qlik_select_values` and `qlik_clear_selections` can report an error while
the change went through.** Call `qlik_get_current_selections` immediately
after and check before retrying or reporting failure. If a retry plus a fresh
check still doesn't show it, stop — say the app session appears stuck;
recovery is outside this skill's reach.

**Alternate states are out of scope.** A never-before-used `stateName` silently
falls back to the default state, inheriting whatever selection is stuck on it.
Default state only; `stateName` is not a way around the point above.

## Elimination by absence: a selection on one table drops entities with no row in it

The associative engine excludes by absence, not by a failed test. Filter on
an attribute carried by a fact table, and every entity with **no record at
all** in that table drops out of the result — customers with no order,
products never shipped, sites with no reading. Nothing failed a
condition; the rows simply never existed to be matched.

The measure returns 0, with no error and no indication that a selection,
rather than the data, produced it. This is the hardest silent failure to
spot, because a zero is a perfectly plausible answer.

**Treat a count that collapses after a filter on a different table as this
pattern until proven otherwise:**

1. Re-check `qlik_get_current_selections` — identify which selection sits
   on a fact-table attribute rather than on the entity itself.
2. Say which selection caused the drop, rather than reporting the zero as a
   fact about the population.
3. If the question was about the entity population and not about the
   filtered activity, the selection is the wrong instrument — a different
   governed source or a cleared filter is needed.

The trap is at its worst on entities that are legitimately new or
forward-looking: an entity that exists in the reference data but has no
activity yet is exactly the one with no fact rows, so it disappears from
precisely the questions most likely to be asked about it.

## Known unknowns — don't assert beyond what's confirmed above

A few `match`-related behaviors have not been checked and should not be
assumed either way when advising a user or choosing an approach:

- OR/NOT combinators **within a single field's `match` string** (the UI
  Search box's compound search, e.g. typing two terms together as one
  search). Only AND-across-different-fields (via multiple `Selection`
  entries in one call) is confirmed above — that's a different mechanism.
- Whether quoting a phrase changes word-splitting behavior for a genuinely
  ambiguous multi-word value (one where dropping the quotes would parse
  differently). Treat quoting as inert until this is checked against such
  a case.

If a question turns on one of these, say the behavior isn't confirmed
rather than guessing, and prefer whichever confirmed technique above
already covers the case (e.g. multiple `Selection` entries instead of an
unverified compound `match` string).
