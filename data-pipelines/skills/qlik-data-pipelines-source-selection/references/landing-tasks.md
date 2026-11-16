# Source selection — Landing Tasks

Applies to: `LANDING`, `LAKE_LANDING`, `STREAMING_LAKE_LANDING`, `REPLICATION`, `REPLICATE_LANDING`.

Landing tasks read directly from a data source connection. The user must provide: (1) a data source (the connection), and (2) schema and table names, a pattern, or (when Qlik MCP is available) a partial name to search.

Check Qlik MCP availability first (see `project-rules`), since the options you present depend on it:

- **Not available** → ask: "Please provide the schema and table names (or a pattern) you want to include." If schema isn't specified, ask for it. If the user provides a pattern instead of explicit names, use the Include/Exclude Patterns flow below.
- **Available** → ask whether the user wants to specify schema/table explicitly, provide a pattern, or search by partial name.
  - Explicit → same flow as above.
  - Pattern → Include/Exclude Patterns flow below.
  - Search → Dataset search flow below.

## Dataset search flow (Qlik MCP available, user chose to search)

Entered only after the target landing task is known and the user has chosen to search.

**Step 1 — Resolve the project.** Use `project-rules`' "Resolving the project ID" procedure, recording `projectId` and `spaceId`. If not resolved, skip to Step 3.

**Step 2 — Resolve the source connection from local bindings.**
- Search for a file named `bindings.json` under the project folder; if found, use it. Otherwise call `qlik_get_pipeline_project_details` (`objectType: bindings`, `query`: projectId).
- In the bindings, find the key `"task.<taskId>.sourceConnection"` (`<taskId>` from the landing task's `task.yaml`).
- Extract the connection reference: the 2nd parameter inside `{{id(connection, <spaceName>.<connectionName>)}}`, formatted `spaceName.connectionName` (e.g. `Default_Data_Space.Microsoft_SQL_Server_test`).
- Found → call `qlik_search` filtered by the `spaceId` from Step 1, match by connection name to get `connectionId`, go to Step 4.
- Not found → Step 3.

**Step 3 — Resolve space and connection interactively.**
- If `spaceId` unknown, ask for space, call `qlik_search` (`resourceType: space`, query: typed text), show only spaces whose `type` is `data`. Show names only; record `spaceId`.
- Ask for connection name, call `qlik_search` (`resourceType: dataConnection`, query: typed text). Show names only; record `connectionId`.
- After selection, if the connection data contains `dataConnection.kindId`: open `qtcp_bindings_definition.json` and check `connectionProperties` for key `"task.<taskId>.sourceConnection"`. If missing, or present but with no `kindId`, add/update it (omit blank/null fields): `kindId` ← `dataConnection.kindId`; `type` ← `dataConnection.dataSourceId` if defined, otherwise leave `type` unchanged (never use the connection result's top-level `type`).

  Example — connection `{"dataSourceId": "external_data_provider", "kindId": "versioncontrol:github@1.0.0", "externalDataProviderType": "versioncontrol:github"}`:
  ```json
  "connectionProperties": {
    "task.onboarding1_landing-8wfv.sourceConnection": {
      "type": "external_data_provider",
      "kindId": "versioncontrol:github@1.0.0"
    }
  }
  ```

**Step 4 — Browse and select datasets.** Call `qlik_search_connection_objects` with `connectionId` and `tablePattern`. Show names only as a selectable list.

**Session memory:** cache `projectId`, `spaceId`, `connectionId` for the session; on later requests skip Steps 1–3 and tell the user: "Using project/space/connection from earlier in this session."

**Rules:** show names only in all lists — never IDs or internal properties. Pass filter text as tool parameters; don't fetch full lists and filter locally. Never fabricate connection or project data.

## Writing `sourceSelection.yaml`

Refer to the `sourceSelection` schema (`task.sourceselection.schema.json`, see `project-rules`) for required/optional properties in `explicitlySelected` items. Landing tasks use `sourceConnection` at the top level.

**Minimal `sourceSelection.yaml` (landing tasks):**
```yaml
sourceConnection: '{{task.<task-id>.sourceConnection}}'
explicitlySelected:
  - name: <TableName>
    schema: '{{task.<task-id>:<database>$_$<schema>.schema}}'
    type: TABLE
```

**`REPLICATE_LANDING` tasks** also require `rootDirectoryPath` as a root-level property. It's a binding variable — do not ask the user for its value; include it in the template and add the variable to `qtcp_bindings_definition.json` with a blank value.

**Minimal `sourceSelection.yaml` (REPLICATE_LANDING tasks):**
```yaml
sourceConnection: '{{task.<task-id>.sourceConnection}}'
rootDirectoryPath: '{{task.<task-id>.rootDirectoryPath}}'
explicitlySelected:
  - name: <TableName>
    schema: '{{task.<task-id>:<database>$_$<schema>.schema}}'
    type: TABLE
```

## Using Include/Exclude Patterns (optional, Landing Tasks only)

For bulk table selection. Pattern syntax: `%` matches any characters; exact strings match literally. Case sensitivity depends on the source database.

```yaml
sourceConnection: '{{task.<task-id>.sourceConnection}}'
includePatterns:
  - tablePattern: 'dim_%'
    schemaPattern: 'dbo'
    type: TABLE
  - tablePattern: 'fact_%'
    schemaPattern: 'dbo'
    type: TABLE
excludePatterns:
  - tablePattern: 'temp_%'
    schemaPattern: 'dbo'
    type: TABLE
```

For `REPLICATE_LANDING` tasks, also include `rootDirectoryPath` at the root level alongside `sourceConnection`, per the rule above.
