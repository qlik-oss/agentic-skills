# Source selection — Registered Data Tasks

Applies to: `REGISTERED_DATA`.

`REGISTERED_DATA` tasks register pre-existing data assets by specifying their exact location (database, schema, name). They do not read from a live connection or an upstream task. The user must provide: database name, schema, table name.

**Prompting:**
- Ask: "Please provide the database, schema, and table names you want to register."
- If database not specified, ask for it. If schema not specified, ask for it. If table/view name not specified, ask for it. If type not specified, ask: "What is the source type: table or view?"
- If any required location value is missing (`database`, `schema`, `name`, `type`), ask follow-up questions and do **not** write `sourceSelection.yaml` yet.

## Writing `sourceSelection.yaml`

- Do **not** include `sourceConnection` or `rootDirectoryPath` — `REGISTERED_DATA` tasks don't use a data source connection.
- Do **not** include `sourceTask` — they don't read from an upstream task.
- Do **not** use `includePatterns`/wildcard patterns as a fallback for a "add source" request here.
- Each `explicitlySelected` item must specify `database`, `schema`, `name`, `type`.
- If the request uses "dataset" without saying "dataset file"/"dataset yaml", still treat it as source-selection intent and update `sourceSelection.yaml`.

**Minimal `sourceSelection.yaml` (REGISTERED_DATA tasks):**
```yaml
explicitlySelected:
  - database: <DatabaseName>
    schema: <SchemaName>
    name: <TableName>
    type: TABLE
```

## Completion check (MUST pass before final response)

1. `sourceSelection.yaml` contains no `sourceConnection` or `rootDirectoryPath`.
2. `sourceSelection.yaml` contains no `sourceTask`.
3. Every `explicitlySelected` item includes `database`, `schema`, `name`, and `type`.
4. No wildcard fallback was used to bypass missing required values.
