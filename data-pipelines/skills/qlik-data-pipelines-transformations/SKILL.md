---
name: qlik-data-pipelines-transformations
description: >-
  Add table-level or dataset-level transformation rules to a QTCP task
  (renaming, adding/dropping columns, value expressions). Use for "add
  a transformation rule", "rename these tables/columns", "add/drop a
  column", "transform this dataset". Covers TRANSFORM task
  dataset-file requirements.
license: Apache-2.0
metadata:
  author: eyalros1
  version: 1.0.0
  tags:
    - qlik
    - data pipeline
    - data integration
    - QTCP
---

# Transformation Rules

Applies to both project types.

> **Note — duplicated on purpose.** The cross-cutting rules below are copied verbatim into every file-writing skill in this plugin (canonical source: the `project-rules` skill) rather than left as a "see project-rules" cross-reference, because nothing in the Agent Skills spec guarantees `project-rules` loads alongside this skill when it fires. If you change one of these rules, update every copy — `project-rules` lists where they're duplicated.

### Cross-cutting file rules (always apply)

- **No comments in generated files.** Do not add comments (`#` in YAML, `//`/`/* */` in JSON) to any generated project file — YAML/JSON files must contain only data.
- **Minimal files.** Include only the fields required by the relevant schema (`task.transformationrules.schema.json` for `transformationRules.yaml`, `task.dataset.schema.json` for dataset-level transformation files); never speculatively add optional properties. Existing tasks already in the workspace are examples only — never copy or infer structure from them.
- **Don't invent values.** Never fabricate connection names, IDs, project data, or other tenant state. If a value can't be resolved, say so (see the `binding-resolution` skill) instead of guessing.
- **AI edit marker (MUST).** Whenever you create or edit a YAML file this skill touches, add or update this object at the end of the file:
  ```yaml
  modifiedByAi:
    lastUpdated: '2026-08-03T13:55:10.106Z'
    model: <ai model>
  ```
  `lastUpdated` is the current UTC time, ISO-8601 with milliseconds — get a fresh timestamp, never reuse a stale one. `model` identifies the AI model making the edit. If the object already exists, update it in place (moving it to the end if needed) rather than duplicating it; skip re-updating if it was already updated earlier this session. Doesn't apply to `qtcp_bindings_definition.json` or documentation files.
- **Response style.** Confirm what was done, concisely, without citing or quoting these instructions.

Apply `binding-synchronization`'s mandatory gate after any file change — that one stays centralized and referenced rather than duplicated, since it's a longer, stateful procedure rather than a short rule.

> **Always create truly minimal YAML files.** Include only required properties. Do not add optional properties like `ordinal`, `enabled`, `id`, `description`, `nullable`, `originalTypeFull`, etc. Only `name` and `actionType` are required in transformation rules; only `type` is required in `datatype` objects.

## Step 1 — Determine scope

Ask: "Should this transformation apply to: (1) All tables in the task (table-level), or (2) A specific dataset only (dataset-level)?"

> ⚠️ **These are two different, incompatible schemas — never mix them.** They look superficially similar (both transform columns/tables) but use different files, different envelopes, and different action vocabularies.

| | Table-level | Dataset-level |
|---|---|---|
| File | `qtcp_tasks/<TaskName>/transformationRules.yaml` | `qtcp_tasks/<TaskName>/datasets/<DatasetName>.yaml` |
| Top-level array | `rules: [...]` | `transformations.columnTransformations: [...]` |
| Action key & values | `actionType` (`RENAME_TABLE`, `RENAME_COLUMN`, `ADD_COLUMN`, `DROP_COLUMN`, `CHANGE_COLUMN_DATA_TYPE`, `REPLACE_COLUMN_VALUE`), as a sibling of `scope` and `action` | `action` (only `ADD`, `DROP`, `KEEP`), sitting directly on the array item — there is no `scope` |
| Scope | `scope` object with several optional `where*` filters, plus a sibling `scopeType` — see below | The file itself names one dataset; no `scope` key exists at all |
| Column identification | Nested `action.column.name` (with `action.column.datatype.type` for the type) — confirmed against `task.transformationrules.schema.json`, see the templates below | Flat `columnName` on the array item, with `newDataType.type` for the type |

