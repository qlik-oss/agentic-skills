#!/usr/bin/env node
// Static inventory of a legacy (Capability/Extension API) Qlik Sense visualization extension.
// Read-only: walks the folder you point it at and prints a work list. No network, no writes.
//
//   node inventory.mjs <extension-dir> [--json]
//
// --json  machine-readable output
//
// Run it on the legacy extension before migrating. To verify the migrated result use
// check-no-host-apis.mjs: ext.definition/ext.support legitimately remain in a nebula extension,
// so a "zero hits" rule only makes sense for host-page dependencies.
import { existsSync, statSync } from "node:fs";
import { argv, exit } from "node:process";
import {
  walk, readText, kindOf, isMinified, stripJsComments, stripCssComments, blankJsStrings, normalizeOptionalChaining, matchAll, amdDependencies,
  VENDORED_BYTES, SKIP_DIRS,
} from "./lib/scan.mjs";
import { RULES, describe, classifyAmdDep } from "./lib/rules.mjs";

const args = argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const dir = args.find((a) => !a.startsWith("--"));
if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) {
  console.error("usage: node inventory.mjs <extension-dir> [--json]");
  exit(2);
}

const BUILD_TOOLING = /^(?:gulpfile|webpack\.config|rollup\.config|karma\.conf|eslint\.config|babel\.config|vite\.config)\b/;
const files = walk(dir, { skipDirs: new Set([...SKIP_DIRS, "scripts", "docs", "tools"]) });
const report = {
  dir,
  qext: [],
  entryCandidates: [],
  amdDependencies: [],
  vendored: [],
  minified: [],
  testFilesSkipped: 0,
  minifiedLike: [],
  images: [],
  lessFiles: [],
  findings: [],
  scannedFiles: 0,
};

for (const f of files) {
  const kind = kindOf(f.rel);
  if (kind === "image") report.images.push(f.rel);
  if (f.rel.endsWith(".less")) report.lessFiles.push(f.rel);
  if (kind === "qext") {
    try {
      const q = JSON.parse(readText(f.abs));
      report.qext.push({ file: f.rel, name: q.name, type: q.type, version: q.version, supernova: q.supernova === true });
    } catch (e) {
      report.qext.push({ file: f.rel, error: `invalid JSON: ${e.message}` });
    }
    continue;
  }
  if (!["js", "html", "css"].includes(kind)) continue;
  if (BUILD_TOOLING.test(f.rel.split("/").pop())) continue;
  if (/(^|\/)(tests?|__tests__|specs?|e2e)\//.test(f.rel) || /\.(spec|test)\.[jt]sx?$/.test(f.rel)) {
    report.testFilesSkipped++;
    continue;
  }
  if (isMinified(f.rel)) {
    report.minified.push(f.rel);
    continue;
  }
  if (f.size > VENDORED_BYTES) {
    report.vendored.push({ file: f.rel, bytes: f.size });
    continue;
  }

  const raw = readText(f.abs);
  const text = kind === "js" ? normalizeOptionalChaining(stripJsComments(raw)) : kind === "css" ? stripCssComments(raw) : raw;
  report.scannedFiles++;
  const codeText = kind === "js" ? blankJsStrings(text) : text;
  const lines = raw.split("\n");
  if (kind === "js" && raw.length > 5000 && raw.length / Math.max(lines.length, 1) > 400) report.minifiedLike.push(f.rel);

  if (kind === "js") {
    const deps = amdDependencies(text);
    if (deps) {
      const isEntry = /\b(paint|definition|initialProperties)\b/.test(text);
      if (isEntry) report.entryCandidates.push(f.rel);
      report.amdDependencies.push({
        file: f.rel,
        deps: deps.map((d) => ({ dep: d, kind: classifyAmdDep(d) })),
      });
    }
  }

  for (const rule of RULES) {
    if (rule.scope !== "any" && rule.scope !== kind) continue;
    if (rule.onlyExt && !f.rel.endsWith(rule.onlyExt)) continue;
    for (const { match, line } of matchAll(rule.codeOnly ? codeText : text, rule.re)) {
      const d = describe(rule, match);
      report.findings.push({ file: f.rel, line, id: d.id, bucket: d.bucket, to: d.to });
    }
  }
}

// AMD dependencies are findings too.
for (const entry of report.amdDependencies) {
  for (const { dep, kind } of entry.deps) {
    if (kind === "host") {
      report.findings.push({ file: entry.file, line: 0, id: `amd.host-dep:${dep}`, bucket: "host", to: "host-provided AMD module; replace with an npm dependency or hooks" });
    } else if (kind === "plugin") {
      report.findings.push({ file: entry.file, line: 0, id: `amd.plugin:${dep.split("!")[0]}`, bucket: "rewrite", to: "RequireJS loader plugin; use static imports (CSS imports are supported by nebula build)" });
    } else if (kind === "external-url") {
      report.findings.push({ file: entry.file, line: 0, id: "amd.external-url", bucket: "review", to: `external dependency ${dep}; install from npm and bundle it` });
    } else if (kind === "third-party") {
      report.findings.push({ file: entry.file, line: 0, id: `amd.third-party:${dep}`, bucket: "review", to: "resolve to an npm package (check the version the extension actually ships) and add it to dependencies" });
    }
  }
}

