#!/usr/bin/env node
// Static drop-in check: can the migrated extension take over the ORIGINAL extension id without
// breaking charts that are already saved on the tenant? Compares the legacy source with the nebula source.
// Read-only: no network, no writes.
//
//   node check-compat.mjs <legacy-extension-dir> <nebula-project-dir> [--accept-dropped ref1,ref2,...] [--json]
//
// --accept-dropped  properties you deliberately removed (for example settings that only restyled the host
//                   page). They become warnings instead of failures, and MUST be listed in MIGRATION.md.
//                   Saved objects keep working, but that setting no longer does anything.
//
// Exit codes: 0 no blocking differences found (still verify in the host), 1 not a drop-in, 2 usage error.
//
// This is a heuristic over source text. It can prove a rename is UNSAFE; it cannot prove it is safe.
// A passing result means "no blocking difference found", not "verified".
import { existsSync, readFileSync, statSync } from "node:fs";
import { argv, exit } from "node:process";
import { walk, readText, kindOf, stripJsComments, lastSegment, join, SKIP_DIRS } from "./lib/scan.mjs";

const args = argv.slice(2);
const asJson = args.includes("--json");
const acceptIdx = args.indexOf("--accept-dropped");
const accepted = new Set(acceptIdx >= 0 ? String(args[acceptIdx + 1] ?? "").split(",").map((x) => x.trim()).filter(Boolean) : []);
const [oldDir, newDir] = args.filter((a, i) => !a.startsWith("--") && (acceptIdx < 0 || i !== acceptIdx + 1));
const isDir = (p) => p && existsSync(p) && statSync(p).isDirectory();
if (!isDir(oldDir) || !isDir(newDir)) {
  console.error("usage: node check-compat.mjs <legacy-extension-dir> <nebula-project-dir> [--accept-dropped ref1,ref2] [--json]");
  exit(2);
}

const SKIP = new Set([...SKIP_DIRS, "scripts", "docs", "test", "tests", "__tests__", "e2e"]);
const isSource = (rel) => kindOf(rel) === "js" && !/\.(spec|test)\.[jt]sx?$|\.min\.js$/.test(rel) && !/^(?:gulpfile|webpack\.config|rollup\.config|karma\.conf)/.test(rel.split("/").pop());

function sources(dir) {
  const root = existsSync(join(dir, "src")) && statSync(join(dir, "src")).isDirectory() ? join(dir, "src") : dir;
  return walk(root, { skipDirs: SKIP })
    .filter((f) => isSource(f.rel) && f.size < 400 * 1024)
    .map((f) => ({ rel: f.rel, text: stripJsComments(readText(f.abs)) }));
}

/** Text of the first balanced {...} block at or after `from`. */
function block(text, from) {
  const open = text.indexOf("{", from);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(open, i + 1);
  }
  return text.slice(open);
}

/** Text of the first balanced [...] block at or after `from`. */
function arrayBlock(text, from) {
  const open = text.indexOf("[", from);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "[") depth++;
    else if (text[i] === "]" && --depth === 0) return text.slice(open, i + 1);
  }
  return text.slice(open);
}

function limits(text, kind) {
  // kind = "dimensions" | "measures": the first `kind: { ... min/max ... }` block that has a min or max.
  for (const m of text.matchAll(new RegExp(`\\b${kind}\\s*:\\s*\\{`, "g"))) {
    const b = block(text, m.index);
    const min = /\bmin\s*:\s*(\d+)/.exec(b);
    const max = /\bmax\s*:\s*(\d+)/.exec(b);
    if (min || max) return { min: min ? Number(min[1]) : null, max: max ? Number(max[1]) : null };
  }
  return null;
}

const STANDARD_LAYOUT = new Set(["title", "subtitle", "footnote", "showTitles", "visualization", "version", "snapshotData", "showDetails", "showDetailsExpression", "disableNavMenu", "name", "description", "script"]);
const isStandard = (path) => /^q[A-Z]/.test(path) || STANDARD_LAYOUT.has(path.split(".")[0]);

