# Temporal reasoning — detail

`SKILL.md` carries the two rules that fire on every question: anchor on the
data rather than the clock, and never mix two date axes. This file carries the
cases that only come up when the question raises them.

## An as-of axis left unselected resolves itself

A governed item built on a point-in-time axis — "as of" scopes, snapshot
populations, status-at-a-date measures — carries a variable that resolves the
axis when nothing is selected on it. **What it resolves to is not visible from
here**: no MCP call returns a variable's resolved definition (see
[mcp-vs-ui-capability-boundary.md](mcp-vs-ui-capability-boundary.md)).

It commonly resolves to a **bound of the calendar** rather than to today. On a
calendar that runs into the future, that is a horizon years away, and the figure
comes back **plausible, unlabelled and wrong for a "currently" question**.

**So the axis is selected before the item is read, not after the number looks
odd.** The sequence is fixed:

1. Resolve the reading period — governed rule first, then the
   [trailing-versus-forward rule](../SKILL.md#temporal-reasoning-anchor-to-the-data-not-the-wall-clock).
2. Select it on the axis's own field.
3. Read the item.

Reading first and correcting after is not a slower route to the same answer: it
is a route that only works when the wrong figure happens to look wrong. A
horizon-dated population that resembles today's is indistinguishable from it.

**A governed default is still a rule to execute.** "No date given: today" written
in a glossary is an instruction to apply before the first read — not a
description of what the item already does. The item's own behaviour is the thing
the rule exists to override.

## A governed "current period" competing with the clock

An app can encode its own "current period", tied to data freshness and distinct
both from the wall clock and from whatever is selected. **Check governed guidance
before asking** — where the glossary or another governed entry pins which reading
applies, that resolves it and there is nothing to put to the user. Otherwise
surface the disagreement and ask. Never resolve it silently: the three can all be
defensible, and picking one without saying so makes the figure unreproducible.

## A past-state question the model cannot answer

Where the governed documentation describes the data as a current-state view
with no history, an earlier state is not recoverable. A measure asked for that
state still returns a number — computed on today's state, with no error and no
warning. Say the question can't be answered from this source rather than
approximating it.

Check this model-level fact only when a past state is actually asked for; it is
not part of every answer.

## Filtering a period when the axis has no field of its own

Where only a raw date field exists, filter through `match`, as a range written
in that field's own display format. Read the format once rather than iterating:
a failed attempt clears the field's existing selection, so guessing costs more
than looking.
[Mechanics](selections-and-search.md#filtering-a-period-when-only-a-date-field-exists).

## Anchoring, restated

The max available date is the anchor for an axis that **trails** today —
yesterday's load, last week's close. It is never the anchor for an axis that
runs **past** today: on a projection calendar or a planning horizon the max
value is the far end of the horizon, and anchoring there answers a question
nobody asked. Read a forward-looking axis at today's date unless the question
or the governed content names another.
