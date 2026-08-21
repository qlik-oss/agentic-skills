---
name: qlik-load-script
description: "Write, complete, or extend Qlik Sense load scripts (.qvs) for data preparation. Primary use case is preparing flat datasets for ML experiments with Qlik Predict — engineering features, handling train/test splits, and outputting QVD files. Also covers general Qlik load script authoring: completing scripts from starting code, comments, or prompts. Use this skill whenever the user mentions Qlik load script, .qvs files, Qlik data load, QVD output, data preparation for Qlik Predict, or asks for help writing or fixing Qlik script syntax. Also trigger when the user provides a Qlik load script and asks for modifications, extensions, feature engineering, or data transformations. Even if the user just pastes Qlik script code and asks a question about it, use this skill."
license: Apache-2.0
metadata:
  author: nabeel-oz
  version: 1.6.0
  tags:
    - qlik
    - load-script
    - qvs
    - etl
    - data-preparation
    - qlik-predict
    - claude-code
    - cursor
    - coding-agent
---

# Qlik Load Script Generator

## Overview

You are writing **Qlik Sense load script** (.qvs files) for data preparation. You have **no access to live data or a Qlik Cloud environment** — you cannot execute, preview, or validate a script against the Qlik engine. Produce correct, clean, well-commented script that runs with minimal edits.

**Built for coding agents.** This skill is designed primarily for agentic coding tools with file-system access — Claude Code, Cursor, Codex, and similar — working inside a project that contains `.qvs` files:
- Read the existing script(s) from disk (via your file-read tool) before editing.
- Edit or create the `.qvs` file(s) directly in the project rather than only printing script into the chat.
- Preserve the surrounding project structure (other tabs, connections, file layout) exactly as found, except where the task asks you to change it.

