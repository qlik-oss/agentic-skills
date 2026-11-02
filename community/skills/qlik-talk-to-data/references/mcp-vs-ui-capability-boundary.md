# MCP vs. Qlik Sense UI — capability boundary

Qlik MCP tools expose a subset of what a human analyst can do in the Qlik
Sense UI. Before telling a user something "isn't possible in Qlik," check
whether it's actually a **tool-surface limit**, not a Qlik limit — the
difference matters for how you phrase the answer.

**This list is not exhaustive.** It reflects what's been confirmed through
real use so far — treat gaps you discover as an update to make here, not a
one-off workaround to forget.

## Confirmed gaps

| Capability | Available via MCP? | What to do instead |
|---|---|---|
| Retrieve a variable's resolved definition (`$(vSomething)`) | ❌ No | Ask the user directly: "This expression uses `$(vMarginCalc)` — what does it resolve to?" Don't guess. |
| Edit an existing master item | ⚠️ In preview on some tenants, not universally available | Check availability before promising it; if unavailable, tell the user to edit via the Qlik Sense UI. |
| Import/manage synonyms via the vocabulary UI | ❌ Not via MCP | Point the user to the Qlik Cloud admin UI. |
| Conditional formatting on a chart | ❌ Not exposed | UI-only; describe what formatting would help, but don't claim you applied it. |
| Custom visualization extensions | ❌ Not exposed | UI-only. |
| Alerting / scheduled notifications on a value | ❌ Not exposed | UI-only (Qlik Cloud alerts). |
| Fuzzy search (the UI Search box's `~term`) | ⚠️ Confirmed **defective**, not just absent — `qlik_select_values(match="~term")` selects essentially the entire field regardless of term | Never use a leading `~` in `match`. Use `qlik_search_field_values` (substring match) if the term might be misspelled — narrower but not broken. Full diagnosis in [selections-and-search.md](selections-and-search.md). |
| Editing an object (master item, bookmark, sheet) that was **not** originally created via MCP | ⚠️ Often blocked even for object types MCP can otherwise write | Not directly relevant to this skill (which never writes), but relevant context if a user asks why an edit they expect "should just work" doesn't. |

## How a gap is phrased

Asked for something above — an alert on a value, the meaning of `$(vTarget)` —
the answer is "not through this tool, here's what it takes in the Qlik Sense
UI", never a fabricated attempt or a flat "Qlik can't do that".

## Keeping this current

When you hit a capability gap not listed here during real use, add a row —
this file is only useful if it reflects what's actually been hit, not a
one-time guess. Cross-check against the Qlik Cloud MCP tool documentation
periodically, since the tool surface expands over time.