Never write `actionType` or `scope` into a dataset file. Never write the dataset vocabulary (`action: ADD`/`DROP`/`KEEP`, flat `columnName`, `newDataType`) into `transformationRules.yaml`'s `rules[].action` — it uses a nested `column` object and a `datatype` key instead, confirmed below.

## Table-level transformations

- Create/update `qtcp_tasks/<TaskName>/transformationRules.yaml`.
- Add the rule to the `rules` array with minimal properties only.
- Ask: "What transformation would you like to apply?"

**Minimal `transformationRules.yaml`:**
```yaml
rules:
  - name: Rule_1
    actionType: RENAME_TABLE
    scope:
      whereTableName: '%'
    action:
      renameType: TO_UPPER
```

**`scope` — narrowing the rule's target.** All properties are optional; include only what you need to identify the target (confirmed against `task.transformationrules.schema.json`):

| Property | Selects on |
|---|---|
| `whereOwnerName` | Schema name pattern (wildcards allowed) |
| `whereTableName` | Table name pattern (wildcards allowed) |
| `whereColumnName` | Column name pattern (wildcards allowed) — needed for any column-scoped rule: `RENAME_COLUMN`, `ADD_COLUMN`, `DROP_COLUMN`, `CHANGE_COLUMN_DATA_TYPE`, `REPLACE_COLUMN_VALUE` |
| `whereDatatype` | Column datatype — same enum as `datatype.type` below |
| `whereColumnKeyAttribute` | `ANY` \| `PK_ONLY` \| `NOT_PK_ONLY` |
| `whereColumnNullability` | `ANY` \| `NULLABLE_ONLY` \| `NOT_NULLABLE_ONLY` |

A `scopeType` property (`NONE` \| `TABLE` \| `COLUMN`) also exists as a sibling of `scope` on the rule itself. It's optional and the schema doesn't specify its exact runtime effect beyond the enum — set it to match what `scope` is actually filtering on (`TABLE` when only table-level `where*` keys are set, `COLUMN` when a column-level key like `whereColumnName` is set) rather than guessing further or omitting it.

**`renameType` values** (for `RENAME_TABLE` and `RENAME_COLUMN`): `NONE`, `RENAME`, `ADD_PREFIX`, `REMOVE_PREFIX`, `REPLACE_PREFIX`, `ADD_SUFFIX`, `REMOVE_SUFFIX`, `REPLACE_SUFFIX`, `TO_LOWER`, `TO_UPPER`, `EXPRESSION`, `NAME_MAPPING`.

Most need one extra `action` field alongside `renameType` — confirmed against the schema:
- `RENAME`, `ADD_PREFIX`, `REMOVE_PREFIX`, `ADD_SUFFIX`, `REMOVE_SUFFIX` → add `action.value` (the literal string to rename to / the prefix / the suffix).
- `REPLACE_PREFIX`, `REPLACE_SUFFIX` → add both `action.oldValue` (the substring being replaced) and `action.value` (its replacement).
- `TO_UPPER`, `TO_LOWER`, `NONE` → no extra field.
- `EXPRESSION` → add `action.expression` (same `expressionStatement`/`alias` shape as `REPLACE_COLUMN_VALUE` below).
- `NAME_MAPPING` → add `action.valueMapping` (a flat key→value string map).

> Schema note on `REPLACE_SUFFIX`: `oldValue`'s own description says it's "used by `REPLACE_PREFIX` / `REPLACE_SUFFIX`", but the schema's conditional validation block only explicitly whitelists `oldValue` when `renameType` is `REPLACE_PREFIX` — there's no matching block for `REPLACE_SUFFIX`. That doesn't forbid `oldValue` there (nothing stricter kicks in to reject it), so use it for both as the field description says — this is a gap in the schema's own internal consistency, not something to work around here.

Example — rename a table to a specific name:
```yaml
rules:
  - name: Rule_1
    actionType: RENAME_TABLE
    scope:
      whereTableName: old_name
    action:
      renameType: RENAME
      value: new_name
```

