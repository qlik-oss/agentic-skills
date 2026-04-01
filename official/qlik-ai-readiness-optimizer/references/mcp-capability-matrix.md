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
| Create new Master Measure (with group + description) | `qlik_create_measure` | ✅ Available | ❌ No — live immediately |
| Create new Master Dimension (with group + description) | `qlik_create_dimension` | ✅ Available | ❌ No — live immediately |
| Retrieve variable definitions | — | ❌ Not available | — |
| Edit existing Master Item | — | ⚠️ In Preview (MCP Private Preview Tenant) | ❌ No |
| Update load script | — | ⚠️ In Preview | ✅ Yes — reload after editing |
| Import synonyms/vocabulary | — | ❌ Must be done via UI | ❌ No — live after UI save |
| Set field visibility (hidden) | — | ⚠️ Via load script `%` prefix (manual) | ✅ Yes — reload after editing |

---

## Reload Requirements

Not all changes are live immediately. Clearly tell the user what requires a reload:

| Change Type | Takes Effect | Reload Needed? |
|-------------|-------------|----------------|
| New Master Measure/Dimension created via MCP | Immediately | ❌ No |
| Master Item description updated via MCP | Immediately | ❌ No |
| Master Item group assignment via MCP | Immediately | ❌ No |
| Load script field rename (`AS` alias) | After reload | ✅ Yes |
| Load script field hide (`%` prefix) | After reload | ✅ Yes |
| Load script date conversion | After reload | ✅ Yes |
| Master Calendar added to load script | After reload | ✅ Yes |
| Synonym/vocabulary import via UI | After save in admin UI | ❌ No (but needs UI action) |
| Logical Model group changes via UI | After save | ❌ No (but needs UI action) |

**After presenting manual steps that require reload:** always remind the user — "These load script changes won't take effect until the app is reloaded. You can reload from the Qlik Hub or Data Load Editor."
