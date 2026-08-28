# Qlik MCP tools — what this skill will not find elsewhere

**The MCP server describes every tool it exposes, with its parameters, at
runtime.** This file never repeats that, and it is not a catalogue. It holds the
two things the runtime list cannot say: which tools exist that this skill refuses
to call, and what to know about the few tools no other reference covers.

Where a tool's *behaviour* differs from its description, that belongs with the
rule it affects — the `match` capability table and the confirmed defects are in
[selections-and-search.md](selections-and-search.md), the glossary export in
[glossary-guidance.md](glossary-guidance.md), lineage in
[lineage.md](lineage.md), quality in [trust-and-quality.md](trust-and-quality.md).

## Tools that exist and are never called

Every `qlik_create_*`, `qlik_update_*` and `qlik_delete_*` for master items,
sheets, data products and glossary terms — **plus `qlik_add_chart`**, which
writes a persistent visualization onto a sheet despite sitting among the
session-scoped tools, and `qlik_update_dataset_quality`, which triggers a
recomputation rather than reading one.

They appear in the runtime tool list. **This skill does not call them**, and
seeing one offered is not a reason to
([SKILL.md — Role](../SKILL.md#role-and-non-negotiable-boundary)). The single
exception is `qlik_create_bookmark`, on explicit request only.

Tool availability also depends on the user's role, space access and tenant
licensing, independently of anything here.

## Tools no other reference covers

- `qlik_get_dataset_memberships` — which data products a dataset belongs to.
  Useful when a figure's Data Product isn't already known from discovery.
- `qlik_list_bookmarks` / `qlik_select_bookmark` — list existing bookmarks and
  apply one's saved selections. Applying one **overwrites the conversation's
  working context** ([SKILL.md](../SKILL.md#active-selections-are-the-conversations-working-context)),
  so say what it changed. Wider use is parked in
  [skills/_backlog/qlik-bookmarks-as-governance/](../../_backlog/qlik-bookmarks-as-governance/README.md).
- `qlik_search_knowledgebase_chunks` — semantic search over an indexed knowledge
  base, IDs discoverable via `qlik_search(resourceType="knowledgebase")`. **Start
  with a small `topN`** and raise it only if needed: a large one fills the context
  with marginal chunks. A knowledge base is not governed content — treat what it
  returns as context, never as a definition or a figure.
