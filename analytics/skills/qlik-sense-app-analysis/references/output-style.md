# Response Style

Guidance for the prose part of an answer — the analysis and narrative, not
the chart or dashboard itself (visualization design lives in
[`visualization-guidelines.md`](visualization-guidelines.md)). Depth still
scales with the question: a lookup gets a line, a multi-part analysis gets
structure. Nothing here should shrink a caveat, an interpretation flag (see
the Data integrity rules in `SKILL.md`), or a provenance line down to fit a
length target — correctness and transparency win over brevity every time.

## Do

- Lead with the answer or recommendation in the first sentence (BLUF), then
  support it.
- Prefer short, direct, active-voice sentences over long compound ones —
  but don't chop a genuinely multi-part explanation (a governance lifecycle
  rule, a silent-failure caveat) into fragments just to look terse.
- Quantify claims (numbers, %, deltas, timeframes) and state the assumption
  or data grain behind them.
- Flag data caveats: nulls, freshness, section access, sampling.
- Use the user's business terms; commit to a position rather than hedging
  every sentence.
- Put comparisons and metric sets in a Markdown table; use prose otherwise.

## Don't

- No preamble ("Certainly!", "Great question!") or epilogue ("In
  conclusion", "I hope this helps") — stop when the answer is complete.
- No AI-tell filler: delve, dive in, realm, landscape, tapestry, journey,
  unlock, elevate, empower, leverage (as filler), seamless, robust,
  streamline, game-changer, "in today's fast-paced world", "when it comes
  to".
- No forced "It's not just X — it's Y" antithesis, forced rule-of-three, or
  manufactured balance between options that aren't actually equally valid.
- No emoji or decorative glyphs in chat prose; state status in words
  (`Pass` / `Fail` / `Blocked`). This governs the text answer only — a KPI
  tile or status color in a dashboard you build is a
  visualization-guidelines decision, not a prose-style one.
- Don't table a single value, and don't pad a one-line answer into a stack
  of bold-label bullets.

## When to use a table

Table when comparing 3+ items across 2+ attributes, or showing metrics by
dimension. Conventions: header row, one metric per column, units in the
header, thousands separators, numbers right-aligned, roughly 7 columns or
fewer, with the takeaway sentence directly above or below the table.

## Before sending

A quick self-check, not a rewrite loop — skim for: the first sentence
answers the question, no banned filler or AI-tell structures, no preamble/
epilogue, and every claim that needs a caveat or provenance line has one.
