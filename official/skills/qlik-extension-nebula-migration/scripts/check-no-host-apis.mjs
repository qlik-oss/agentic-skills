#!/usr/bin/env node
// Verifies a migrated nebula extension does not depend on APIs or frameworks from the Sense client page.
// Read-only: no network, no writes.
//
//   node check-no-host-apis.mjs <project-dir> [--bundle <extension-output-dir>] [--allow-shim]
//
// <project-dir>   the nebula project (reads <project-dir>/src and package.json)
// --bundle <dir>  also scan the folder produced by `nebula sense` (the one you zip and upload)
// --allow-shim    stage 1 only: skip compat-shim.js and downgrade the legacy names the shim supplies
//                 ($element, backendApi.*, this.selectValues) to warnings. Host dependencies still fail.
//                 The final check (stage 2 and the packaging step) must run WITHOUT this flag.
//
// Exit codes: 0 pass (warnings allowed), 1 at least one failure, 2 usage error.
import { existsSync, readFileSync, statSync } from "node:fs";
import { argv, exit } from "node:process";
import { builtinModules } from "node:module";
import { dirname } from "node:path";
import { walk, readText, kindOf, stripJsComments, stripCssComments, blankJsStrings, normalizeOptionalChaining, matchAll, join, SKIP_DIRS } from "./lib/scan.mjs";
import { RULES, describe } from "./lib/rules.mjs";

const args = argv.slice(2);
const bundleIdx = args.indexOf("--bundle");
const bundleDir = bundleIdx >= 0 ? args[bundleIdx + 1] : null;
const allowShim = args.includes("--allow-shim");
const projectDir = args.find((a, i) => !a.startsWith("--") && (bundleIdx < 0 || i !== bundleIdx + 1));
if (!projectDir || !existsSync(projectDir) || !statSync(projectDir).isDirectory() || (bundleIdx >= 0 && !bundleDir)) {
  console.error("usage: node check-no-host-apis.mjs <project-dir> [--bundle <extension-output-dir>] [--allow-shim]");
  exit(2);
}

const results = [];
const add = (level, where, msg) => results.push({ level, where, msg });

// ---- package.json ---------------------------------------------------------------
let declared = new Set();
const pkgPath = join(projectDir, "package.json");
if (existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    for (const key of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      for (const name of Object.keys(pkg[key] ?? {})) declared.add(name);
    }
    if (!pkg.peerDependencies?.["@nebula.js/stardust"]) {
      add("warn", "package.json", "@nebula.js/stardust is not in peerDependencies; `nebula build` externalizes peerDependencies, so hooks may get bundled twice");
    }
  } catch (e) {
    add("fail", "package.json", `invalid JSON: ${e.message}`);
  }
} else {
  add("warn", "package.json", "not found; declared-dependency checks skipped");
}
const rootAbs = join(projectDir, ".");
const pkgDepsCache = new Map();
function depsOf(pkgJsonPath) {
  if (!pkgDepsCache.has(pkgJsonPath)) {
    let names = [];
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
      names = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"].flatMap((k) => Object.keys(pkg[k] ?? {}));
    } catch {
      /* unreadable package.json: no declarations */
    }
    pkgDepsCache.set(pkgJsonPath, names);
  }
  return pkgDepsCache.get(pkgJsonPath);
}
/** Dependencies visible to a file: every package.json from its folder up to the project folder. */
function declaredFor(fileAbs) {
  const out = new Set(declared);
  let dir = dirname(fileAbs);
  for (let i = 0; i < 20; i++) {
    const candidate = join(dir, "package.json");
    if (existsSync(candidate)) for (const n of depsOf(candidate)) out.add(n);
    if (dir === rootAbs || dir === projectDir || dirname(dir) === dir) break;
    dir = dirname(dir);
  }
  return out;
}
const BUILTINS = new Set(builtinModules.flatMap((m) => [m, m.replace(/^node:/, "")]));

// Class names the project defines itself in CSS (so a `lui-*` class here is not a host dependency).
const ownClasses = new Set();
const hasDep = (...names) => names.some((n) => declared.has(n));