function extract(files, { nebula = false } = {}) {
  const all = files.map((f) => f.text).join("\n");
  // Literal refs: `ref: 'a.b'` or `"ref": "a.b"`. A literal followed by `+` is a prefix of a dynamic ref.
  const refs = new Set();
  const dynamic = [];
  for (const m of all.matchAll(/["']?\bref["']?\s*:\s*(?:(['"])([^'"]+)\1(\s*\+)?|`([^`]*)`|([A-Za-z_$][\w$.]*(?:\([^)]*\))?))/g)) {
    const lit = m[2];
    if (lit !== undefined && !m[3]) {
      const ref = lit.trim();
      // refs that bind the built-in data sections are the data target, not custom properties
      if (!/^q(HyperCubeDef|ListObjectDef)\b/.test(ref)) refs.add(ref);
    } else {
      dynamic.push((m[0] || "").replace(/\s+/g, " ").slice(0, 60));
    }
  }
  const reads = new Set(
    [...all.matchAll(/\blayout\s*\.\s*([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)/g)].map((m) => m[1].replace(/\s+/g, "")),
  );
  const paths = new Set();
  const minified = files.filter((f) => f.text.length > 5000 && f.text.length / Math.max(f.text.split("\n").length, 1) > 400).map((f) => f.rel);
  const dataLimits = { dimensions: null, measures: null };
  if (nebula) {
    // Only the data targets decide which definition the nebula extension renders.
    for (const m of all.matchAll(/\btargets\s*:\s*\[/g)) {
      const targets = arrayBlock(all, m.index);
      for (const p of targets.matchAll(/\bpath\s*:\s*['"]([^'"]+)['"]/g)) paths.add(p[1]);
      dataLimits.dimensions ??= limits(targets, "dimensions");
      dataLimits.measures ??= limits(targets, "measures");
    }
  } else {
    // Only where the extension DEFINES its own data: `qHyperCubeDef: {` as a property key. A string such as
    // getHyperCubeData('/qHyperCubeDef') or a read like obj.qHyperCubeDef is about some other object.
    if (/(?<![.'"\/\w$])qHyperCubeDef\s*:/.test(all)) paths.add("/qHyperCubeDef");
    if (/(?<![.'"\/\w$])qListObjectDef\s*:/.test(all)) paths.add("/qListObjectDef");
  }
  const support = {};
  const sm = /\bsupport\s*:\s*\{/.exec(all);
  if (sm) for (const m of block(all, sm.index).matchAll(/\b(snapshot|export|exportData|viewData|sharing)\s*:\s*(true|false)/g)) support[m[1]] = m[2] === "true";
  // Legacy form: snapshot: { canTakeSnapshot: true } means support.snapshot.
  if (!("snapshot" in support)) {
    const sn = /\bsnapshot\s*:\s*\{[^}]*?\bcanTakeSnapshot\s*:\s*(true|false|!0|!1)/.exec(all);
    if (sn) support.snapshot = sn[1] === "true" || sn[1] === "!0";
  }
  // Dropdown/radio option values are stored in saved objects; a removed value silently changes them.
  const optionValues = new Set();
  const strings = new Set();
  if (!nebula) {
    for (const m of all.matchAll(/\boptions\s*:\s*\[/g)) {
      for (const v of arrayBlock(all, m.index).matchAll(/\bvalue\s*:\s*['"]([^'"\n]{1,60})['"]/g)) optionValues.add(v[1]);
    }
  } else {
    for (const v of all.matchAll(/['"`]([^'"`\n]{1,60})['"`]/g)) strings.add(v[1]);
  }
  return {
    refs,
    dynamic,
    minified,
    reads,
    paths,
    optionValues,
    strings,
    dimensions: nebula ? dataLimits.dimensions : limits(all, "dimensions"),
    measures: nebula ? dataLimits.measures : limits(all, "measures"),
    support,
    hasImportExport: /\b(importProperties|exportProperties)\b/.test(all),
  };
}

