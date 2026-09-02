# qlik-talk-to-data

**Ask questions of a Qlik Cloud app in plain language, and get answers that come
from what the organization already governs — not from what the model reinvents.**

Read-only. Nothing is created, nothing survives the session.

---

## Who this is for

Most people in a company are not analysts. They read dashboards, open a report,
and look at a figure someone else built. When they have a question the dashboard
does not answer, they ask a colleague — or they stop asking.

This skill is aimed at **those 80%**: people who consume guided analytics rather
than build it. The Qlik engine can do far more than what a published sheet shows,
and this skill lets an agent explore that — **on a governed basis**, so the
figures stay the ones the organization stands behind.

It is not aimed at replacing an analyst. An analyst writing set analysis is doing
something this skill deliberately does not do.

---

## What it does

| | |
|---|---|
| **Finds the right concept** | Reads the glossary, master items and published sheets before concluding anything is missing |
| **Applies the organization's rules** | Default scope, reading period, business aliases, refusals — from governed content, not from guesses |
| **Lets the engine calculate** | Narrows with a selection and reads a governed item; never re-aggregates a returned figure |
| **Says when it cannot answer** | "Nothing governed covers this" is a valid answer, and a useful one |
| **Shows its work on request** | Which item, which term, which rule — on demand, not by default |

## What it will not do

- **Write a Qlik expression that produces a figure.** No set analysis, no
  hand-typed measure. One narrow exception exists — a selection predicate, which
  chooses *which rows*, never *what number*.
- **Create or modify anything.** No master items, sheets, charts, glossary terms.
  A bookmark, on explicit request, is the only exception.
- **Compute over what came back.** Ordering rows and stating the difference
  between two figures of the same measure are allowed. Everything else is not.

That last rule is the strict one. It is also the one that keeps answers accurate.

---

## Why governance is the whole point

An agent that queries data freely will be right most of the time and confidently
wrong the rest. **The failures are not arithmetic — they are semantic.** Two
plausible definitions of "active customer", a scope nobody stated, a date axis
read at the wrong end. Each returns a credible number with no error.

Governed content is what removes the ambiguity, and it is already there in most
Qlik tenants. The skill's job is to look before it computes.

---

## The example: where content lives, and what it buys you

Nothing below is required. Each piece raises accuracy on its own, and together
they take a question to an answer with no guessing left.

Take a fictional app, **Subscription Analytics**.

### 1. Glossary — the business semantics

**Category:** `Customer Scopes`
**Framework term:** `Customer Scopes — Framework`

```
Applicable rules
1. Set the as-of period first, on any field of the Contract AsOf calendar.
   None given: today.
2. No scope named: default to Active Contracts.
3. Terminated contracts are out of scope unless the question names them.
```

**Term:** `Active Contracts`

```
Definition: contracts in force at the reading date, direct and reseller alike.

Business synonyms & aliases
- EN: live contracts, current subscriptions, active book
- FR: contrats actifs, portefeuille en cours

Related to: Terminated Contracts (seeAlso), Direct Contracts (hasSubtype)
Links to: master measure "# Active Contracts (as of)"
```

**What this buys:** the agent recognizes "how many live contracts do we have"
without anyone having anticipated that phrasing, applies today's date because the
question said "have" and named none, and knows terminated contracts are excluded
without asking.

### 2. Master items — the governed library

**Measure:** `# Active Contracts (as of)`

```
Description: counts contracts in force at the selected as-of date.
Caveat: with no selection on CONTRACT_ASOF_DATE, the internal variable
resolves to the calendar's upper bound, not today. Always select the date.
```

**What this buys:** the agent references the measure by its library id and Qlik
runs the real formula. It never retypes it, so the figure cannot drift from the
governed definition. The caveat catches a trap the definition alone would hide.

**Watch the scope.** A master measure is fast and safe *within its own scope*. A
measure written for one population does not become another by adding a selection
if its formula pins the population itself. Say what the item covers in its
description.

### 3. Published sheets — the accelerator