// ---- source scan ------------------------------------------------------------------
const srcRoot = existsSync(join(projectDir, "src")) ? join(projectDir, "src") : projectDir;
const FAIL_PREFIXES = ["host.", "qlik.", "backendApi.", "ctx.selectValues", "dom.$element", "export.call", "variable.setContent", "variable.getContent"];
const LUI_CLASS_CONTEXT = /\bclass(?:Name|List)?\b|\b(?:add|remove|toggle|has)Class\b|setAttribute\s*\(\s*['"]class|<[a-z][^>]*\bclass\s*=|\.lui-|querySelector/;
const REVIEW_AS_WARN = new Set(["host.dom-query", "host.jquery-global-selector", "host.external-url", "host.enigma-session", "host.app-model", "app.sheetlist", "dom.html-injection", "code.eval", "storage.local", "cdn.google-charts", "host.relative-fetch", "host.lui-string"]);
let scanned = 0;
for (const f of walk(srcRoot, { skipDirs: new Set([...SKIP_DIRS, "test", "tests", "__tests__"]) })) {
  if (kindOf(f.rel) === "css") for (const m of stripCssComments(readText(f.abs)).matchAll(/\.(lui-[\w-]+)/g)) ownClasses.add(m[1]);
}

for (const f of walk(srcRoot, { skipDirs: new Set([...SKIP_DIRS, "test", "tests", "__tests__"]) })) {
  const kind = kindOf(f.rel);
  if (!["js", "css", "html"].includes(kind)) continue;
  if (/\.(spec|test)\.[jt]sx?$/.test(f.rel) || /\.min\.(js|css)$/.test(f.rel)) continue;
  if (allowShim && /(^|\/)compat-shim\.js$/.test(f.rel)) continue;
  const raw = readText(f.abs);
  const text = kind === "js" ? normalizeOptionalChaining(stripJsComments(raw)) : kind === "css" ? stripCssComments(raw) : raw;
  scanned++;
  const lines = text.split("\n");
  const codeText = kind === "js" ? blankJsStrings(text) : text;
  const where = (line) => `${join(srcRoot === projectDir ? "" : "src", f.rel)}:${line}`;
  const fileDeclared = declaredFor(f.abs);
  const fileHasDep = (...names) => names.some((n) => fileDeclared.has(n));

  for (const rule of RULES) {
    if (rule.scope !== "any" && rule.scope !== kind) continue;
    if (rule.onlyExt && !f.rel.endsWith(rule.onlyExt)) continue;
    for (const { match, line } of matchAll(rule.codeOnly ? codeText : text, rule.re)) {
      const d = describe(rule, match);
      if (d.id.startsWith("lib.jquery") && fileHasDep("jquery")) continue;
      if (d.id.startsWith("lib.underscore") && fileHasDep("underscore", "lodash", "lodash-es")) continue;
      if (d.id === "host.lui-class" && (kind === "css" || ownClasses.has(match[0]))) continue;   // defined by the project itself
      if (d.id === "host.lui-class" && kind === "js" && !LUI_CLASS_CONTEXT.test(lines[line - 1] || "")) {
        // A value such as 'lui-default' that is stored or compared, not applied as a class: ask for a look instead of failing.
        add("warn", where(line), `host.lui-string: "${match[0]}" is not used as a class on this line; fine if it is a saved value or label, but check it is not applied to an element`);
        continue;
      }
      if (d.id === "css.less" || d.id.startsWith("lib.require")) {
        if (d.id === "css.less") add("fail", where(line), `LESS syntax in a build that has no LESS pipeline (${d.to})`);
        else add("fail", where(line), `${d.id}: ${d.to}`);
        continue;
      }
      if (d.id.startsWith("lib.")) {
        add("fail", where(line), `${d.id} used but not a declared dependency, so it would be resolved from the host page`);
      } else if (REVIEW_AS_WARN.has(d.id)) {
        add("warn", where(line), `${d.id}: ${d.to}`);
      } else if (allowShim && /^(?:dom\.\$element|backendApi\.|ctx\.selectValues)/.test(d.id)) {
        add("warn", where(line), `${d.id}: legacy name supplied by compat-shim.js; replace it in stage 2`);
      } else if (FAIL_PREFIXES.some((p) => d.id.startsWith(p))) {
        add("fail", where(line), `${d.id}: ${d.to}`);
      }
    }
  }

  if (kind === "js") {
    // AMD in source means it was not converted to ES modules.
    for (const { line } of matchAll(text, /(?<![.\w])define\s*\(\s*(?:['"][^'"]*['"]\s*,\s*)?\[/)) {
      add("fail", where(line), "AMD define([...]) in source; convert to an ES module");
    }
    // Every bare import must be a declared dependency, otherwise it is resolved from the host.
    const specs = [
      ...text.matchAll(/\bimport\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]/g),
      ...text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
      ...text.matchAll(/(?<![.\w])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ];
    for (const m of specs) {
      const spec = m[1];
      if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("node:") || /^(?:data|https?):/.test(spec)) continue;
      if (/^(?:text|css)!/.test(spec)) {
        add("fail", where(0), `RequireJS plugin import "${spec}"`);
        continue;
      }
      const pkgName = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
      if (BUILTINS.has(pkgName) || BUILTINS.has(spec)) {
        add("warn", where(0), `Node built-in "${spec}" imported; fine in build tooling, not available in a browser extension`);
      } else if (!fileDeclared.has(pkgName) && fileDeclared.size) {
        add("fail", where(0), `import "${spec}" is not declared in package.json; it would be resolved from the host page`);
      }
    }
    // The only host-provided objects are on `galaxy`, and they only exist inside Sense.
    text.split("\n").forEach((lineText, i) => {
      if (!/\bsense\s*\.\s*(?:theme|navigation|isUnsupportedFeature)\b|\banything\s*\.\s*sense\s*\.\s*\w/.test(lineText)) return;
      if (/\?\./.test(lineText) || /&&|\bif\s*\(|\?\s*\S+\s*:/.test(lineText)) return;
      add("warn", where(i + 1), "galaxy.anything.sense is undefined outside Qlik Sense; guard with `?.` or a check");
    });
  }
}
if (!scanned) add("warn", srcRoot, "no source files found to scan");

// ---- built bundle scan --------------------------------------------------------------
const ALLOWED_AMD = (dep) => dep === "@nebula.js/stardust" || dep.startsWith(".") || ["module", "exports", "require"].includes(dep);
const FORBIDDEN_STRINGS = [
  [/\bqvangular\b/, "references qvangular (internal host module)"],
  [/autogenerated\/(?:qix|qvangular)/, "references an autogenerated host module"],
  [/\bwindow\s*\.\s*qlik\b/, "uses the global qlik object"],
];
let bundleFiles = 0;
if (bundleDir) {
  if (!existsSync(bundleDir) || !statSync(bundleDir).isDirectory()) {
    add("fail", bundleDir, "bundle directory does not exist; run `npm run build` then `nebula sense`");
  } else {
    for (const f of walk(bundleDir, { skipDirs: new Set() })) {
      if (!/\.js$/i.test(f.rel)) continue;
      bundleFiles++;
      const text = stripJsComments(readText(f.abs));
      for (const m of text.matchAll(/\bdefine\s*\(\s*(?:["'][^"']*["']\s*,\s*)?\[([^\]]*)\]/g)) {
        for (const d of [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1])) {
          if (!ALLOWED_AMD(d)) add("fail", `${bundleDir}/${f.rel}`, `AMD dependency "${d}" would be provided by the host page; bundle it instead`);
        }
      }
      for (const [re, msg] of FORBIDDEN_STRINGS) {
        if (re.test(text)) add("fail", `${bundleDir}/${f.rel}`, msg);
      }
    }
    if (!bundleFiles) add("warn", bundleDir, "no .js files found in the bundle directory");
  }
}

// ---- report -------------------------------------------------------------------------------
const seen = new Set();
const unique = results.filter((r) => {
  const k = `${r.level}|${r.where}|${r.msg}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
const fails = unique.filter((r) => r.level === "fail");
const warns = unique.filter((r) => r.level === "warn");
for (const r of fails) console.log(`FAIL  ${r.where}  ${r.msg}`);
for (const r of warns) console.log(`warn  ${r.where}  ${r.msg}`);
console.log(`\nhost-API check: ${scanned} source files${bundleDir ? `, ${bundleFiles} bundle files` : ""} scanned; ${fails.length} failure(s), ${warns.length} warning(s)`);
console.log("This is a static check. It cannot see dynamically built code; confirm in the host that the extension renders.");
exit(fails.length ? 1 : 0);