function extensionId(dir, { preferPackage = false } = {}) {
  const fromPackage = () => {
    const pkg = join(dir, "package.json");
    if (!existsSync(pkg)) return null;
    try {
      const id = lastSegment(JSON.parse(readFileSync(pkg, "utf8")).name);
      return id ? { id, from: "package.json name" } : null;
    } catch {
      return null;
    }
  };
  // A nebula project's id is its package name; any .qext on disk is generated output (and may be stale).
  if (preferPackage) {
    const p = fromPackage();
    if (p) return p;
  }
  const q = walk(dir, { skipDirs: SKIP_DIRS }).find((f) => f.rel.endsWith(".qext"));
  if (q) return { id: q.rel.split("/").pop().replace(/\.qext$/, ""), from: q.rel };
  return fromPackage() ?? { id: null, from: null };
}

const oldFiles = sources(oldDir);
const newFiles = sources(newDir);
const o = extract(oldFiles);
const n = extract(newFiles, { nebula: true });
const oldId = extensionId(oldDir);
const newId = extensionId(newDir, { preferPackage: true });

const findings = [];
const add = (level, code, msg) => findings.push({ level, code, msg });

// 0. how much could be compared at all
const nothingToCompare = o.refs.size === 0 && o.paths.size === 0 && !o.dynamic.length;
if (nothingToCompare) {
  add("warn", "nothing-to-compare", "the legacy source defines no literal property refs and no data path (it may keep state elsewhere, or the sources scanned are bundled). A pass says NOTHING about saved objects; rely on the host test");
}
if (o.minified.length) {
  add("warn", "minified-legacy", `legacy source looks minified or bundled (${o.minified.slice(0, 3).join(", ")}): refs may be missing from this comparison. Point the check at the readable sources (the repo's src/ folder), not the built dist/`);
}
if (o.dynamic.length) {
  add("warn", "dynamic-refs-old", `${o.dynamic.length} property ref(s) in the legacy source are built dynamically and cannot be compared (for example: ${o.dynamic.slice(0, 3).join(" | ")}). Compare them by hand`);
}
if (n.dynamic.length) {
  add("info", "dynamic-refs-new", `${n.dynamic.length} property ref(s) in the new source are built dynamically (for example: ${n.dynamic.slice(0, 2).join(" | ")})`);
}

// 1. property paths the old definition wrote (saved in every existing object)
for (const ref of [...o.refs].sort()) {
  if (n.refs.has(ref)) continue;
  if (accepted.has(ref)) {
    add("warn", "ref-dropped-accepted", `property "${ref}" was deliberately dropped (--accept-dropped); saved values are ignored. List it in MIGRATION.md`);
  } else if ([...n.dynamic].length && n.dynamic.some((d) => d.includes(ref.split(".")[0]))) {
    add("warn", "ref-maybe-dynamic", `property "${ref}" is not a literal ref in the new source, but the new source builds refs dynamically; verify by hand`);
  } else {
    add("fail", "ref-removed", `property "${ref}" was defined by the old extension but is missing from the new one; existing objects store a value there and it will be ignored (or renamed without migration)`);
  }
}
for (const ref of [...n.refs].sort()) {
  if (!o.refs.has(ref)) add("info", "ref-added", `property "${ref}" is new; objects saved by the old extension do not have it, and initial/default values apply only to NEW objects, so the rendering code needs a fallback`);
}

// 2. layout paths read by the new code that old saved objects may not have
for (const p of [...n.reads].sort()) {
  if (isStandard(p)) continue;
  const known = o.reads.has(p) || [...o.refs, ...n.refs].some((r) => p === r || p.startsWith(`${r}.`) || r.startsWith(`${p}.`));
  if (!known) add("warn", "layout-read-new", `new code reads layout.${p}, which the old extension neither defined nor read; saved objects may lack it`);
}

// 3. data path
for (const p of o.paths) {
  if (!/^\/q(HyperCubeDef|ListObjectDef)$/.test(p)) continue;
  if (!n.paths.has(p)) add("fail", "data-path", `old extension used ${p} but no nebula data target uses that path; saved objects keep their data under ${p}`);
}