A published chart is not decoration. One chart can carry a whole composite
analysis: an indicator, its components, a comparison already laid out. **Reading
one is the shortest safe path to an answer** — and often better than assembling
three master items by hand, because the figures come out mutually consistent.

Use the `subtitle` and `footnote` slots. That is where the condition under which
the chart reads correctly belongs.

### 4. Field synonyms and tags — the cheap last mile

The app's own field synonyms and master item tags cost minutes to fill and catch
the phrasings nobody wrote a glossary term for.

---

## The glossary is doing more than defining words

Qlik's glossary carries typed relations — `isA` / `hasSubtype`, `synonym` /
`preferredTerm`, `seeAlso` — and links from a concept to what implements it. In
practice, **that is the closest thing to a business ontology most tenants have**,
and this skill reads it as one.

It is not a formal ontology: no axioms, no constraints, no reasoning engine. But
it is enough to answer "what does this concept include", "what is the preferred
name for it", "which rules does it inherit". This skill applies those relations
**as declared, and never infers one that is not written down** — a hierarchy that
looks obvious from two names is not a governed hierarchy.

If you invest in one thing, invest here.

---

## Good practice, learned the hard way

**Write less.** A long description is not a better one. An agent that cannot find
something actionable quickly starts reasoning instead — and reasoning is slow and
less predictable than reading. Short, imperative, specific.

**Put the caveat next to the object it applies to.** A trap documented three
levels up in a framework term will be read once and not applied at the moment it
matters.

**Write rules as instructions, not descriptions.** "No date given: today" tells
an agent to *do* something. "The measure defaults to today" tells it there is
nothing to do — and if that turns out to be false, nothing catches it.

**Say what a measure's scope is.** Most wrong-but-plausible answers come from a
governed item used slightly outside what it was built for.

---

## Requirements

- A Qlik Cloud tenant with the **Qlik MCP server** available
- An agent runtime supporting the [Agent Skills](https://agentskills.io) format
- Governed content in the app: at minimum some master items; a glossary makes a
  large difference

The skill is generic. It hardcodes no field, measure, app or business rule, and
is meant to be deployed as-is against any tenant.

---

## Honest limits of v1.0

**No caching beyond the session.** Everything the skill loads — glossary export,
master item catalogue, sheet inventory — is rebuilt per session, per user. Ten
people asking about the same app on the same morning each pay for it. Optimizing
this is agent architecture, not skill content, and it may belong to the runtime
rather than to any skill. **Proposals welcome**, with enterprise-grade compliance
in mind.

**`SKILL.md` is dense.** 499 lines, roughly 7,600 tokens loaded on every
question — within the spec's line cap, above its token guidance. Moving detail out
of the always-loaded layer into `references/` is an identified v1.1 job, not yet
done.

**Multi-app is not really covered.** The caches are keyed per app, so the
mechanics hold, but there are no rules yet for choosing between candidate apps or
for what happens to selections when the answer moves to another one.

**No creation, deliberately.** The target for v1 was accuracy close to 100%, and
generating governed content is a different problem with a different failure mode.
When governed content does not cover a question, this skill stops and says so.
Guidance for *creating* what is missing belongs in other skills.

**Tested with Claude.** Written and iterated with Opus 5; end-user testing with
Sonnet 5 at low and medium effort. It follows the open Agent Skills standard —
please try it with your preferred agent stack, and say how it goes.

---

## Contributing

This is a first version. It is opinionated where experience forced it to be, and
deliberately silent everywhere else: **no business context, no dogma**.

What would help most:

- Test reports from other tenants, other LLMs, other agent runtimes
- Architecture proposals for shared, cross-session caching
- Rules for multi-app questions
- Cases where a governed answer was available and the skill missed it

Open an issue or a PR. The goal is talk-to-data that gets closer to 100% accurate
on governed data — nobody gets there alone.

---

## Authors

Yoann Blois ([@ybl74](https://github.com/ybl74)) and Laurent Cornilleau.

Built and iterated against a live Qlik Cloud tenant. The design decisions in this
skill came out of testing, not theory — most of the strict rules exist because a
looser one produced a plausible wrong answer first.

## Licence

Apache-2.0.
