# Governed-source priority — mechanics

The ordering itself (**Master Item → Data Product documentation → existing
sheet/chart, optionally narrowed by a selection**) and the "stop and say so
if nothing covers it" rule live in `SKILL.md`. This file carries the
mechanics behind each step: how to mobilize a governed item, when a
composite object outranks the items it is built from, and how to check that
an item is wired the way the glossary says it is.

## The ordering ranks data sources, not the glossary

The glossary isn't a source to pick between the others — it's a rules layer
that applies regardless of which source above ends up used. See
`SKILL.md` → *Glossary as a behavioral-rules layer*.

That rules layer also qualifies the source, not just the answer. The app
carries the *analytical* logic (master items, data model, charts); the
glossary carries the *business* logic and usage context for those same
objects — including, sometimes, which fields actually implement a concept.

**It is also where a concept's relations to other concepts live** —
`isA`/`hasSubtype`, `synonym`/`preferredTerm`, `seeAlso`, and the links from a
concept to what implements it. **This skill consults no other source of business
semantics**, so a structural question about how two concepts relate is answered
from the glossary or not at all. **Those relations are read, never derived**:
apply what is declared, and never infer a relation the glossary does not state —
a hierarchy that looks obvious from two names is not a governed one.

## Reusing a master item does not require an existing sheet

`qlik_create_data_object` accepts a `libraryId` on a measure or dimension
in place of `expression`/`field` — this pulls a governed master item into
any fresh dimension/measure combination the question needs, while Qlik
still executes the item's real, unmodified formula.

This is the default way to answer "[governed metric], but cut by [dimension
it isn't currently shown by]" — build via `libraryId`, not by reading the
master item's expression and retyping it.

## A selection can turn "no chart answers this" into "yes, this one does"

An existing chart or master item that isn't sliced the way the user asked
is not automatically a reason to conclude nothing covers it — select the
missing value (`qlik_select_values`) and re-read the same chart
(`qlik_get_chart_data`) or re-pull the same master item via `libraryId`.
See [selections-and-search.md](selections-and-search.md) for what's
confirmed to work through this MCP server (and what looks supported but
currently isn't — a fuzzy-search defect is documented there).

## Filtering a governed measure is not the same as reimplementing it

If a master item already calculates what's needed and the only gap is an
extra filter on some dimension, the sequence is:

1. Confirm the filter value exists (`qlik_get_field_values` /
   `qlik_search_field_values`).
2. `qlik_select_values` on that dimension.
3. Reference the master item by `libraryId` in `qlik_create_data_object`.

Qlik's associative engine scopes the master item's own calculation to the
active selection automatically — no need to see or approximate its formula.
Never retype it as a hand-written expression instead. If a case genuinely
can't be expressed via `libraryId` plus a selection, say so and stop.

## When one question spans several governed concepts

**An existing object that renders them together outranks the master items
it is built from.** The ordering in `SKILL.md` compares sources for *one*
figure. It does not mean pulling N master items one at a time when the app
already publishes a chart covering all N — a breakdown across a whole
family of related metrics, a per-entity table combining attributes that
live in different master items, a comparison the app already lays out side
by side.

Reading that object once is both fewer calls and a more faithful reading:
the figures come out mutually consistent, computed in a single pass,
exactly as the app's owner arranged them. Sequencing master items instead
reconstructs by hand something already governed, and each extra
select-then-read round trip is latency the user pays for.

**Two conditions before relying on such an object:**

- **Check the active selections first.** A composite object is only "the
  whole picture" when nothing is filtering the fields it breaks down by.
  With a selection active on one of those fields it silently shows a
  subset — still a valid chart, no error, just not the answer to the
  question asked. Call `qlik_get_current_selections` and confirm before
  reading it as complete.
- **Read what it actually contains, not what its title suggests.**
  `qlik_get_chart_info` returns its real dimensions and measures
  (`libraryId` included). A chart named for a concept may be built on a
  different one.

## Verify a master item's wiring against the glossary

**This skill does not audit governed content.** Master items are taken at
face value; systematically checking each one's `field` / `expr` against the
glossary before use is the job of the build/govern skill, not of answering a
question. What follows applies only when a mismatch surfaces on its own.

A master item's name, label and `tags` are human-authored metadata and can
disagree with the `field` / `expr` it actually resolves to — silently, with
no error. So it happens that the glossary names the field implementing a
concept and the candidate item plainly resolves to another.

**What is compared**: the `field` (dimensions) or `expr` (measures) already held
in the Master Item Catalogue, against a field the applicable term happens to
name. Where the term documents no implementation, there is nothing to notice.
On a divergence:

- Don't use that item for that concept.
- Fall back to the glossary-documented field — a selection on a raw field
  authors no expression.
- **Say so in the answer, in every response mode.**

Never go looking for the discrepancy, and never infer a "correct" field from
the item's name alone.

Worked example in
[glossary-guidance.md](glossary-guidance.md#verifying-a-master-items-wiring--worked-example).

## Multiple declinations of the same concept

Metadata discovery (`qlik_list_measures` / `qlik_list_dimensions` / search)
can surface more than one governed item that plausibly answers the same
question — a base indicator alongside one or more variants scoped by a value
on some analysis axis.

**That axis is whatever the app's own metadata exposes, never assumed in
advance.** It is not necessarily time, and there is no fixed catalogue of
"kinds" of variants to check against. Whether multiplicity is actually
present, which candidate(s) to use, whether it's worth asking the user, and
what a relationship between candidates implies — all of that is a judgment
call made from what discovery returns for *this* app, not a fixed algorithm.

**Ask only when it's genuinely ambiguous.** Don't manufacture ambiguity when
it isn't there, and don't add friction to an unambiguous question.

**Check governed guidance before asking.** A glossary overview or category
description sometimes already pins the default candidate or the valid
candidate set for a concept. When it does, that resolves the multiplicity —
asking the user at that point would add friction the governance layer
already removed.

**A composite question is a special case of this, not a separate problem.**
"X or Y", "X and Y", "X but not Y" across two governed concepts may already
be one master item's own expression — see
[master-item-descriptions.md](master-item-descriptions.md#composition-trigger-re-survey-before-hand-assembling-a-combination).

## What may be done with a figure that came back

The engine computes; this skill chooses what to ask it for. Two operations on a
returned figure are nonetheless allowed, because neither can change what it
means:

- **Ordering or ranking rows already returned.** The values are unchanged; only
  their sequence is.
- **Stating the difference between two figures of the same measure at the same
  grain.** Same definition, same population shape, so the subtraction carries no
  new assumption.

Everything else stays out, and **the number of rows is never the criterion**.
The failures are semantic, not arithmetic, and they land identically on five
rows and on five thousand:

- adding distinct counts over populations that overlap — the sum double-counts
- averaging averages — the weights are lost
- rebasing a percentage on a denominator the engine did not return
- combining two figures read at different grains

Each returns a credible number, which is what makes them dangerous. A figure the
engine did not produce also cannot be traced back or replayed.
