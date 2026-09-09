# Glossary guidance — mechanics

Read this when [SKILL.md — Glossary as a behavioral-rules layer](../SKILL.md#glossary-as-a-behavioral-rules-layer)
isn't enough detail on *how* to fetch and use glossary-level guidance.

## Fetching glossary-wide guidance

`qlik_get_full_glossary_export` returns, in one call, the `overview`
(glossary-wide behavioral rules), every category description, and every term
with its full description, tags, `relatesTo` relations and `linksTo`
resources. Issue it once, the first time a glossary is confirmed to exist for
the app in question (see
[SKILL.md — Discovery first, step 3](../SKILL.md#discovery-first-every-time-before-calculating-anything)),
and cache the result for the rest of the session — the same way an app
profile is read once and then relied on. Never re-issue it per question.

**`description` is not `overview`.** The `description` a glossary returns
from `qlik_search` is a short label; the governing rules live in `overview`,
which no other call returns. Reading the search result instead leaves every
glossary-wide rule unread.

**After that call the glossary is entirely in memory.** Every later lookup — a
term, a relation, a tag, an alias, a `linksTo` — is a scan of that cache, never
a new call, which is what makes reading a related term's content the default
rather than an expense (see
[SKILL.md — Glossary as a behavioral-rules layer](../SKILL.md#glossary-as-a-behavioral-rules-layer)).
Match the way a reader would: ignoring case, accents and surrounding text.
`qlik_search_glossary_terms`, `qlik_get_glossary_term`,
`qlik_get_glossary_term_links` and `qlik_get_glossary_categories` are reached
only if the export failed.

The `overview`/`description` fields returned are Slate rich-text JSON
(`{children:[{text:…}]}` nodes, not plain prose) — flatten by concatenating
every `text` node in order before reading; don't transcribe the raw JSON
into the Rules Ledger. A large glossary can exceed the tool's output cap and
be written to a file instead: parse that file for the fields needed rather
than reading it end to end.

## The reverse-lookup gap: master item, glossary term

A term declares the resources it links to — dimension IDs, measure IDs, app
IDs. Nothing declares the reverse. Discovery finds the master item first
(`qlik_list_dimensions` / `qlik_list_measures`), and "does a governed
definition or behavioral note exist for this item" is the natural next
question.

This lookup is also the step that decides *which precedence row applies*
in [SKILL.md — Resolving a master item's meaning](../SKILL.md#resolving-a-master-items-meaning-description-vs-linked-glossary-term):
you can't tell "description only" from "both description and term" without
first establishing whether a term links to the item. So when an item has a
description and the question turns on what the metric *means*, run this
lookup before treating the description as the sole source — don't default
to "no term" just because there's no direct call for it.

**Scan the cached export.** Every term carries its `linksTo`; the term wanted
is the one whose array holds the master item's ID. No call, and exhaustive
where a name search is not.

Only where the export failed does a name search approximate it —
`qlik_search_glossary_terms(glossaryId, searchText=<the item's label>)`, since
terms and their linked items are usually named alike. Confirm any hit against
its own `linksTo`. Such a search can also land on a *synonym* term rather than
the governed one: where the hit's `linksTo` is empty but it carries a
`relatesTo`/`referredRelations` of type `synonym`/`preferredTerm`, follow that
relation to the term that actually links to the item, per
[Where a term's synonyms come from](#where-a-terms-synonyms-and-alternate-names-come-from).

If nothing resolves it, say plainly that no governed term was found for
that item rather than guessing at one — see
[Absence is a normal, reportable outcome](#absence-is-a-normal-reportable-outcome)
below.

## Verifying a master item's wiring — worked example

The rule is in
[governed-source-mechanics.md](governed-source-mechanics.md#verify-a-master-items-wiring-against-the-glossary).

A glossary documents a scope-filter hierarchy distinguishing `SCOPE_A_FILTER`
from `SCOPE_B_FILTER`. A master dimension named "Scope A", with consistent tags
and an empty description, actually resolves to `SCOPE_B_FILTER`. Having seen it,
the answer is computed by selecting on `SCOPE_A_FILTER` and reading the base
count measure, and the divergence is mentioned rather than buried.

Only divergences the glossary makes visible surface this way.

## Where a term's synonyms and alternate names come from

The meaning rule in
[SKILL.md — Resolving a master item's meaning](../SKILL.md#resolving-a-master-items-meaning-description-vs-linked-glossary-term)
says to keep a term's synonyms as alternate names in every case, even when
its definition is set aside. A term carries alternate-name material in three
distinct places — read all three, in this order of authority:

1. **Term-to-term relations — the canonical synonym source.** `relatesTo`
   (this term → another) and `referredRelations` (another term → this one)
   are typed relationships; the `type` can be `synonym`, and related types
   `preferredTerm` / `seeInstead` / `seeAlso` point at the term the
   organization would rather you name. A `type: "synonym"` link is an
   explicit, governed statement that two names mean the same concept — use
   these first, and prefer the `preferredTerm` for the answer's wording.
   `replacedBy` / `replaces` are lifecycle, not synonymy — handle them per
   [Term lifecycle in practice](#term-lifecycle-in-practice), don't treat a
   superseded name as a live alias.

   **Verify these relations — don't stop at the type flag.** Each
   `relatesTo` / `referredRelations` entry is only `{type, termId}`: it
   names *that* a synonym exists, not *what* it is. To get the actual
   alternate name, resolve each entry whose `type` is `synonym`,
   `preferredTerm`, or `seeInstead` in the cached export and read that term's
   `name` (and its own `status` — a
   `deprecated` synonym isn't a live alias). Both directions matter:
   `referredRelations` catches a *separate* term that declares itself a
   synonym *of* this one, which a search on this term's own name would
   miss. Do this whenever you're assembling the alternate-name set for a
   term — for recognition or for wording — rather than assuming the
   relations are empty because the first term object didn't spell the
   synonym out inline. When a relation points at a `preferredTerm`, that
   resolved name is the one to surface in the answer, even if the user
   (or a master item) used the non-preferred synonym.
2. **`abbreviation` — the short form.** A single governed short form (e.g.
   "EBIT") to recognize in a user's phrasing and, where the glossary
   prefers it, to use in the answer.
3. **`tags` — an opportunistic source, judged one tag at a time.** `tags` is a
   free-form list, in any language, with no prefix or separator convention to
   match. A tag is a candidate alternate name when it reads like a business
   phrasing a user might actually type for this concept; it is ignored as a
   synonym when it reads like a classification or lifecycle label (`Finance`,
   `tier3`, `upgrade`). Never assume every tag is a synonym — that mislabels
   classification tags as metric names. Language is not a filter: read every
   tag whatever language it is written in.

Managing vocabulary synonyms is a Qlik Cloud admin-UI task (see
[mcp-vs-ui-capability-boundary.md](mcp-vs-ui-capability-boundary.md)).

## `relatedInformation` as context and as a synonym source

A term carries a `relatedInformation` field, separate from `description`. Read it in full whenever non-empty, the
same as `description` — it can carry any context the term's author judged
worth adding beyond the formal definition. Flatten it the same way as
`description`/`overview` before reading — Slate rich-text JSON, concatenate
every `text` node in order (see
[Fetching glossary-wide guidance](#fetching-glossary-wide-guidance)).

**A specific block inside it is a governed synonym source, checked alongside
`tags` — a second source at the same tier, not a fallback.** When
the flattened text contains a line reading exactly `**Business synonyms &
aliases**` followed by one bullet per language, e.g.:

```
**Business synonyms & aliases**
- EN: <alias>, <alias>, <multi-word alias>, <abbreviation>
- <CC>: <alias in that language>, <alias>, <multi-word alias>
```

— treat every comma-separated phrase after the `<CC>:` prefix as a certain,
governed alternate name for the term: the block's own format governs it, where
a `tags` entry is judged one at a time (see
[point 3 above](#where-a-terms-synonyms-and-alternate-names-come-from)). Scan
every `<CC>:` line, not only the one matching the question's language.

This is a **double search**: check `tags` and this block together when
assembling a term's alternate-name set — a hit in either is sufficient, and a
term often carries synonyms in only one.

The `<CC>:` prefix belongs to this block and to nothing else — tags carry no
prefix convention.

Text in `relatedInformation` that does **not** match this block format is
free-standing context only — read it, but don't treat other prose there as an
implicit synonym list. An empty field is read the same as an empty
`description` (see
[Absence is a normal, reportable outcome](#absence-is-a-normal-reportable-outcome)),
not a signal to look elsewhere for the same content.

## Rule cascade via `hasSubtype`/`isA` — mechanics

[SKILL.md — Glossary as a behavioral-rules layer](../SKILL.md#glossary-as-a-behavioral-rules-layer)
states that a rule on a broader term applies to its `hasSubtype`/`isA`
narrower terms too. Detecting this needs both relation directions, the same
way synonym resolution does (see point 1 above):

- The **broader** term's own `relatesTo` may declare `hasSubtype` entries
  pointing at each narrower term directly.
- A **narrower** term may instead declare `isA` in its own `relatesTo`,
  pointing up at the broader one — or the broader term's `referredRelations`
  may show the reverse `hasSubtype` link contributed by the narrower term.
  Check both; a narrower term's own object doesn't always carry the
  relation if the broader term is the one that declared it.

When a term you're about to use for an answer has an unresolved
`hasSubtype`/`isA` relation in either direction, resolve it in the cache before
deciding whether a rule from one side applies to the other — the same
verification discipline as synonym relations (don't stop at the type flag).

## Applying aliases to the answer's wording

If the glossary overview or a term defines a business-facing alias for a
technical field, or forbids surfacing raw field names, use the alias in
the answer's prose — this is a presentation instruction that applies
regardless of which master item, chart, or data product ended up
answering the question.

## Resolving relations and pointers

A term comes back with its relations as bare IDs, and with prose that may
point at another term. Both are followed the same way.

**Resolving is not cascading.** *Resolving* a relation means reading the
related term's own content; it is always in scope, and once the glossary is
cached it is a lookup, not a call. Do it before deciding, whichever end of the
relation the question landed on — a child term rarely repeats what its parent
already governs. *Cascading* means applying that term's rules to the answer,
and it is narrower: a rule cascades to `hasSubtype`/`isA` relatives unless the
narrower term says otherwise, while `seeAlso`, `synonym` and `other` do not —
proximity and naming relations are not a hierarchy, and treating them as one
applies a rule to a merely-related concept it was never written for. A
relation that does not cascade is still read: it is how a caveat, a limitation
or a pointer written next door gets seen at all.

**A pointer in a term's text is an instruction.** "Read this first", "shared
rules apply", "see the general term", "respect the rules of the framework
term" — these are the steward telling the reader where the binding rules sit,
not a bibliography. Resolve what the pointer names and apply it before
answering. If it cannot be resolved, say the guidance could not be read rather
than answering around it.

**A pointer can name an app object, not only another term.** Governed content
sometimes names the dashboard, sheet or chart that carries a concept — the
preferred route to it, an accelerator, or context around a term, a category or
the whole glossary. Prefer the source it names over rediscovering another, and
read the context it adds before answering. Confirm the object exists and is
published first: a governed pointer does not make an unpublished sheet usable
(see [sheets-and-visualizations.md](sheets-and-visualizations.md)).

## Category-level rules can live in a term, not in the category description

The three levels in
[SKILL.md — Glossary as a behavioral-rules layer](../SKILL.md#glossary-as-a-behavioral-rules-layer)
(overview, category description, term description) describe where rules are
*meant* to sit. In practice a glossary often carries its category-level
rules inside a **term** instead — one term per category acting as its
header, holding the rules, vocabulary and limitations that every other term
in that category inherits.

**How to spot one**: it usually announces itself — a name suffixed
*Framework*, *General*, *Overview*, an opening line like "read this first",
or a description that defines no population of its own but states rules,
a hierarchy and shared limitations. Structurally, it is the term the others
point at: many `hasSubtype`/`isA` relations converge on it, and sibling
terms reference it in prose ("shared rules apply", "see the general term").

**How to use it**: read it once per category, before the specific term, **in
addition to the category description and never instead of it** — both bind the
terms underneath, and a category description that exists is read whether or not
a framework term also exists. The specific term then carries only what is proper
to it. When a rule appears in more than one, the most specific wins.

Its absence is not a defect: many glossaries put nothing at category level
at all. Report absence as usual (see
[Absence is a normal, reportable outcome](#absence-is-a-normal-reportable-outcome))
rather than inferring rules that nobody wrote.

## Applying precedence in practice

This ladder governs *behavioral rules* — scope, default, date handling,
phrasing. It is a different axis from *what a metric means*: when a master
item description and a linked term define the same metric differently, the
description leads regardless of this ladder (see
[SKILL.md — Resolving a master item's meaning](../SKILL.md#resolving-a-master-items-meaning-description-vs-linked-glossary-term)).
For behavioral rules, when multiple levels of glossary guidance are in play
(glossary overview, category description, term description) alongside the
user's own wording, resolve them in this order, narrowest exception first:

1. What the user's current question explicitly asks for.
2. The most specific glossary rule that covers the situation — a term
   description beats a category description, which beats the glossary
   overview, when more than one actually addresses the same point.
3. This skill's own generic defaults (e.g.
   [SKILL.md — Temporal reasoning](../SKILL.md#temporal-reasoning-anchor-to-the-data-not-the-wall-clock)).
4. Anything else is a judgment call — treat it as genuinely ambiguous and
   ask, per
   [SKILL.md — Multiple declinations of the same concept](../SKILL.md#multiple-declinations-of-the-same-concept).

Disclose in the **Context** line whenever step 2 changed what the answer
would otherwise have been (see
[SKILL.md — Reporting with provenance](../SKILL.md#reporting-with-provenance)).

## Term lifecycle in practice

A term's status (`draft` / `verified` / `deprecated`, where exposed by
`qlik_get_glossary_term`) is a confidence signal, not a hard filter:

- Prefer a `verified` term over a `draft` one when both plausibly answer
  the same question.
- A `draft` term is still usable if it's the only candidate — say so
  ("based on a draft glossary definition, not yet verified") rather than
  silently treating it as equally authoritative.
- A `deprecated` term should prompt a check for whatever superseded it — scan
  the same category in the cache — before being used to justify current
  behavior. It was deprecated for a reason, usually "replaced".

## Absence is a normal, reportable outcome

Not every app has a glossary, and not every master item has a linked term.
**Neither is an anomaly.** A master item carrying its own `description` can hold
a concept on its own, and an empty `description` only means no caveat was
written. Absence is not itself reported.

What is reported is a **doubt about answering**: where what is missing leaves
the concept genuinely ambiguous — two plausible readings, a scope nobody
defined, a metric whose population can't be established — say so, and say what
would settle it. Where nothing is ambiguous, answer and say nothing about what
was absent.

Never invent a naming convention, an alias or a default that is governed
nowhere.

## Synonym tiers 2 and 3 — master-item `tags` and app-field `synonyms`

`SKILL.md` states the three-tier order. Tier 1 (glossary term `tags` +
`relatedInformation` synonym block) is covered above. This section covers
what to expect from the two narrower tiers.

**Tier 2 — master item `tags`.** A native property on
`qlik_list_dimensions` / `qlik_list_measures` results, structurally
identical to a glossary term's `tags` but populated independently of any
glossary. It matters most exactly when
[Absence is a normal, reportable outcome](#absence-is-a-normal-reportable-outcome)
applies to the glossary itself — it's the one remaining structured place a
business alias could still be governed.

Match against the already-cached Master Item Catalogue. Judge each tag the
same way as a glossary-term tag
([point 3 above](#where-a-terms-synonyms-and-alternate-names-come-from)): a
candidate alias only when it reads like business phrasing, not a
classification or lifecycle label.

**Tier 3 — app-field `synonyms`.** `qlik_describe_app`, already called once
per app during discovery, returns each field with its own `synonyms`
property: the app's own field-synonym slot,
scoped to one physical field of one app — narrower than a glossary term,
which spans every app/dataset attached to a data product. Read it the same
opportunistic way as master-item `tags`, when the broader tiers don't cover
a field.

**Neither has an MCP write path.** This server's `qlik_create_dimension` /
`qlik_update_dimension` / `qlik_create_measure` / `qlik_update_measure`
tools don't expose a `tags` parameter, and no tool writes `synonyms`. Where a
tier comes up empty and it matters, say plainly that no governed alias was
found and that populating one is a Qlik Cloud editor action — the master-item
editor, or the app's field-synonym editor.

**Caching.** Both are already fetched during discovery — master-item `tags`
as part of the Master Item Catalogue, app-field `synonyms` as part of the
`qlik_describe_app` call. Hold both in the same session-long cache; never
re-call either tool just to re-read `tags` / `synonyms` later in the
conversation.

## Resolving description-vs-term conflicts (detail)

**The decision table.** When an item has both a `description` and a linked
term defining *what the metric means* differently, use one source of truth,
not an average. The description is primary — written for that item, in that
app; the glossary adds context only where it doesn't contradict.

| Situation | Meaning to use |
|---|---|
| Description only, no linked term | The description. |
| Linked term only, no description | The term's definition; its synonyms are alternate names for the concept. |
| Both, and they agree | The description is primary; the term's definition and synonyms add supporting context. |
| Both, but they define it differently | The description only — set the glossary *definition* aside. Synonyms still apply. |

**Agreement or contradiction is a reading of intent, not a string
comparison.** Different wording for the same population and calculation is
agreement; a difference that would change the *number* is contradiction. A term
saying "active customers billed this fiscal year" and a description saying
"count of customers with ≥1 paid invoice in the current FY" agree; a term
saying "all customers with any order" against a description restricted to a
*paid* invoice contradict.

Two things always survive such a conflict: the term's **synonyms and
business aliases** (for recognizing the user's phrasing and wording the
answer), and **orthogonal glossary rules** (default scope, date handling) —
neither is part of the contested definition.

On synonyms specifically, see
[Where synonyms come from](#where-a-terms-synonyms-and-alternate-names-come-from).

Picking the right row of that table first means knowing whether a term
links to the item at all — and there is no direct master-item→term call. Run the
[reverse-lookup workaround](#the-reverse-lookup-gap-master-item-glossary-term)
before concluding "description only": a term may exist and simply not have
been found yet. When a conflict makes you fall back to the description alone,
say so in the provenance line — a description and a governed term disagreeing
is a signal the organization may need to reconcile them, not something to
bury.
