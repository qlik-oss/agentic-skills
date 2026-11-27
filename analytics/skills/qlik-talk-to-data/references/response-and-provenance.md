# Response mode and provenance — detail

`SKILL.md` carries the operational rules: production mode is the default,
verbose mode is triggered per-question or made sticky, four things always
surface even in production mode, and the verbose provenance line is
mandatory. This file carries the detail behind those rules.

## Switching to verbose mode

**Verbose mode is a request for *method*, and nothing else opens it.**

- **For just the current answer**, when the question asks how the answer was
  produced — "why", "how did you get this", "show your sources", "show your
  working", "technical details".
- **For the rest of the session**, on an explicit mode switch — "switch to
  test/verbose/debug mode", "always show your sources". Same "sticky until told
  otherwise" pattern as active selections: confirm the switch in one short line,
  then stay until told to go back.

**That list is closed.** Naming a Qlik object, asking which item was used, asking
who owns it, or using the vocabulary fluently are **not** triggers — see
[Answering a technical question technically](#answering-a-technical-question-technically-and-only-it).

Every answer is computed with full rigor regardless of mode — the glossary
compliance gate and governed-source priority always run in full, and the
provenance is always worked out. What changes between modes is only what
gets **shown**.

## What production mode drops

`libraryId`, dataset/glossary/term names and IDs, which selection or scope
default silently applied, and the provenance labels themselves
(`Context:` / `Source:` / `Glossary rules applied:`).

## Naming the source in business language

Production mode drops the identifiers *and* the plumbing vocabulary. A
business user does not have to know that Qlik has a glossary, master items,
or a trust score to trust the answer — they need to know **what kind of
knowledge backs the figure**, in words they already use. Attribute a figure
by what the source does for them, never by its Qlik object type.

| What was actually used | Production-mode phrasing |
|---|---|
| Glossary overview / category / term rule | "based on the business knowledge available", "per the documented definition of <concept>" |
| Master measure or dimension | "from the organization's library of governed metrics and analyses" |
| Published sheet or chart | "from an existing published analysis" |
| Data product documentation | "per the documented data model" |
| Trust score, quality axis | "the organization's own reliability bar for this data" |
| Selection | "read for <business scope>", "filtered on <business term>" |
| Field, flag, status code | the business name for the concept — never the technical name |

The *concept's* own name is not jargon and stays: a metric or term the
business already says out loud is the user's vocabulary, not the tool's.
What is dropped is the category noun around it. And an alias only ever
comes from governed content — never invent a friendlier name for a governed
concept because the real one sounds technical.

### Answering a technical question technically, and only it

A question naming a Qlik object — "which master item is that", "is it in the
glossary", "what's the trust score", "who owns it" — asks for **one fact**, in
that vocabulary. Give that fact, at that precision, and **leave the rest of the
answer in production mode**. Asked for a master item's description, give the
description; not its `libraryId`, not the selection that applied, not the
provenance line.

**Speaking Qlik is not asking for the plumbing.** Analysts use this vocabulary
routinely without wanting identifiers, method, or a debug view. Widening the
whole answer because one word was technical imposes that view on someone who
asked something narrow — and the wider it is imposed, the less any of it gets
read.

Everything here is about *wording*, never about content. A caveat, a refusal, a
threshold miss or a wiring mismatch is never dropped — stated in plain
language, without the object type. Softening the vocabulary is not a licence to
soften the message, and keeping it short is not the same as leaving it out.

## What production mode never drops

1. A **refusal** (compliance-gate item 4) — two sentences in plain language:
   what isn't available, then what can be answered instead. Not dropped just
   because it's unwelcome, and not argued either.
2. A caveat that changes **what the number means**, not just where it came
   from — e.g. "this is a design-ceiling figure, not achievable cargo
   intake." State it as a plain sentence, without naming the source term
   or field it came from.
3. A **governed trust/quality threshold miss** (compliance-gate item 7) —
   say plainly that the figure is below the organization's own reliability
   bar for this concept; leave out the raw score and axis name unless
   asked. A threshold that is *met* is never mentioned at all.
4. A **governed-item mismatch you ran into** — say
   plainly that one of the app's governed items doesn't match the
   documented definition and that the answer used the documented field
   instead; name the items only in verbose mode.

## Worked example — same question and answer, different mode

> *Verbose:* "...4,485,934 units... **Context:** [governed default-scope
> condition, per glossary term] · **Source:** [master measure, libraryId]
> · **Glossary rules applied:** [...] · **App/owner:** [...]"
>
> *Production:* "Total contracted capacity is **4,485,934 units** (active and
> reserved contracts currently in force) — a contractual ceiling, not the
> volume actually delivered in any period."

## The verbose provenance line, field by field

> **Context:** [continuing under: Field=Value, ... / no active selection;
> temporal anchor if relevant, e.g. "current year = 2023, data's latest"]
> · **Source:** [master item / data product / existing chart] · **Glossary
> rules applied:** [ledger entries checked — e.g. "default scope Active
> Contracts; terminated n/a; alias used" — or "none apply"] · **Trust
> score:** [if checked] · **Freshness:** [last updated] · **App/owner:**
> [app name, owning space]

### Glossary rules applied

Mandatory whenever a glossary was loaded — it is the written proof the
compliance gate ran for this answer. Omitting it when a glossary exists
means the gate was skipped; redo the answer.

### Trust score

Stops being "if checked" once a Data Product / dataset trust catalogue has
already been loaded this session — at that point disclosing it is free (no
extra call), so include it by default rather than only when something
prompted a check.

If a governed threshold gated the answer (compliance-gate item 7), say so
explicitly here too, e.g. "trust score 92 (validity), meets the term's
governed minimum of 80" or "trust score 61, below the category's governed
minimum of 75 — treat this figure with caution."

### Context

The **Context** line is what makes continuing active selections safe to
apply without asking first — it makes the assumption visible so the user
can correct it with their next message if it wasn't their intent.

The same line is where a glossary-driven default belongs too — if the
glossary rules layer picked the scope, period, or label used in the answer,
name it there (e.g. "scope: [default scope name], per glossary default") so
it's just as easy to override.

Likewise, when a master item's description and its linked glossary term
defined the metric differently and you kept the description, say so here
(e.g. "meaning: per master item description; linked glossary term differs")
— the disagreement is worth surfacing, not hiding.

## When nothing governed covered the question

Say so explicitly instead of producing a number — that's a signal the
organization may be missing a master item, not something this skill should
paper over by computing it itself.
