# Why This Skill Looks The Way It Does

Read this when you (or a user) want the reasoning behind this skill's
structure and rules, not just the rules themselves — e.g. "why does this
skill care so much about selections," or "why is authoring treated
differently from querying."

Anthropic's write-up on self-service analytics agents (*How Anthropic enables
self-service data analytics with Claude*) frames most wrong answers as one of
three failure modes: **concept-to-entity ambiguity** (which table/field is
"revenue"?), **staleness** (is this still true?), and **retrieval failure**
(the right answer existed but the agent never found it). Their fix is a
stack: canonical datasets, a semantic layer, lineage, and skills that route
the agent to governed answers before it ever writes ad hoc SQL.

Qlik MCP tools address the same three failure modes, but several layers that
the warehouse world has to build by hand already exist natively in Qlik
Cloud:

| Failure mode | Warehouse approach (build it yourself) | Qlik MCP approach (already there) |
|---|---|---|
| Entity ambiguity | Curate canonical dbt models, hope people don't duplicate them | **Data Products** (curated, documented datasets) and **Master Items** (governed dimensions/measures) — list before you build |
| Staleness | Freshness/completeness checks you write and maintain | `qlik_get_dataset_freshness`, `qlik_get_dataset_trust_score`, `qlik_get_dataset_quality_computation_status` are native tool calls |
| Retrieval failure | Distill a query corpus into reference docs by hand | `qlik_search`, `qlik_list_sheets`, `qlik_get_sheet_details` surface existing apps/charts directly — reuse before rebuilding |
| Lineage / "where did this come from" | Reconstruct the transformation graph from dbt manifests | `qlik_get_lineage` is a direct tool call (still one hop at a time — call it recursively) |
| Business glossary | An internal wiki or knowledge graph you pipe in yourself | A structured **Business Glossary** with a draft → verified → deprecated lifecycle, native to the platform |
| "Raw SQL" fallback | Hand-written SQL, reviewed adversarially before trusting it | `qlik_create_data_object` with a Qlik expression (set analysis) — Qlik performs the calculation, so the review is about *expression correctness*, not aggregation logic |

What's genuinely new and has no warehouse-skill equivalent:

1. **Authoring, not just querying.** The warehouse skill in Anthropic's
   article only reads. Qlik MCP tools can also *create* governed objects —
   master dimensions/measures, sheets, charts, data products, glossary terms.
   That makes this skill part analyst, part steward: every creation action
   needs the same "is this duplicating something that already exists"
   discipline as querying does, plus a check before creating something
   persistent (see
   [`governance-workflows.md`](governance-workflows.md)).
2. **Selections are stateful.** SQL queries are stateless — every query
   states its own filters. Qlik selections persist across tool calls until
   cleared, and a selection on a value that doesn't exist **fails silently**
   (no error, the field just doesn't appear in the returned selection state).
   This is a new class of silent failure the warehouse skill never has to
   think about. Treat it with the same seriousness the article gives
   "adversarial SQL review."
3. **No SQL, ever.** Calculations happen inside Qlik's associative engine.
   Never re-aggregate, sum, or average data that a Qlik tool already
   returned — the values are final. If you need a different calculation,
   call the tool again with a different expression.

This is also why the skill treats visualization as a default rather than an
afterthought (see
[`visualization-guidelines.md`](visualization-guidelines.md)): a warehouse
agent that only ever prints numbers is solving the retrieval problem but
reintroducing a comprehension problem. Qlik's chart tools return structured,
already-aggregated data specifically so it can be rendered, not just read.
