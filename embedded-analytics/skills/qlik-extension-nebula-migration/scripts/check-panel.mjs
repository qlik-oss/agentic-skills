#!/usr/bin/env node
// Static check for property-panel mistakes that Qlik Sense reports as nothing at all.
// Read-only: no network, no writes.
//
//   node check-panel.mjs <nebula-project-dir>
//
// Verified in Qlik Cloud (October 2026): an extension that declares data targets (qae.data.targets) but whose
// ext.definition has no Data section (`uses: 'data'`) does not show its own property panel. Sense shows the
// SHEET's panel instead, with no error in the console. The extension itself renders normally, so only a
// click in edit mode reveals it.
//
// Exit codes: 0 pass (warnings allowed), 1 failure, 2 usage error.
import { existsSync, statSync } from "node:fs";
import { argv, exit } from "node:process";
import { walk, readText, kindOf, stripJsComments, join, SKIP_DIRS } from "./lib/scan.mjs";

const dir = argv[2];
if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) {
  console.error("usage: node check-panel.mjs <nebula-project-dir>");
  exit(2);
}

const srcRoot = existsSync(join(dir, "src")) ? join(dir, "src") : dir;
const files = walk(srcRoot, { skipDirs: new Set([...SKIP_DIRS, "test", "tests", "__tests__"]) })
  .filter((f) => kindOf(f.rel) === "js" && !/\.(spec|test)\./.test(f.rel))
  .map((f) => ({ rel: f.rel, text: stripJsComments(readText(f.abs)) }));

const findings = [];
const add = (level, msg) => findings.push({ level, msg });

const dataFile = files.find((f) => /(^|\/)data\.[jt]s$/.test(f.rel));
const hasTargets = !!dataFile && /\btargets\s*:\s*\[\s*\{/.test(dataFile.text);
const all = files.map((f) => f.text).join("\n");
const hasDataSection = /\buses\s*:\s*['"]data['"]/.test(all);
const hasSettings = /\buses\s*:\s*['"]settings['"]/.test(all);
const hasDefinition = /\bdefinition\s*:|\bdefinition\b\s*[,}]/.test(all);

if (!dataFile) add("warn", "no data.js found; data-target checks skipped");
if (!hasDefinition) add("warn", "no ext.definition found: Sense will show only its default panel sections");

if (hasTargets && !hasDataSection) {
  add("fail", "declares data targets (data.js) but the panel definition has no `data: { uses: 'data' }` section. Sense then shows the SHEET's property panel instead of the object's, with no error. Add the section, or declare `targets: []` if the extension should not offer a data picker (check-compat.mjs will then report the data path as removed)");
}
if (!hasTargets && hasDataSection) {
  add("warn", "panel has a Data section but data.js declares no targets: the section will be empty");
}
if (hasDefinition && !hasSettings) {
  add("warn", "no `uses: 'settings'` (Appearance) section: titles, alternate states and other standard sections will be missing");
}

const fails = findings.filter((f) => f.level === "fail");
for (const f of findings) console.log(`${f.level === "fail" ? "FAIL" : "warn"}  ${f.msg}`);
console.log(`panel check: data targets ${hasTargets ? "declared" : "none"}, Data section ${hasDataSection ? "present" : "absent"}; ${fails.length} failure(s), ${findings.length - fails.length} warning(s)`);
exit(fails.length ? 1 : 0);
