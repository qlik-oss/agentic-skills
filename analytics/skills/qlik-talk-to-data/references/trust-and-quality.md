# Trust and data-quality signals — mechanics

Read this when [SKILL.md — Trust and data-quality signals](../SKILL.md#trust-and-data-quality-signals)
isn't enough detail on *how* to fetch, cache, resolve, and disclose these
figures.

## The composite score is not a quality statement

`qlik_get_dataset_trust_score` and `qlik_get_dataset` both return the same
structure: a headline `score`, and the weighted `axes` it was computed from.
**Read the axes. The headline blends things that answer different questions.**

| Axis | What it measures | Bearing on an answer |
|---|---|---|
| `VALIDITY` | Values conforming to their expected type/format | **Direct** — a figure computed over invalid values is suspect |
| `COMPLETENESS` | Absence of empty values | **Direct** — drives under-counting |
| `ACCURACY` | Correctness against a reference | **Direct where a rule evaluates it** |
| `DIVERSITY` | Distribution shape (volume, evenness) | Weak |
| `TIMELINESS` | Freshness of the last load | **Direct**, and it ties into temporal anchoring |
| `DISCOVERABILITY` | Whether descriptions, tags and field docs exist | **None on the data.** Documentation hygiene |
| `USAGE` | How many apps use it, how often they are viewed | **None on the data.** Popularity |

**The weights are governed, not fixed.** Qlik makes them configurable per data
product, dataset and field, so the table says what each axis *means*, never what
it is worth here. Read the weight the response carries; never quote one from
memory, and never rebuild a composite out of weights you assumed.

**The axis list is not closed either.** An axis absent from this table is read by
its own name and weight like any other — never ignored for being unfamiliar,
never folded into a row above because the name looks similar. Where its meaning
can't be established, disclose it by name without interpreting it.

Some of the headline is therefore documentation hygiene and popularity, in a
proportion this skill does not get to assume. **Never quote the composite as a
claim about the data.** Name the axis relied on, or say nothing about quality.
"Validity 95%, completeness 100%" is a statement a user can act on; "trust score
83" is not.

**An axis returning `score: null` is not a gap in the data.** It means no rule
evaluates that axis here — often because the check sits upstream, or because the
concept never needed one. **Infer no risk from its absence**: report the axis as
not evaluated and use the figures that were. Whether the tenant's control rules
are complete is Qlik governance's business, not this skill's; the figures that
exist are taken as given and the risk stated plainly.

It does affect comparison. An axis contributing to one headline and not to
another makes the **two composites incomparable** — check which axes carry a
score before comparing or ranking.

**Two axes are not the user's business.** `DISCOVERABILITY` and `USAGE` measure
documentation hygiene and popularity, not the data, and are **never disclosed as
a caveat on a figure** — someone asking whether a number is reliable is not
asking how well the dataset is tagged. `DISCOVERABILITY` is still worth reading
for yourself: a low score predicts thin descriptions and absent tags, exactly
when governed guidance will be missing and the narrower synonym tiers come up
empty. A forecast about your own sources, never a caveat about the figure.

**Say what an axis means, not what it is called.** "Validity" and "completeness"
are internal vocabulary. What a user can act on is the consequence, in one
sentence: *three records in a hundred carry a value that doesn't conform*, *one
record in twenty has nothing in this field*. One sentence, not a lesson.

## Pick the grain the answer actually reads

A dataset-level figure describes the whole table. A question reads a few of
its fields. Those are not the same statement, and the gap can flip a verdict:
a table can sit well below a governed minimum while the one field carrying the
counting grain sits comfortably above it, or the reverse.

**So evaluate a governed quality condition on the fields the answer reads,
whenever field-level figures are available** — they come back per field inside
`qlik_get_data_product_documentation`, as valid / invalid / empty percentages,
at no extra call. Fetch it once during discovery and cache it for the session.
`qlik_get_dataset_trust_score` is the fallback, reached only when the fields in
play can't be identified; say which grain you used when falling back.

Two habits send an answer to the wrong grain, and neither is a field-level
reading: picking a tool by its name — the one called *trust score* is the
table-grain fallback, not the first stop — and reusing the composite
`qlik_search` already returned per dataset, which describes the whole table.

So **one governed condition yields different verdicts for different concepts over
the same table**: a count keyed on a well-populated identifier passes while a
measure summing a sparse attribute fails. That is the condition working, not an
inconsistency to smooth over.

**Two limits, both worth stating rather than hiding:**

- **Field quality is computed over every row of the table, not over the rows
  a scope keeps.** A population the concept deliberately excludes still drags
  the field's percentage. So a field-level figure is finer than a table-level
  one and still not scoped to the question — when a large excluded population
  is the visible cause of a shortfall, say so instead of reporting the
  shortfall bare.
- **Empty and invalid are different failures.** Empty under-counts silently;
  invalid means values that don't conform. A condition phrased on "validity"
  does not constrain emptiness — read both, and name which one is short.

## What's confirmed to exist, and at what grain

| Grain | Call | Status |
|---|---|---|
| Data Product | `qlik_get_data_product(dataProductId)` → its own `quality` field (e.g. validity/completeness) | Confirmed |
| Dataset (table) | `qlik_get_dataset_trust_score(datasetId)` → multi-axis score (validity, completeness, accuracy, diversity, timeliness, discoverability, usage) | Confirmed |
| Field, within a dataset | `qlik_get_dataset_schema(datasetId)` for the field list and types, `qlik_get_field_values(appId, fieldName)` for the value domain | Structure and values, not a score. Per-field quality figures arrive with the Data Product documentation. |
| Master item | No direct call | Resolve via lineage — see below |
| Chart / sheet | No direct call | Same as master item — resolve the chart's underlying dimensions/measures, then their datasets |
| Whole app / dashboard | **No governed call, and none should be invented.** | See [Don't synthesize an aggregate score](#dont-synthesize-an-aggregate-score) |

Two data-quality-adjacent calls exist but are **not** part of this skill's
read-only flow: `qlik_update_dataset_quality` (triggers a new quality
computation — a mutating trigger, not a read) and
`qlik_get_dataset_quality_computation_status` (polls a computation this
skill never started). **Neither is called here.**

## Resolving a master item's trust score: two lineage paths

Neither path is "the" preferred one in general — try the cheaper one first
when it's available, and use the other as a fallback or to corroborate:

1. **Via the glossary, if a linking term already states it.** A term's
   `linksTo`, already in the cached export, can hold *both* a master item
   (`master_dimension`/`master_measure`) and a dataset/field
   (`dataset`/`field`). Where both sit on the same term, that term has done the
   lineage work: read the dataset link's `resourceId` and call
   `qlik_get_dataset_trust_score` on it. Nothing is called to reach it.
2. **Via `qlik_get_lineage(qri)`, always available.** Works whether or not a
   term covers the item; costs a dedicated call. Call chain and the attribution
   limit in [lineage.md](lineage.md#the-call-chain). Use it when path 1 doesn't
   cover the item, or to corroborate a lineage the glossary implied.

**The same two paths resolve a chart or a sheet**, through the dimensions and
measures it is built from — there is no chart-level score either.

**What an answer used may not all be traceable.** A chart's inline measures carry
no `libraryId` and no expression through this tool set, so nothing links them to
a dataset. Where an answer leans on one, the figures in hand cover only the part
that resolved: say the confidence read is partial and what it covers. **Never
phrase it as Qlik being unable to do lineage** — it is this tool surface, on this
object, and the user does not need that distinction.

If neither path resolves a dataset, say plainly that no trust score could be
resolved for that item — don't fall back to a guess.

## Don't synthesize an aggregate score

There is no governed "whole app" or "whole dashboard" trust/quality figure, and
none is invented. The per-dataset figures are the answer — "this dashboard draws
on three datasets; their trust scores are 92, 88, and 61".

**A plain average may be offered beside them, never instead.** Where a user needs
one number to hold, a mean of the datasets in play is admissible **as an
indication**: said to be one, given together with the figures it came from, and
never presented as governed or compared against a governed threshold. It carries
no weighting — a dataset the answer barely touches counts as much as the one it
rests on — which is exactly why it can gate nothing.

Never take the minimum, and never let the indication stand in for the detail.

## Critical-threshold gating

**Gating is opt-in, and the default is not to gate.** This skill never
evaluates quality on its own initiative; it does so only where the
organization has declared a condition for the concept in play.

**Where a condition may be declared**, in order of precedence:

1. **The glossary** — term, then category, then overview, narrowest winning.
   This is the preferred home: a quality condition is a statement about what a
   concept means well enough to be used for, which is what a glossary is for.
2. **A master item `description`** — accepted, and the natural fallback when
   no glossary is attached to the app. Narrower than any glossary entry, so it
   loses to one that covers the same concept.

Nowhere else counts. A figure being low is not itself a condition.

- **A condition is declared** → check the cached figure against it before
  answering. Below it: say so explicitly instead of presenting the number at
  face value. Above it: proceed, and disclose the figure anyway per
  [Disclosure](#disclosure-in-the-provenance-line).
- **No condition is declared for this concept** → skip the check entirely. The
  figure may still be disclosed, but it is informational only: never withhold,
  qualify or hedge an answer on a threshold nobody governed, and don't invent
  one because a question "feels" high-stakes.

### A governed condition names its axes, and is read in groups

A bare "trust score ≥ 80" cannot be enforced faithfully — the same headline is
reachable with excellent data and no documentation, or with mediocre data that
everyone uses. A usable condition names **which axes** it constrains and **what
bound** applies to each.

Recognizing one is the same exercise as recognizing a governed synonym block:
the tenant writes it in prose, and this skill reads it. Expect shapes like:

```
**Quality conditions**
- Data quality: VALIDITY >= 90, COMPLETENESS >= 95
- Freshness: reloaded within 2 days
- Discoverability and usage: not a gate
```

placed in the term's own rules or limitations section, or in the category's
framework term when the condition is shared across a family of concepts — the
same cascade as any other governed rule.

**Read the groups, report the group.** A condition is written per axis so it can
be checked without arithmetic, and grouped by intent so the answer can be said in
one clause. Three groups carry different meanings and never merge:

| Group | Axes | What a miss means |
|---|---|---|
| **Data quality** | validity, completeness, accuracy, diversity | The figure itself is doubtful |
| **Freshness** | timeliness | The figure is sound but describes an older state |
| **Not a gate** | discoverability, usage | Nothing about the answer — never disclosed as a caveat |

Met: name the group, not the axes — "meets the organization's data-quality bar".
Missed: give the **binding axis** as the single actionable number — "validity
61%, below the bar of 75". One figure the user can act on, produced by Qlik.

**Never compute a group score.** Averaging or renormalizing axes into one
"quality percentage" produces a number Qlik never emitted: untraceable,
unreplayable, and outside
[what may be done with a figure](governed-source-mechanics.md#what-may-be-done-with-a-figure-that-came-back).
Compare per axis, report per group.

**A condition naming no axis** is not resolved by picking one. Say it is ambiguous
as written, disclose the axis breakdown, and let the user decide.

**Freshness conditions are different in kind.** They constrain *when* an
answer is meaningful rather than how good the data is, so they interact with
temporal anchoring rather than with confidence — a stale dataset doesn't make
a figure wrong, it makes "current" mean something other than today.

**A score carries its own computation date, separate from the data's.**
`qlik_get_dataset_trust_score` returns it as `updatedAt`;
`qlik_search` returns it per dataset as `trustScoreUpdatedAt`, so it is in hand
from discovery at no extra call. Where a governed condition declares a
freshness bound for the score itself, compare the two, and where the score sits
beyond that bound say so plainly: it describes the dataset as it was measured,
not necessarily as it stands. **Do not request a recomputation.**

**A dataset reload is not evidence the data changed.** A load that rewrites an
unchanged upstream source moves the timestamp and nothing else. Never infer a
stale score from a load date. Only a declared bound, the tenant's own
timeliness axis falling, or the user saying so carries that.

Treat "no threshold found in the glossary" as "nothing governed to enforce,"
not as proof no threshold exists anywhere on the tenant.

## Refreshing a cached catalogue

Every catalogue this skill holds — Glossary Rules Ledger, Master Item
Catalogue, quality figures — is fetched once per session and never re-called
per question. **Never re-fetch on a timer.** Two signals, and only these, call
for a re-check:

- The user mentions a change ("I just fixed that field", "we reloaded this
  morning").
- The session overlaps build or governance work running in parallel — the user
  is iterating on the glossary or data product in this conversation or in a UI
  session alongside it.

On either, re-check lightly between questions (`qlik_get_dataset_freshness`, or
comparing a cached `updatedAt`) rather than re-fetching everything. Absent both,
the cached figures stand for the rest of the session.

## Disclosure in the provenance line

Once Data Product / trust-score data has been fetched this session, disclosing it
costs no call, so include it by default. **What gets said depends on the mode**,
and the two are not interchangeable.

**Production mode — one plain sentence, and only where it changes how the figure
reads.** Name the consequence, never the metric and never where the rule lives:

> Around 4% of these records carry no value on that field, so the count is a
> floor rather than an exact figure.

> This sits below the reliability bar the organization set for this concept —
> enough to see the shape, not to decide on.

A threshold that is **met** is not mentioned at all. Don't name the axis, the raw
score, or the governed entry the condition came from unless asked: *governed* is
the assurance the user needs, and the plumbing behind it is not theirs to carry.

**Verbose mode — the provenance field, identifiers included**, so the reading can
be replayed:

> **Data quality:** validity 95%, completeness 100% (field grain) — no governed
> condition for this concept.

> **Data quality:** validity 61% — below the governed minimum of 75 for this
> concept.

> **Data quality:** validity 95%; accuracy not evaluated on this dataset.

> **Trust score:** 88, resolved via the underlying dataset — no
> master-item-level score exists.

> **Trust score:** not available — no lineage path resolved a dataset for this
> item.
