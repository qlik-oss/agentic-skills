# DATA_PIPELINE task templates

All task types require `properties.name`, `properties.id`, and `properties.type`. Use `{{task.<task-id>.<property>}}` binding variables for all values unless noted otherwise. Properties marked **(two-level)** use `task-type.*` references instead of blank values — see the `binding-synchronization` skill. Exception: `LAKEHOUSE_MIRROR` tasks never use two-level binding, even for properties normally on that list.

## Required `settings` fields per task type

| Task Type | Required `settings` fields |
|---|---|
| LANDING | `landingDwSettings.landingArtifactsLocation.dataAssetSchema` → `taskSchema` |
| LAKE_LANDING *(DATA_PIPELINE)* | `landingDwSettings.landingArtifactsLocation.dataAssetSchema` → `taskSchema`. Do **not** add `targetEndpoint.targetConnection` here — that field belongs only to `LAKE_LANDING` under `DATA_MOVEMENT` (see the `replication` skill), which uses a different minimal shape entirely. |
| STORAGE | `artifactsLocation.internalSchema`, `artifactsLocation.taskSchema`, `artifactsLocation.databaseName` *(two-level)*, `taskRuntime.warehouseSelection.warehouseName` *(two-level)* |
| TRANSFORM | `artifactsLocation.internalSchema`, `artifactsLocation.taskSchema`, `artifactsLocation.databaseName` *(two-level)*, `taskRuntime.warehouseSelection.warehouseName` *(two-level)* |
| REGISTERED_DATA | `artifactsLocation.internalSchema`, `artifactsLocation.taskSchema`, `artifactsLocation.databaseName` *(two-level)* |
| LAKEHOUSE_STORAGE | `artifactsLocation.internalSchema`, `artifactsLocation.taskSchema`, `taskRuntime.lakehouseCluster` *(two-level)* |
| LAKEHOUSE_MIRROR | `artifactsLocation.internalSchema`, `artifactsLocation.taskSchema`, `artifactsLocation.databaseName`, `platformConfig.platformType`, `platformConfig.connection` → `targetConnection` — see below. Add `taskRuntime.warehouseSelection.warehouseName` only when `platformConfig.platformType` is `SNOWFLAKE`. No two-level binding for any field — all variables get a blank value directly in `qtcp_bindings_definition.json`. |
| STREAMING_LAKE_LANDING | `taskRuntime.lakehouseClusterId` → `lakehouseCluster` *(two-level)* |
| STREAMING_TRANSFORM | `generalSettings.artifactsLocation.internalSchema`, `generalSettings.artifactsLocation.taskSchema`, `runtimeSettings.lakehouseClusterId` → `lakehouseCluster` *(two-level)* |
| QVD_STORAGE | (see QVD platform notes; no additional settings beyond the standard artifacts location) |
| REPLICATE_LANDING | `taskRuntime.lakehouseClusterId` → `lakehouseCluster` *(two-level)* |
| DATAMART, KNOWLEDGE_MART, FILE_BASED_KNOWLEDGE_MART* | Do NOT create — must be created in QTC UI then committed back. *`FILE_BASED_KNOWLEDGE_MART` requires `taskRuntime.warehouseSelection.warehouseName` *(two-level)* if ever generated from an existing QTC-created task. |

## LAKEHOUSE_MIRROR: Data Warehouse Platform

When creating a `LAKEHOUSE_MIRROR` task, after asking for the task name also ask: "What is the Data warehouse platform?" and present the enum values from `settings.platformConfig.platformType` in the schema. Set `platformType` under `settings.platformConfig` in `task.yaml`.

Based on the chosen `platformType`, add the corresponding settings block under `settings.platformConfig`, and conditionally include `taskRuntime.warehouseSelection.warehouseName`:

- **`SNOWFLAKE`**: add `snowflakeIcebergSettings` with properties `snowflakeExternalVolume` and `snowflakeCatalogIntegration`; add `taskRuntime.warehouseSelection.warehouseName`.
- **`REDSHIFT`**: add `redshiftIcebergSettings` with property `redshiftExternalSchema`; do **not** add `taskRuntime.warehouseSelection.warehouseName`.
- **`DATABRICKS`**: add `databricksIcebergSettings` with property `databricksForeignCatalog`; do **not** add `taskRuntime.warehouseSelection.warehouseName`.

Note the property name alias: `snowflakeCatalogIntegration` must bind to variable suffix `snowflakeOpenCatalog`, not `snowflakeCatalogIntegration` — see the `binding-synchronization` skill's property-alias table.

## REGISTERED_DATA: Update Method

When creating a `REGISTERED_DATA` task, after asking for the task name also ask: "What is the Update method?"
1. Compare with current storage
2. Incremental using high watermark

- **Compare with current storage** → do not set `settings.fullLoadOnly`.
- **Incremental using high watermark** → set `settings.fullLoadOnly: false`, then also ask: "What are the incremental load settings?"
  1. Qlik replicate default settings → `settings.incrementalSettings.registeredType: REPLICATE`
  2. Stitch default settings → `settings.incrementalSettings.registeredType: STITCH`
  3. Project default settings → `settings.incrementalSettings.registeredType: WATERMARK`

## Task type name mapping (for two-level `task-type.*` binding keys)

| Task type (in task.yaml) | task-type key segment |
|---|---|
| LANDING | `landing` |
| STORAGE | `storage` |
| TRANSFORM | `transform` |
| REGISTERED_DATA | `registered` |
| LAKE_LANDING | `lakeLanding` |
| LAKEHOUSE_STORAGE | `icebergStorage` |
| LAKEHOUSE_MIRROR | `mirror` |
| STREAMING_LAKE_LANDING | `streamingLanding` |
| STREAMING_TRANSFORM | `icebergTransform` |
| DATAMART | `datamart` |
| KNOWLEDGE_MART | `knowledgeMart` |
| FILE_BASED_KNOWLEDGE_MART | `fileBasedKnowledgeMart` |
| REPLICATE_LANDING | `replicateLanding` |

(`REPLICATION` and its `replication` task-type key live in the `replication` skill, not here.)
