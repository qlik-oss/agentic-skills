// Shared helpers for the migration scripts. Local, read-only: no network, no writes.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";

export const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".nyc_output", "test-results"]);
export const JS_EXT = new Set([".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"]);
export const HTML_EXT = new Set([".html", ".htm"]);
export const CSS_EXT = new Set([".css", ".less", ".scss", ".sass"]);
export const VENDORED_BYTES = 200 * 1024;

/** Recursively list files under root. Returns [{ abs, rel, size }]. */
export function walk(root, { skipDirs = SKIP_DIRS } = {}) {
  const out = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) visit(join(dir, entry.name));
      } else if (entry.isFile()) {
        const abs = join(dir, entry.name);
        out.push({ abs, rel: relative(root, abs), size: statSync(abs).size });
      }
    }
  };
  visit(root);
  return out;
}

export const readText = (abs) => readFileSync(abs, "utf8");

export function kindOf(rel) {
  const ext = extname(rel).toLowerCase();
  if (JS_EXT.has(ext)) return "js";
  if (HTML_EXT.has(ext)) return "html";
  if (CSS_EXT.has(ext)) return "css";
  if (ext === ".qext") return "qext";
  if (ext === ".json") return "json";
  if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp"].includes(ext)) return "image";
  return "other";
}

export const isMinified = (rel) => /\.min\.(js|css)$/i.test(rel);

/**
 * Replace comments with spaces (newlines kept) so line numbers survive and
 * commented-out code is not reported. Tracks quotes so `//` inside a string
 * (for example a URL) is kept. Regex literals are not parsed: a quote inside a
 * regex literal can confuse the scanner, so single/double-quoted strings are
 * reset at end of line.
 */
export function stripJsComments(src) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += n ?? "";
        i += 2;
        continue;
      }
      if (c === quote || (c === "\n" && quote !== "`")) quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      out += c;
      i++;
    } else if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") {
        out += " ";
        i++;
      }
    } else if (c === "/" && n === "*") {
      out += "  ";
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += "  ";
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * Blank the contents of string and template literals (quotes kept, newlines kept) so rules that look
 * for CODE (jQuery calls, $scope, ...) do not fire on text inside strings, such as Qlik's `$(vVar)`
 * variable expansion or a UI label. Expects comments to be stripped already.
 */
/** `a?.b` -> `a .b` (same length), so rules written for `a.b` also match optional chaining. */
export function normalizeOptionalChaining(src) {
  return src.replace(/\?\.(?=[A-Za-z_$])/g, " .");
}

export function blankJsStrings(src) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      if (c === "\\") {
        out += "  ";
        i += 2;
        continue;
      }
      if (c === quote || (c === "\n" && quote !== "`")) {
        quote = null;
        out += c;
      } else {
        out += c === "\n" ? "\n" : " ";
      }
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") quote = c;
    out += c;
    i++;
  }
  return out;
}

export function stripCssComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** Line number (1-based) of a character offset. */
export function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Run a global regex over text and yield { match, line }. */
export function* matchAll(text, re) {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m;
  let line = 1;
  let last = 0;
  while ((m = g.exec(text))) {
    for (let i = last; i < m.index; i++) if (text.charCodeAt(i) === 10) line++;
    last = m.index;
    yield { match: m, line };
    if (m[0].length === 0) g.lastIndex++;
  }
}

/**
 * Extract the dependency array of the first AMD `define([...], ...)` call.
 * Returns null when the file has no array-form define.
 */
export function amdDependencies(strippedJs) {
  const m = /\bdefine\s*\(\s*(?:['"][^'"]*['"]\s*,\s*)?\[([^\]]*)\]/.exec(strippedJs);
  if (!m) return null;
  return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
}

/** Package name -> the last path segment, which is what `nebula sense` uses. */
export function lastSegment(name) {
  return String(name ?? "").split("/").reverse()[0];
}

export { basename, join, relative, extname };
