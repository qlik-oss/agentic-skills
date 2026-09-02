# The master item library — mechanics

Read this when [SKILL.md — Master items: the governed library of metrics and
dimensions](../SKILL.md#master-items-the-governed-library-of-metrics-and-dimensions)
isn't enough detail on *how* to hold and re-check this content.

## What the library is, and how it sits beside the glossary

`qlik_list_dimensions` / `qlik_list_measures` return **the organization's
governed, documented library of its analysis axes and its metrics** — indicators
and KPIs, each with a name, a label, tags and a description. It is a source of
truth in its own right, not an annex to the glossary: **where no glossary is
attached, it is the source of truth**, less discursive by design but no less
governed.

The two carry different things. The glossary holds *business* rules — scope,
alias, default, and a concept's relations to other concepts. An item's
`description` holds what that item's author needed a reader to know: what the
concept means, plus what a glossary would never carry — a selection defect on
one field, an open item on completeness or reconciliation, and whether a
composite calculation a question needs (a union, an intersection, a
multi-condition count) **already exists** as a single governed item.

**Both apply together; neither substitutes for the other.** A glossary term
covering a concept does not mean the item implementing it has no description
worth reading.

They compete in one case only: description and linked term defining *the same
metric* differently. That resolves in the description's favour — the
four-situation table, the agreement-vs-contradiction judgment and the
disclosure wording are in
[glossary-guidance.md](glossary-guidance.md#resolving-description-vs-term-conflicts-detail).

## Loading the library: a batched fill, finished before the first answer

**The whole catalogue is cached. What is batched is the filling of it, not the
reading of it** — no size threshold to judge, and nothing deferred to
question time.

**1. The index, complete, first.** Every item's `id`, `name`, `label`, `tags` and
type, from one `qlik_list_dimensions` and one `qlik_list_measures`. Short strings:
several hundred items still cost less than the glossary export for the same app.
**The index is never partial** — an item that was never listed cannot be
considered a candidate, and "nothing governed covers this" then becomes a false
statement rather than a finding.

**2. Descriptions, looped in batches until exhausted.** One batch per call, using
whatever `limit`/`offset` the tool exposes; where a response overflows the output
cap and is written to a file instead, parse that file in chunks rather than
reading it end to end — the same handling as an oversized glossary export.

**Order the loop so an interruption is survivable**, since a batch can fail or a
catalogue can be larger than the session has room for:

1. **Items a glossary term links to.** Free to identify — the export cached at
   discovery step 3 carries every term's `linksTo`. These are the items the
   organization has already bound to a concept, so they are the ones a question
   is most likely to land on.
2. **Everything else**, in returned order.

**The loop finishes before the first substantive answer**, so a question never
waits on a description arriving. If it genuinely cannot — the catalogue is
enormous, or a batch keeps failing — the complete index still guarantees no item
is invisible: read the missing descriptions for the candidate set at that point,
say the catalogue is held partially, and continue filling between questions.
**That is the interrupted case, not the strategy.**

## Composition trigger: re-survey before hand-assembling a combination

Regardless of which of the two modes above is in effect, treat "the
catalogue was surveyed once, earlier in this session" as covering
single-concept questions only. Before manually deriving a union,
intersection, ratio, or any other combination of two or more separately
governed scopes or dimensions — for example, "owned or chartered," "LNG
*and* under construction" — re-run `qlik_list_measures` /
`qlik_list_dimensions` (or a targeted `qlik_search`) first to check
whether a single master item already encodes that exact combination. A missed
composite item produces a plausible, non-governed number with no error to flag
it.

**If the re-survey finds nothing**, don't fall back to computing the
union/intersection by hand from raw field values — say plainly that no
governed item covers the composite question and stop (see
[SKILL.md — Governed-source priority](../SKILL.md#governed-source-priority)).
Combining two separately governed measures is not a safe substitute:
`Count(Distinct A) + Count(Distinct B)` over-counts the moment the populations
overlap, and which fields are safe to union or intersect depends on keys and
grain specific to that data model. Set-based cohort analysis — unions,
intersections and differences over governed populations — is out of scope for
this skill.

## Tags as a synonym source

Judge a master item's `tags` exactly as a glossary term's — see
[glossary-guidance.md](glossary-guidance.md#where-a-terms-synonyms-and-alternate-names-come-from).
Match against the cached catalogue, ignoring case and accents.

## Freshness

An app owner can add or update a measure while the conversation is open. On the
refresh triggers in
[trust-and-quality.md](trust-and-quality.md#refreshing-a-cached-catalogue),
re-survey: `updatedAt` on the returned items shows what changed since the
session started.

## Trust score is a separate signal, resolved separately

A master item's `description` documents its *behavior* (selection defects,
composite-calculation coverage). It says nothing about the *trust/quality*
of the data behind it — that's resolved via lineage (through a linking
glossary term, or `qlik_get_lineage`), not read from the item itself. See
[trust-and-quality.md](trust-and-quality.md) for the two lineage paths. A
master-item-level trust score is never invented directly.