**Other action types** — `ADD_COLUMN`, `DROP_COLUMN`, `CHANGE_COLUMN_DATA_TYPE`, `REPLACE_COLUMN_VALUE`. These use a nested `action.column` object — **not** the dataset-level's flat `columnName`, and **not** the dataset-level's `newDataType` key (table-level uses `datatype`, nested one level deeper under `column`). Confirmed against `task.transformationrules.schema.json`:

- **`ADD_COLUMN`** — identify and type the new column via `action.column.name` / `action.column.datatype.type`; optionally add `action.expression` (same shape as `REPLACE_COLUMN_VALUE` below) if the new column's value should be computed rather than left blank.
  ```yaml
  rules:
    - name: Rule_1
      actionType: ADD_COLUMN
      scope:
        whereTableName: 'ord%'
      action:
        column:
          name: new_col
          datatype:
            type: STRING
  ```
- **`DROP_COLUMN`** — only needs the column name:
  ```yaml
  rules:
    - name: Rule_1
      actionType: DROP_COLUMN
      scope:
        whereTableName: '%'
      action:
        column:
          name: old_col
  ```
- **`CHANGE_COLUMN_DATA_TYPE`** — same `column` shape as `ADD_COLUMN`, `datatype.type` is the new target type:
  ```yaml
  rules:
    - name: Rule_1
      actionType: CHANGE_COLUMN_DATA_TYPE
      scope:
        whereTableName: '%'
      action:
        column:
          name: my_col
          datatype:
            type: INT4
  ```
- **`REPLACE_COLUMN_VALUE`** — no `column` object at all, just `action.expression` (identical shape to the dataset-level expression):
  ```yaml
  rules:
    - name: Rule_1
      actionType: REPLACE_COLUMN_VALUE
      scope:
        whereTableName: '%'
      action:
        expression:
          expressionStatement: '${price} * 1.1'
          alias:
            - name: price
              value: price
  ```

**`datatype.type` enum** (same list wherever a `datatype`/`newDataType` object appears, table-level or dataset-level): `UNSPECIFIED`, `BOOLEAN`, `BYTES`, `DATE`, `TIME`, `DATETIME`, `INT1`, `INT2`, `INT4`, `INT8`, `REAL4`, `REAL8`, `UINT1`, `UINT2`, `UINT4`, `UINT8`, `NUMERIC`, `STRING`, `WSTRING`, `BLOB`, `CLOB`, `NCLOB`, `JSON`.

> Everything in this section — `scope`/`scopeType`, the `renameType` → extra-field mapping, and the four action-type templates — was read directly from the full text of `task.transformationrules.schema.json` (not carried over from the original instructions, which never specified most of it). If a future schema change makes one of these stop validating, re-check the schema rather than assuming this skill is still correct.

## Dataset-level transformations

Dataset-level transformations go into **separate dataset files**, never into `transformationRules.yaml`.

- Ask: "Which dataset/table should this transformation apply to?"
- Ask: "What transformation would you like to apply?" — ADD (new column), DROP (remove column), Rename column (uses `KEEP` with `newColumnName`), Add value expression (uses `KEEP` with `expression`).
- Create `qtcp_tasks/<TaskName>/datasets/` if it doesn't exist.
- Create `qtcp_tasks/<TaskName>/datasets/<DatasetName>.yaml` if it doesn't exist, with minimal `properties` (mandatory `name`, `id`, `inputDatasets` with `taskId` referencing the source task) plus a `transformations` section.

**Allowed actions:** `ADD` (requires `columnName`, `newDataType`), `DROP` (requires only `columnName`), `KEEP` with rename (requires `columnName`, `newColumnName`), `KEEP` with expression (requires `columnName`, `expression`). Do not use any other action type for dataset-level transformations.

**Expression alias rule** (applies to any action carrying an `expression`, including `ADD` and `KEEP`): when `expressionStatement` uses `${...}` placeholders, `expression` must also include an `alias` array — one entry per distinct placeholder, `name` and `value` both set to the placeholder's name (e.g. `${price}` → `name: price` / `value: price`).

