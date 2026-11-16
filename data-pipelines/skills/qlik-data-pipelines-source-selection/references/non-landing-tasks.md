# Source selection — Non-Landing Tasks

Applies to: `STORAGE`, `QVD_STORAGE`, `TRANSFORM`, `DATAMART`, `KNOWLEDGE_MART`, `FILE_BASED_KNOWLEDGE_MART`, `LAKEHOUSE_STORAGE`, `LAKEHOUSE_MIRROR`, `STREAMING_TRANSFORM`.

Non-landing tasks read from an upstream task, not directly from a data source connection. The user must provide: (1) the source task (the upstream task), and (2) which tables/datasets from it to include.

**Prompting:**
- Ask: "Which task should this read from?" (list available tasks from `qtcp_tasks/`).
  - **Landing source restriction:** only `STORAGE` tasks may read from landing task types (`LANDING`, `LAKE_LANDING`, `STREAMING_LAKE_LANDING`, `REPLICATION`, `REPLICATE_LANDING`). All other non-landing task types cannot — do not present landing tasks as source options for them.
  - ⚠️ **One landing task per STORAGE task (MUST):** A `STORAGE` task may be linked
  to only **one** upstream landing-type task (`LANDING`, `LAKE_LANDING`,
  `STREAMING_LAKE_LANDING`, `REPLICATION`, `REPLICATE_LANDING`) — never more than
  one, even across multiple `explicitlySelected`/`includePatterns` entries.
  - Before adding a source from a landing task, read the target `STORAGE` task's
    current `sourceSelection.yaml` and collect the distinct `sourceTask` values
    from `explicitlySelected[]` and `includePatterns[]`.
  - If the new source's `sourceTask` refers to a **different** landing task than
    the one(s) already present → ❌ **do not add it.** Inform the user: "This
    STORAGE task is already linked to `<existing-landing-task>` — a STORAGE task
    can only be linked to one landing task." Ask whether they want to:
    1. Replace the existing landing source with the new one, or
    2. Choose a different, non-landing upstream task instead.
- Ask: "Which tables/datasets from that task do you want to include?"

## Writing `sourceSelection.yaml`

- Non-landing tasks use `sourceTask` on each `explicitlySelected` item to reference the upstream task.
- Do **not** include `sourceConnection` or `rootDirectoryPath` — non-landing tasks don't use a direct data source connection.
- `sourceTask` value format: always the plain task ID string (e.g. `storage1-3742`) — never `{{ref(...)}}` or any template variable syntax.

**Minimal `sourceSelection.yaml` (explicitly selected tables):**
```yaml
explicitlySelected:
  - name: <upstream-dataset-name>
    sourceTask: <upstream-task-id>
    type: TABLE
    sourceTableId: <upstream-dataset-id>
```

**Minimal `sourceSelection.yaml` (all tables via pattern):**
```yaml
includePatterns:
  - tablePattern: '%'
    sourceTask: <upstream-task-id>
    type: TABLE
```

## Dataset YAML files

When creating dataset YAML files for non-landing tasks, use `properties.inputDatasets` to reference the upstream task and dataset. Any `{{...}}` variable introduced must be added to `qtcp_bindings_definition.json` (see `binding-synchronization`).

- `taskId` MUST be the upstream task's `properties.id`.
- `datasetId` MUST be the upstream dataset's `properties.id` from a dataset file under that upstream task. If no dataset file exists for the upstream task (e.g. a LANDING task), convert the dataset name to a `datasetId`: letters/digits kept as-is and lowercased; separators (any separator constant, `_`, or whitespace) become `_`; any other special character is encoded `$HH$` (uppercase hex), e.g. `@` → `$40$`, `!` → `$21$`. Examples: `"My App!"` → `my_app$21$`; `"hello world"` → `hello_world`; `"foo@bar"` → `foo$40$bar`. Never reference a `datasetId` that doesn't exist.
- `name` MUST be the reference name for the input dataset within this file.
- Refer to the `dataset` schema (`task.dataset.schema.json`) for required properties per task type — never hardcode a property list.

`TRANSFORM` tasks have additional mandatory dataset-file rules — see the `transformations` skill.

**Minimal `dataset.yaml` (non-landing, non-TRANSFORM tasks):**
```yaml
properties:
  name: <DatasetName>
  id: <dataset-id>
  inputDatasets:
    - taskId: <upstream-task-id>
      datasetId: <upstream-dataset-id>
      name: <upstream-dataset-name>
```
