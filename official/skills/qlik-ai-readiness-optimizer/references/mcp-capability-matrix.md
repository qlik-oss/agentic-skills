# MCP Capability Matrix — Qlik AI Readiness Optimizer

MCP tool availability and reload requirements. Referenced from the main [SKILL.md](../SKILL.md).

---

## Tool Availability

| Action | MCP Tool | Status | Reload Required? |
|--------|----------|--------|-----------------|
| Read app metadata | `qlik_describe_app` | ✅ Available | — |
| Read all fields | `qlik_get_fields` | ✅ Available | — |
| List Master Measures | `qlik_list_measures` | ✅ Available | — |
| List Master Dimensions | `qlik_list_dimensions` | ✅ Available | — |
| Create new Master Measure (with description) | `qlik_create_measure` | ✅ Available | ❌ No — live immediately |
| Create new Master Dimension (with description) | `qlik_create_dimension` | ✅ Available | ❌ No — live immediately |
| Edit existing Master Measure | `qlik_update_measure` | ✅ Available | ❌ No — live immediately |
| Edit existing Master Dimension | `qlik_update_dimension` | ✅ Available | ❌ No — live immediately |
| Delete Master Measure | `qlik_delete_measure` | ✅ Available (this skill does not call it — see Key Rule #6) | ❌ No — live immediately |
| Delete Master Dimension | `qlik_delete_dimension` | ✅ Available (this skill does not call it — see Key Rule #6) | ❌ No — live immediately |
| Read Master Item group assignment | — | ❌ Not available — no tool returns this; not `qlik_list_measures`, not `qlik_list_dimensions` | — |
| Set Master Item group assignment | — | ❌ Not available — not exposed on create or update tools; Logical Model UI only | — |
| Retrieve variable definitions | — | ❌ Not available | — |
| Update load script | — | ⚠️ In Preview | ✅ Yes — reload after editing |
| Read existing synonyms/vocabulary | — | ❌ Not available — no tool returns this | — |
| Import synonyms/vocabulary | — | ❌ Not via MCP — done by bulk file upload in the Qlik Answers Vocabulary UI (supported; 6-column `.xlsx` format per implementation guide Layer 5) | ❌ No — live after UI save |
| Set field visibility (hidden) | — | ⚠️ Via load script `%` prefix (manual) | ✅ Yes — reload after editing |
| Find a Glossary by name | `qlik_search` (`resourceType: "glossary"`) | ✅ Available | — |
| Retrieve full glossary export (terms, categories, linked resources) | `qlik_get_full_glossary_export` | ✅ Available (costly — retrieves the entire glossary in one call; use sparingly, once per confirmed glossary) | — |
| Search terms within a glossary | `qlik_search_glossary_terms` | ✅ Available | — |
| Read a single Glossary Term (name, description, abbreviation, status) | `qlik_get_glossary_term` | ✅ Available (this skill only calls it when the user explicitly asks for the status of individual term(s) — see Key Rule #17; one call per term, so it is never swept across all linked terms) | — |
| Read resources linked to a Glossary Term | `qlik_get_glossary_term_links` | ✅ Available | — |
| Update a Glossary Term (name, description, abbreviation) | `qlik_update_glossary_term` | ✅ Available (abbreviation writes: multiple synonyms comma-delimited in one value; merge with any existing value, never overwrite — see Key Rule #18) | ❌ No — live immediately on the term itself; see reload row below for when it's reflected against a linked Master Item |
| Link a Glossary Term to a Master Item | `qlik_create_glossary_term_links` | ✅ Available (this skill only calls it for user-confirmed Link Opportunity candidates, one at a time — see Key Rule #18) | ❌ No — link is live immediately, but the term must be in 'Verified' status before Qlik Answers uses it |

---

## Reload Requirements

Not all changes are live immediately. Clearly tell the user what requires a reload:

| Change Type | Takes Effect | Reload Needed? |
|-------------|-------------|----------------|
| New Master Measure/Dimension created via MCP | Immediately | ❌ No |
| Master Item description updated via MCP | Immediately | ❌ No |
| Master Item edited or deleted via MCP (`qlik_update_measure`/`qlik_update_dimension`/`qlik_delete_measure`/`qlik_delete_dimension`) | Immediately | ❌ No |
| Load script field rename (`AS` alias) | After reload | ✅ Yes |
| Load script field hide (`%` prefix) | After reload | ✅ Yes |
| Load script date conversion | After reload | ✅ Yes |
| Master Calendar added to load script | After reload | ✅ Yes |
| Synonym/vocabulary import via UI | After save in admin UI | ❌ No (but needs UI action) |
| Logical Model group changes via UI | After save | ❌ No (but needs UI action) |
| Change to a linked Glossary Term | After Reload or Change to Master Item in App | ✅ Yes |

**After presenting manual steps that require reload:** always remind the user — "These load script changes won't take effect until the app is reloaded. You can reload from the Qlik Hub or Data Load Editor."