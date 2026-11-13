<!--
Copy this file to references/<app-or-domain-name>.md and fill it in for a
specific Qlik Sense app or business domain. SKILL.md checks references/ for
a matching profile before falling back to live discovery, so a completed
profile shortcuts straight past app search and field exploration for
questions about this app.

Delete this comment block once you've filled the template in. Keep
sections short — this is a reference doc for an LLM to retrieve, not
documentation for a human to read end to end.
-->

# [App or Domain Name] Profile

## Quick reference

- **App ID**: `[uuid]`
- **App name**: [name as it appears in Qlik Cloud]
- **Space**: [space name — helps disambiguate from same-named apps in other spaces]
- **Owner**: [name or team]
- **Business context**: [what this app is for, in plain words — one or two sentences]
- **Primary data product(s)**: [name(s), if this app draws from a governed data product]

## Governed sources already available

List what already exists so this skill doesn't recreate it. Update this
section whenever someone adds a new master item, sheet, or data product —
treat it the same way a code comment goes stale if nobody maintains it.

### Master dimensions
- `[Dimension Name]` — [what it represents, e.g. "Customer segment, standard 4-tier definition"]

### Master measures
- `[Measure Name]` — [expression summary and what it means, e.g. "Gross margin %, = gross margin / revenue"]

### Key sheets
- `[Sheet name]` — [what it covers, so it can be reused instead of rebuilt]

## Field naming gotchas

The same concept is often named differently across tables/apps, or a field
name doesn't mean what it sounds like. Document those here.

- `[field_name]` means [X], not [the more obvious-sounding Y]
- `[Term A]` in this app maps to `[Field/Table]`; don't confuse with `[Term B]`
- [Deprecated field name] → use `[current field name]` instead

## Standard hygiene filters

Filters or selections that should apply to (almost) every query in this
domain, and why.

- [e.g. "Exclude Status = 'Test' — test records are never removed from the
  source system"]

## Common analysis patterns

Worked patterns specific to this app where the exact expression is the
hard part — not generic Qlik syntax (that's covered in
[`expression-gotchas.md`](expression-gotchas.md)), but domain-specific
calculations someone would otherwise reinvent each time.

- **[Pattern name]**: [when to use it] → `[expression or tool sequence]`

## Cross-references

- Related app/domain profiles: [links to other references/*.md files]
- Relevant glossary: [glossary name, if this domain has a dedicated one]