// 4. dimension / measure limits
for (const kind of ["dimensions", "measures"]) {
  const a = o[kind];
  const b = n[kind];
  if (a && !b) {
    add("warn", "limits-missing", `old extension limited ${kind} (min ${a.min ?? "-"}, max ${a.max ?? "-"}); no ${kind} limits found in the new data target`);
  } else if (a && b) {
    if (a.min !== b.min || a.max !== b.max) {
      const stricter = (b.min ?? 0) > (a.min ?? 0) || (b.max ?? Infinity) < (a.max ?? Infinity);
      add(stricter ? "fail" : "warn", "limits-differ", `${kind} limits changed: old min ${a.min ?? "-"} / max ${a.max ?? "-"}, new min ${b.min ?? "-"} / max ${b.max ?? "-"}${stricter ? "; saved objects within the old limits would show a placeholder" : ""}`);
    }
  }
}

// 4b. option values of dropdowns/radios (saved objects store the value)
if (!o.minified.length) {
  const gone = [...o.optionValues].filter((v) => v !== "" && !n.strings.has(v));
  if (gone.length) add("warn", "option-value-removed", `${gone.length} option value(s) of the legacy panel do not appear as a string anywhere in the new source (${gone.slice(0, 6).map((v) => `"${v}"`).join(", ")}${gone.length > 6 ? ", ..." : ""}); objects that saved one of them would lose that setting. Restore them, or list each as an intentional change`);
}

// 5. support flags and conversion
for (const k of Object.keys(o.support)) {
  if (k in n.support && o.support[k] !== n.support[k]) add("warn", "support-differs", `support.${k} changed from ${o.support[k]} to ${n.support[k]}`);
  if (!(k in n.support)) add("info", "support-missing", `support.${k} (${o.support[k]}) is not set in the new extension; defaults apply`);
}
if (o.hasImportExport && !n.hasImportExport) add("warn", "conversion-lost", "old extension had importProperties/exportProperties; converting charts to/from this type may behave differently");

// 6. identity
const idMatches = oldId.id && newId.id && oldId.id === newId.id;
if (!oldId.id || !newId.id) add("warn", "id-unknown", "could not determine the extension id from a .qext or package.json name for one side");
else if (!idMatches) add("info", "id-differs", `new id "${newId.id}" differs from the original "${oldId.id}"; expected until the final rename step`);

const fails = findings.filter((f) => f.level === "fail");
const verdict = fails.length ? "NOT_DROP_IN" : nothingToCompare ? "NOTHING_TO_COMPARE" : "NO_BLOCKING_DIFFERENCE_FOUND";

if (asJson) {
  console.log(JSON.stringify({ verdict, oldId, newId, findings, old: { refs: [...o.refs], paths: [...o.paths], dimensions: o.dimensions, measures: o.measures }, new: { refs: [...n.refs], paths: [...n.paths], dimensions: n.dimensions, measures: n.measures } }, null, 2));
} else {
  console.log(`Compatibility check\n  legacy: ${oldDir}  (id ${oldId.id ?? "?"})\n  nebula: ${newDir}  (id ${newId.id ?? "?"})`);
  console.log(`  property refs: ${o.refs.size} old, ${n.refs.size} new; data paths old [${[...o.paths].join(", ")}] new [${[...n.paths].join(", ")}]`);
  for (const f of findings) console.log(`${f.level.toUpperCase().padEnd(4)}  [${f.code}] ${f.msg}`);
  console.log(
    fails.length
      ? `\nVerdict: NOT a drop-in. Keep the side-by-side (<original-id>-nebula) id for the migrated extension and list the failures above in the migration report.`
      : nothingToCompare
        ? `\nVerdict: NOTHING TO COMPARE statically. The original defines no refs or data path this tool can see, so this result is not evidence of compatibility. Test a chart saved by the old extension in your host before renaming.`
        : `\nVerdict: no blocking difference found by static checks${findings.some((f) => f.level === "warn") ? " (see warnings)" : ""}. Renaming to the original id is reasonable, but confirm in the host with a chart saved by the old extension (see references/compatibility-and-rename.md).`,
  );
}
exit(fails.length ? 1 : 0);