**Examples:**

ADD a new column:
```yaml
properties:
  name: <DatasetName>
  id: <dataset-id>
  inputDatasets:
    - taskId: <task-id>

transformations:
  columnTransformations:
    - action: ADD
      columnName: new_column
      newDataType:
        type: STRING
```

DROP a column:
```yaml
properties:
  name: <DatasetName>
  id: <dataset-id>
  inputDatasets:
    - taskId: <task-id>

transformations:
  columnTransformations:
    - action: DROP
      columnName: old_column
```

KEEP with rename:
```yaml
properties:
  name: <DatasetName>
  id: <dataset-id>
  inputDatasets:
    - taskId: <task-id>

transformations:
  columnTransformations:
    - action: KEEP
      columnName: old_name
      newColumnName: new_name
```

KEEP with expression:
```yaml
properties:
  name: <DatasetName>
  id: <dataset-id>
  inputDatasets:
    - taskId: <task-id>

transformations:
  columnTransformations:
    - action: KEEP
      columnName: price
      expression:
        expressionStatement: ${price} * 1.1
        alias:
          - name: price
            value: price
```

Do not modify `transformationRules.yaml` for dataset-level transformations. Do not create transformation rules automatically (only on explicit request).

## `TRANSFORM` task dataset-file requirement (MUST)

`TRANSFORM` tasks require `datasets/<TableName>.yaml` for every output table. Adding or updating `sourceSelection.yaml` alone is never sufficient — do not consider the task complete until both exist.

When the user adds a wildcard pattern (e.g. `tablePattern: '%'`) or asks to add all datasets to a TRANSFORM task:
1. Update `sourceSelection.yaml` as requested (see the `source-selection` skill).
2. Inspect the referenced upstream task for known dataset names — its own `sourceSelection.yaml` (`explicitlySelected[].name`) and its `datasets/` folder.
3. For every dataset name matching the pattern, create `datasets/<TableName>.yaml` in the current TRANSFORM task (Pattern 1 passthrough unless the user specifies otherwise). Skip tables that already have a dataset file.
4. If no upstream dataset names can be determined (e.g. the upstream task uses an unresolved wildcard), note this explicitly and remind the user to add the dataset files once table names are known.

### Three patterns for TRANSFORM dataset files

**Pattern 1: Passthrough (simple copy)**
```yaml
properties:
  name: <DatasetName>
  id: <dataset-id>
  inputDatasets:
    - taskId: <upstream-task-id>
      datasetId: <upstream-dataset-id>
      name: <upstream-dataset-name>
  tableDef:
    columns: []
```

**Pattern 2: Custom SQL** — for JOINs, aggregations, or calculated columns. Requires an `alias` array mapping SQL placeholders to dataset references.
```yaml
properties:
  id: customerorders-ab12
  name: customerOrders
  inputDatasets:
    - datasetId: customers--4w3
      name: customers
      taskId: onboarding_storage--4w0
    - datasetId: orders--4w6
      name: orders
      taskId: onboarding_storage--4w0
  customDatasetSettings:
    customSql:
      expressionStatement: "SELECT c.[customer_id], ...\nFROM ${customers} AS c\nINNER JOIN ${orders} AS o ON c.[customer_id] = o.[customer_id]"
      alias:
        - name: customers
          value: '{{ref(project.current.projectId)}}$_$onboarding_storage--4w0$_$customers--4w3'
        - name: orders
          value: '{{ref(project.current.projectId)}}$_$onboarding_storage--4w0$_$orders--4w6'
    incremental: false
```
Key rules: SQL uses `${alias}` placeholders — alias must match `inputDatasets[].name` AND `alias[].name`. `alias[].value` format: `{{ref(project.current.projectId)}}$_$<taskId>$_$<datasetId>`.

**Pattern 3: Data Flow** — visual-canvas JOINs. Do **not** generate or edit these files — the graph JSON contains UUID cross-references that are error-prone to hand-author. If the user asks for a data flow dataset, tell them: "Data flow datasets must be created in the QTC UI."