const buckets = { direct: [], rewrite: [], host: [], review: [] };
for (const f of report.findings) buckets[f.bucket].push(f);

const byId = (list) => {
  const m = new Map();
  for (const f of list) {
    const e = m.get(f.id) ?? { id: f.id, count: 0, to: f.to, where: [] };
    e.count++;
    if (e.where.length < 4) e.where.push(f.line ? `${f.file}:${f.line}` : f.file);
    m.set(f.id, e);
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
};

const hints = [];
if (!report.qext.length) hints.push("No .qext found under this folder; point the script at the extension root.");
if (report.qext.some((q) => q.supernova)) hints.push("A qext already has supernova:true; this may already be a nebula extension.");
if (buckets.host.some((f) => f.id.startsWith("host.angular"))) hints.push("AngularJS is used: plan a renderer rewrite (references/angularjs-rewrite.md).");
if (buckets.host.some((f) => /lui-class/.test(f.id))) hints.push("Relies on Leonardo UI classes from the Sense page: ship your own CSS.");
if (buckets.host.some((f) => f.id === "export.call")) hints.push("Uses QVisualization export calls; unsupported in Qlik Cloud.");
if (report.lessFiles.length) hints.push("LESS files present: convert to CSS before building.");
if (report.images.length) hints.push("Images ship in the folder: inline them as data URIs or SVG so nothing is served from, or hosted outside, the extension (references/external-resources.md).");
if (report.minifiedLike.length) hints.push(`Minified or bundled source (${report.minifiedLike.join(", ")}): hit locations are meaningless and counts may be incomplete. Find the readable sources (the repo's src/ folder) and inventory those too.`);
if (report.vendored.length) hints.push(`Large vendored files were skipped (${report.vendored.map((v) => v.file).join(", ")}); replace them with npm dependencies at the version their header states.`);
if (report.minified.length) hints.push(`Minified files were skipped (${report.minified.join(", ")}); they are libraries to map to npm, not code to port.`);
const localLibs = report.amdDependencies.flatMap((a) => a.deps).filter((d) => d.kind === "local").map((d) => d.dep);
if (localLibs.length) hints.push(`Local AMD modules (the extension's own files or vendored libraries): ${[...new Set(localLibs)].join(", ")}.`);
if ([...buckets.review, ...buckets.rewrite].some((f) => f.id === "host.external-url" || f.id === "cdn.google-charts" || f.id === "amd.external-url")) hints.push("Loads code, styles, fonts or images from another origin at run time: Qlik Cloud blocks that unless the tenant admin adds a CSP entry. Bundle or inline each one (references/external-resources.md); list any that remain.");
if (buckets.review.some((f) => f.id === "code.eval")) hints.push("eval/new Function found: skip stage 1 (generated code that refers to local names breaks once the bundle is minified) and rewrite it as a normal function.");
if ([...buckets.review, ...buckets.rewrite].some((f) => f.id === "dom.html-injection")) hints.push("HTML is built from strings: decide how data reaches the DOM (textContent, or a sanitizer for a deliberate raw-HTML feature). Sanitizing changes what existing charts can show, so it affects the rename decision.");
const nonDeclared = report.amdDependencies.flatMap((a) => a.deps).filter((d) => d.kind === "third-party").map((d) => d.dep);
if (nonDeclared.length) hints.push(`Third-party AMD modules to map to npm: ${[...new Set(nonDeclared)].join(", ")}.`);

const out = {
  ...report,
  summary: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
  grouped: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, byId(v)])),
  hints,
};
delete out.findings;

if (flags.has("--json")) {
  console.log(JSON.stringify({ ...out, findings: report.findings }, null, 2));
} else {
  console.log(`Extension inventory: ${dir}`);
  console.log(`Scanned ${out.scannedFiles} source files (skipped: ${out.minified.length} minified, ${out.vendored.length} vendored, ${out.testFilesSkipped} test files)`);
  for (const q of out.qext) {
    console.log(q.error ? `qext: ${q.file} (${q.error})` : `qext: ${q.file}  name="${q.name}" type=${q.type} version=${q.version} supernova=${q.supernova}`);
  }
  if (out.entryCandidates.length) console.log(`Entry candidates: ${out.entryCandidates.join(", ")}`);
  for (const [name, list] of Object.entries(out.grouped)) {
    console.log(`\n== ${name} (${out.summary[name]} hits)`);
    for (const e of list) {
      console.log(`  ${String(e.count).padStart(3)}  ${e.id}  [${e.where.join(", ")}]`);
      if (e.to) console.log(`       -> ${e.to}`);
    }
    if (!list.length) console.log("  none");
  }
  if (hints.length) {
    console.log("\nNotes:");
    for (const h of hints) console.log(`  - ${h}`);
  }
  console.log("\nThese are regex heuristics: treat them as a work list and read the code.");
}
