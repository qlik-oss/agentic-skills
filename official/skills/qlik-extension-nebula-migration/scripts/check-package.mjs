#!/usr/bin/env node
// Validates the folder produced by `nebula sense` before you zip and upload it.
// Read-only: reads the folder, prints findings. No network, no writes.
//
//   node check-package.mjs <extension-folder> [--expect-name <Name>]
//
// Checks come from the qlik.dev extension guidelines and the Qlik Cloud upload help page
// (see references/sources.md). Limits and roles can change; confirm against the current docs.
import { existsSync, readFileSync, statSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { argv, exit } from "node:process";
import { basename, resolve } from "node:path";
import { walk, readText, stripJsComments, join } from "./lib/scan.mjs";

const args = argv.slice(2);
const expIdx = args.indexOf("--expect-name");
const expectName = expIdx >= 0 ? args[expIdx + 1] : null;
const folder = args.find((a, i) => !a.startsWith("--") && (expIdx < 0 || i !== expIdx + 1));
if (!folder || !existsSync(folder) || !statSync(folder).isDirectory() || (expIdx >= 0 && !expectName)) {
  console.error("usage: node check-package.mjs <extension-folder> [--expect-name <Name>]");
  exit(2);
}

const MB = 1024 * 1024;
// Limits and blocked types are the values Qlik documented in October 2026. They change, so they warn rather than fail;
// confirm against the Managing extensions help page (references/sources.md, "Facts that go stale").
const LIMITS = { files: 500, zipBytes: 30 * MB, fileBytes: 30 * MB, uncompressedBytes: 100 * MB };
const QEXT_ICONS = new Set(["bar-chart-vertical", "extension", "filterpane", "gauge-chart", "line-chart", "list", "map", "pie-chart", "scatter-chart", "table", "text-image", "treemap"]);
const BLOCKED_EXT = new Set([".map", ".qvf", ".qvd", ".exe", ".dll", ".bat", ".cmd", ".sh", ".php", ".zip", ".gz", ".tar", ".jar", ".msi", ".dmg"]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp"]);
const IGNORED_HOSTS = /(^|\.)(w3\.org|github\.com|githubusercontent\.com|npmjs\.com|mozilla\.org|reactjs\.org|react\.dev|fb\.me|opensource\.org|apache\.org|json-schema\.org|localhost|example\.com|googlesource\.com|stackoverflow\.com|momentjs\.com|d3js\.org|lodash\.com|jquery\.(?:com|org)|jqueryui\.com|exceljs|sheetjs\.com|feross\.org|creativecommons\.org|gnu\.org|unicode\.org|ecma-international\.org|whatwg\.org|schema\.org|xmlns)$/;

const results = [];
const add = (level, msg) => results.push({ level, msg });

const files = walk(folder, { skipDirs: new Set() });
const root = resolve(folder);
const folderName = basename(root);

// ---- the .qext ----------------------------------------------------------------------------
const topLevel = files.filter((f) => !f.rel.includes("/"));
const qexts = topLevel.filter((f) => /\.qext$/i.test(f.rel));
if (qexts.length === 0) add("fail", "no .qext file at the top level of the folder");
if (qexts.length > 1) add("fail", `${qexts.length} .qext files at the top level (${qexts.map((q) => q.rel).join(", ")}); one extension per folder`);

let baseName = null;
let previewFile = null;
for (const q of qexts.slice(0, 1)) {
  if (!q.rel.endsWith(".qext")) add("fail", `${q.rel}: the .qext extension must be lower case`);
  baseName = q.rel.replace(/\.qext$/i, "");
  let meta;
  try {
    meta = JSON.parse(readText(q.abs));
  } catch (e) {
    add("fail", `${q.rel}: invalid JSON (${e.message})`);
  }
  if (meta) {
    if (!meta.name) add("fail", `${q.rel}: "name" is required`);
    if (meta.type !== "visualization") add("fail", `${q.rel}: "type" must be "visualization" (found ${JSON.stringify(meta.type)})`);
    if (meta.supernova !== true) add("fail", `${q.rel}: "supernova": true is missing; this is not a nebula extension (nebula sense writes it)`);
    if (meta.version && !/^\d+\.\d+\.\d+/.test(String(meta.version))) add("warn", `${q.rel}: version "${meta.version}" is not semver`);
    if (meta.icon && !QEXT_ICONS.has(meta.icon)) add("warn", `${q.rel}: icon "${meta.icon}" is not in the documented icon list (${[...QEXT_ICONS].join(", ")}). Other built-in Sense icons (for example "library") exist; keep the original's icon if the old extension used it and check it displays`);
    previewFile = meta.preview || null;
    if (meta.preview && !files.some((f) => f.rel === meta.preview)) add("fail", `${q.rel}: preview file "${meta.preview}" is not in the folder`);
  }
}

// ---- names must match ---------------------------------------------------------------------------
if (baseName) {
  if (/[^A-Za-z0-9_.-]/.test(baseName)) add("warn", `extension id "${baseName}" contains characters other than letters, digits, - _ and . (spaces are allowed by Sense but cannot be produced by nebula sense directly; see references/compatibility-and-rename.md)`);
  const entry = topLevel.find((f) => f.rel === `${baseName}.js`);
  if (!entry) {
    const near = topLevel.find((f) => f.rel.toLowerCase() === `${baseName}.js`.toLowerCase());
    add("fail", near ? `entry file is "${near.rel}" but the .qext is "${baseName}.qext"; the case must match exactly` : `entry file "${baseName}.js" is missing next to the .qext`);
  } else {
    // The wrapper's relative dependencies must exist (catches a missing `nebula build`).
    const text = stripJsComments(readText(entry.abs));
    const m = /\bdefine\s*\(\s*\[([^\]]*)\]/.exec(text);
    for (const dep of m ? [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]) : []) {
      if (!dep.startsWith(".")) continue;
      const rel = dep.replace(/^\.\//, "");
      if (!files.some((f) => f.rel === rel || f.rel === `${rel}.js`)) add("fail", `${entry.rel} depends on "${dep}" but that file is not in the folder (run \`nebula build\` before \`nebula sense\`)`);
    }
  }
  if (folderName !== baseName) {
    add("fail", `folder name "${folderName}" does not match the extension id "${baseName}"; qlik.dev says folder, .qext and entry names must match, otherwise import can fail silently. Use \`nebula sense --output ${baseName}\``);
  }
  if (expectName && baseName !== expectName) add("fail", `extension id is "${baseName}" but --expect-name is "${expectName}"`);
}

// ---- contents and limits ------------------------------------------------------------------------------
let total = 0;
let zipEstimate = 0;
for (const f of files) {
  total += f.size;
  zipEstimate += deflateRawSync(readFileSync(f.abs)).length;
  const ext = (f.rel.match(/\.[^./]+$/) ?? [""])[0].toLowerCase();
  if (BLOCKED_EXT.has(ext)) add("warn", `${f.rel}: ${ext} files were blocked or should not be shipped when this check was written (source maps, apps, executables, archives, scripts); confirm on the Managing extensions help page`);
  else if (IMAGE_EXT.has(ext) && f.rel !== previewFile) add("warn", `${f.rel}: Qlik advises against image files in the archive, and their URL contains the extension id (it changes at the rename): inline them as data URIs or SVG (references/external-resources.md)`);
  else if (!ext) add("warn", `${f.rel}: files without an extension are ignored by Qlik Cloud on import`);
  if (f.size > LIMITS.fileBytes) add("warn", `${f.rel}: ${(f.size / MB).toFixed(1)} MB exceeds the ${LIMITS.fileBytes / MB} MB single-file limit documented in October 2026; confirm the current limit`);
}
if (files.length > LIMITS.files) add("warn", `${files.length} files exceeds the ${LIMITS.files}-file limit documented in October 2026; confirm the current limit`);
if (total > LIMITS.uncompressedBytes) add("warn", `${(total / MB).toFixed(1)} MB uncompressed exceeds the ${LIMITS.uncompressedBytes / MB} MB limit documented in October 2026; confirm the current limit`);
if (zipEstimate > LIMITS.zipBytes) add("warn", `estimated zip size ${(zipEstimate / MB).toFixed(1)} MB exceeds the ${LIMITS.zipBytes / MB} MB limit documented in October 2026; confirm the current limit`);

// ---- external origins (for the tenant CSP allowlist) -----------------------------------------------------
const hosts = new Map();
for (const f of files.filter((x) => /\.(js|css|html?)$/i.test(x.rel))) {
  const text = /\.js$/i.test(f.rel) ? stripJsComments(readText(f.abs)) : readText(f.abs);
  for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?::\d+)?/gi)) {
    const h = m[1].toLowerCase();
    if (!IGNORED_HOSTS.test(h)) hosts.set(h, (hosts.get(h) ?? 0) + 1);
  }
}
const hostList = [...hosts.entries()].sort((a, b) => b[1] - a[1]);

const fails = results.filter((r) => r.level === "fail");
const warns = results.filter((r) => r.level === "warn");
console.log(`Package check: ${folder}  (${files.length} files, ${(total / MB).toFixed(2)} MB uncompressed, ~${(zipEstimate / MB).toFixed(2)} MB zipped)`);
if (baseName) console.log(`Extension id: ${baseName}`);
for (const r of fails) console.log(`FAIL  ${r.msg}`);
for (const r of warns) console.log(`warn  ${r.msg}`);
if (hostList.length) {
  console.log("\nExternal hosts referenced in the files (candidates for the tenant CSP allowlist; many are only strings inside libraries):");
  for (const [h, n] of hostList.slice(0, 15)) console.log(`  ${h} (${n})`);
}
console.log(`\n${fails.length} failure(s), ${warns.length} warning(s). Upload roles and limits: see references/packaging-and-deploy.md.`);
exit(fails.length ? 1 : 0);