If you are running in a chat-only environment with no file access (e.g. a plain web chat), fall back to outputting complete script blocks for the user to copy and paste — see [Workflow](#workflow).

**Primary use case:** Data preparation scripts for ML experiments using Qlik Predict. The user provides a starting script with base data. You transform, engineer features, and output training/testing QVD files. All guidance for this — target requirements, split patterns, leakage checks, script template — is in [references/ml-data-prep.md](references/ml-data-prep.md).

**General use case:** Complete or extend any Qlik load script based on starting code, inline comments, and the user's prompt.

## Critical Rules

1. **This is Qlik load script, not SQL.** The syntax resembles SQL but differs in important ways. When unsure, read [references/syntax-and-patterns.md](references/syntax-and-patterns.md) and consult: https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/LoadData/script-syntax-functions.htm
2. **Never invent functions or guess arguments.** If you are not confident a built-in function exists, check the Help docs, search Qlik Community, and use an approach you are confident about.
3. **No execution.** You cannot run or test the script against Qlik Cloud, regardless of environment. Flag anything you are uncertain about with a `// TODO: verify` comment so the user can check.
4. **Preserve the user's starting script.** Do not rewrite or restructure parts of the script the user did not ask you to change.
5. **Output complete, runnable script.** Do not output partial snippets with "..." elisions unless the user explicitly asks for a diff. When you have file access, write the complete section back to the `.qvs` file; when outputting to chat, assume the user is copy-pasting into the Qlik Cloud script editor.

**Before writing any Qlik script**, read [references/writing-scripts.md](references/writing-scripts.md) (how to build it) and [references/syntax-and-patterns.md](references/syntax-and-patterns.md) (the syntax itself and the code patterns). Both are essential — Qlik syntax has many subtle differences from SQL that cause silent bugs if you rely on SQL intuition, and construction failures are invisible until reload.

### Non-negotiable syntax rules

These five are the majority of observed syntax failures: SQL intuition either will not parse or is silently wrong. The correct forms and examples live in the syntax reference — do not skip it. The lines below are the **check**, not the teaching. Confirm each one against the script before returning it.

1. **No `Count(*)`.** Use `Count(1)` for all rows, `Count(Field)` for non-nulls. ([syntax §6](references/syntax-and-patterns.md#6-key-functions))
2. **An alias cannot be used in the LOAD that creates it.** Split into a preceding LOAD or a `RESIDENT` step. ([syntax §2](references/syntax-and-patterns.md#2-load-statement-patterns))
3. **Assume auto-concatenation unless ruled out.** Matching field names silently discard your table label. `NoConcatenate` on every such LOAD — label, then prefix, then `LOAD`. ([syntax §4](references/syntax-and-patterns.md#4-concatenate))
4. **No `HAVING`.** Aggregate, then filter with `WHERE` in a second pass. ([syntax §5](references/syntax-and-patterns.md#5-where-group-by-order-by))
5. **`Round(x, 2)` is not 2 decimal places.** The second argument is a step: `Round(x, 0.01)`. Same for `Ceil()` and `Floor()`. ([syntax §6](references/syntax-and-patterns.md#6-key-functions))

**Then run the self-check** in [references/verification-checklist.md](references/verification-checklist.md).

The five rules stop the script from *breaking*. A separate class of failure leaves it running cleanly while producing the wrong answer — a field destroyed by an intermediate `LOAD`, a table left alive by an include, `TRACE` printing an expression, `FirstSortedValue()` returning NULL on ties. Construction is [writing-scripts.md](references/writing-scripts.md) (read it **before the first `LOAD`**); the `FirstSortedValue()` trap is [syntax §6](references/syntax-and-patterns.md#6-key-functions).

---

## Commenting Style

Write comments as an experienced Qlik developer would for colleagues who will maintain this script — not as a narration of your own work. The reader is a competent Qlik developer: they can read `LOAD`, `RESIDENT`, and `Sum()`. What they cannot recover from the code is **why**.

**Where comments belong**
- **Header block** (top of the script) — purpose, target/grain if ML, source data, owner.
- **Start of each `///$tab`** — one or two lines on what this section produces and why it exists.
- **Start of each logical block** (a table build, a join sequence, an aggregation) — the intent and any non-obvious logic or business rule behind it.
- **Individual lines** — only where there is a genuine point to make: a business rule or threshold and its rationale, a workaround with its reason, a non-obvious function argument, a unit or grain that isn't apparent, or a field description that saves the reader cross-referencing another part of the script. Deriving a field whose meaning isn't obvious from its name is a good reason; `// Load the customers table` is not.

**Register and length**
- Succinct and factual. One line where one line does. Full sentences are fine; paragraphs should be avoided.
- Explain **why**, not **what**. If a comment restates the code, delete it.
- No emoji, no decorative ASCII beyond the existing section banners, no enthusiasm, no hedging.
- Prefer the imperative or plain declarative: `// Exclude staff accounts — they distort the churn base rate.`

**Comments must not accumulate**
This is the failure mode to guard against hardest. When you revise a script:
- **Edit the existing comment to describe the new state.** Do not append a correction, a "fixed:" note, a "previously we…", or a second comment beside the first.
- **Delete comments describing code you removed.** A comment surviving its code is worse than no comment.
- **Never leave development history inline** — no `// changed 2026-08-11`, no `// was Count(*), now Count(1)`, no commented-out previous versions, no bug narration. The comment describes the code as it stands, in the present tense, as though written once.
- Ask of every comment you leave behind: *would a developer seeing this file for the first time, with no knowledge of its revision history, find this useful?* If not, it goes.

**Change log**
For complex or long-lived scripts, keep revision history in a dedicated `///$tab Change Log` placed early in the script (immediately after `Main`), not scattered through the code:

```qlik
///$tab Change Log
/**
 * 2026-08-11  NK  Added policy tenure and claims-frequency features.
 * 2026-07-02  NK  Switched split to time-based on RenewalDate (was random).
 * 2026-06-18  NK  Initial version.
 */
```

Add an entry here when making a substantive change to an existing script that already has this tab; create the tab when a script grows past a handful of tabs or when the user asks for one. Short scripts do not need it — do not add ceremony to a 30-line script.

**`// TODO: verify` notes** are the exception to all of the above: they are temporary, must state the reason, and the user removes them once checked.

---

## Workflow

When the user provides a starting script or prompt:

Load references by phase: construction and syntax before writing, verification after, ML prep only for Qlik Predict tasks.

1. **Load the right reference(s).** Read [references/writing-scripts.md](references/writing-scripts.md) and [references/syntax-and-patterns.md](references/syntax-and-patterns.md) before writing script. If the task is preparing data for a **Qlik Predict** experiment, also read [references/ml-data-prep.md](references/ml-data-prep.md) — it holds the target requirements, feature-engineering and leakage guidance, train/test split patterns, the explicit feature-matrix and Feature Definitions QVD requirements, script template, and final cleanup checklist.
2. **Understand the task, then design the target.** For ML prep, state back the prediction target, grain, and key transformations. Ask clarifying questions only if the intent is genuinely ambiguous. **Before writing any `LOAD`, write down the final table's grain and field list**, then work backwards to the source fields each one needs — see [writing-scripts §1](references/writing-scripts.md#1-design-the-target-data-model-first). Every step you then write should move the data measurably closer to that target.
3. **Read the existing script(s) from disk** before editing, and note the lib connection paths and source formats already in use — match them. If the script uses `$(Include=…)`, read the included file too: its tables live in the same namespace.
4. **Track the tables.** As you write, keep a running inventory of every table: its **name**, its **field set**, whether it carries **`NoConcatenate`**, and its **drop point**. Consult it before every `RESIDENT`, `JOIN`, `STORE`, or `DROP` rather than assuming the name you wrote earlier exists. Two live tables with the same field set means one of them has been auto-concatenated away. A table with no drop point recorded is either the final output or an oversight.
5. **Write the script.** With file access, edit or create the `.qvs` file(s) directly. Otherwise output complete, runnable sections in the chat. Comment per the [commenting style](#commenting-style) above, and add `TRACE` checkpoints at the points where a silent error would otherwise be invisible — after each `STORE`, each split, and each join that could fan out ([writing-scripts §3](references/writing-scripts.md#3-tracing-and-progress-output)).
6. **Re-read what you wrote and run the self-check** in [references/verification-checklist.md](references/verification-checklist.md). Since you cannot execute the script, this pass is the only validation it gets — treat it as required, not optional. Check the script as written on disk, not your memory of writing it. In the same pass, re-read the comments: delete any that restate the code, describe code you removed, or narrate the revision you just made.
7. **Flag uncertainties** with `// TODO: verify — [reason]`.
8. **Explain non-obvious logic** after the script: complex `Window()` calls, tricky joins, domain-specific choices.
9. **Suggest improvements** — additional features, null/outlier handling, leakage risks.

---

## Reference

### Bundled references

Organised by **when** they are read, so each phase loads only what it needs:

| Reference | Phase | Contents |
|---|---|---|
| **[references/writing-scripts.md](references/writing-scripts.md)** | Before the first `LOAD` | Designing the target data model and building towards it, table lifecycle and drop discipline (including `$(Include=…)` namespace hazards), `TRACE` checkpoints, and when to prototype in Python first. |
| **[references/syntax-and-patterns.md](references/syntax-and-patterns.md)** | While writing | Full Qlik load script syntax, the function reference, and feature-engineering code patterns. |
| **[references/verification-checklist.md](references/verification-checklist.md)** | After writing, and after every revision | Common pitfalls table, SQL-habits table, and the numbered self-check. |
| **[references/ml-data-prep.md](references/ml-data-prep.md)** | Qlik Predict tasks only | Target requirements, feature/field retention guidance, date conventions, explicit feature matrix, Feature Definitions QVD, train/test split patterns, leakage and class-imbalance checks, script template, final cleanup checklist, worked example. |

### Qlik documentation
- **Qlik Script Syntax & Functions:** https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/LoadData/script-syntax-functions.htm
- **Qlik Predict documentation:** https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/AutoML/home-automl.htm
- **Window function reference:** https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/LoadData/window-functions.htm
- **LOAD statement (authoritative clause list; alias scope rule):** https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/ScriptRegularStatements/Load.htm
- **Count():** https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/BasicAggregationFunctions/Count.htm
- **Round():** https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/NumericFunctions/round.htm
- **NoConcatenate / automatic concatenation:** https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/ScriptPrefixes/NoConcatenate.htm
- **FirstSortedValue() (NULL on tied ranks):** https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/BasicAggregationFunctions/FirstSortedValue.htm
- **TRACE:** https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/ScriptControlStatements/Trace.htm
- **Include / Must_Include:** https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Scripting/ScriptRegularStatements/Include.htm
