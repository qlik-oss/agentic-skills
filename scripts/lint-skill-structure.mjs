#!/usr/bin/env node
/**
 * Structural checks from the Agent Skills best-practices guide that claudelint
 * does not cover:
 *   - nested-reference:  SKILL.md -> a.md -> b.md (keep references one level deep)
 *   - missing-toc:       reference file over 100 lines without a table of contents
 *   - backslash-path:    Windows-style path (use forward slashes)
 *
 * Usage: node scripts/lint-skill-structure.mjs [skill-dir ...]
 *        (default: every directory in the repo that contains a SKILL.md)
 * Exits 1 when findings exist; prints GitHub Actions annotations.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TOC_LINE_LIMIT = 100;
const LINK_RE = /\[[^\]]*\]\(([^)\s#]+)(?:#[^)]*)?\)/g;
const BACKSLASH_PATH_RE = /\b[\w.-]+(?:\\[\w.-]+)+\.(?:md|py|sh|js|mjs|ts|json|ya?ml|txt|csv)\b/;

const stripCodeBlocks = (text) => text.replace(/^(```|~~~)[\s\S]*?^\1/gm, "");

function localMarkdownLinks(file, text) {
  const links = new Set();
  for (const m of stripCodeBlocks(text).matchAll(LINK_RE)) {
    const target = m[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || !target.toLowerCase().endsWith(".md")) continue;
    const abs = normalize(join(dirname(file), target));
    if (existsSync(abs)) links.add(abs);
  }
  return links;
}

function stripFrontmatter(text) {
  return text.startsWith("---\n") ? text.replace(/^---\n[\s\S]*?\n---\n/, "") : text;
}

function hasToc(text) {
  const head = stripFrontmatter(text).split("\n").slice(0, 40).join("\n");
  return /^#{1,6}\s*(table of )?contents\b/im.test(head) || /^\*{0,2}(table of )?contents\*{0,2}:?\s*$/im.test(head);
}

export function lintSkill(skillDir) {
  const findings = [];
  const skillFile = join(skillDir, "SKILL.md");
  if (!existsSync(skillFile)) return findings;
  const add = (file, rule, message) => findings.push({ file: relative(process.cwd(), file), rule, message });

  const direct = localMarkdownLinks(skillFile, readFileSync(skillFile, "utf8"));
  for (const ref of direct) {
    for (const nested of localMarkdownLinks(ref, readFileSync(ref, "utf8"))) {
      if (nested === skillFile || direct.has(nested)) continue;
      add(ref, "nested-reference", `links to ${relative(skillDir, nested)}; link it from SKILL.md instead so references stay one level deep`);
    }
  }

  for (const file of walkMarkdown(skillDir)) {
    const text = readFileSync(file, "utf8");
    if (file !== skillFile && text.split("\n").length > TOC_LINE_LIMIT && !hasToc(text)) {
      add(file, "missing-toc", `over ${TOC_LINE_LIMIT} lines without a table of contents`);
    }
    const bad = BACKSLASH_PATH_RE.exec(text);
    if (bad) add(file, "backslash-path", `Windows-style path "${bad[0]}"; use forward slashes`);
  }
  return findings;
}

function* walkMarkdown(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walkMarkdown(p);
    else if (entry.toLowerCase().endsWith(".md")) yield p;
  }
}

const SKIP_DIRS = new Set([".git", "node_modules"]);

function* walkSkillDirs(dir) {
  if (existsSync(join(dir, "SKILL.md"))) yield dir;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) yield* walkSkillDirs(join(dir, entry.name));
  }
}

function main() {
  const args = process.argv.slice(2);
  const dirs = args.length
    ? args.map((a) => resolve(a))
    : [...walkSkillDirs(resolve("."))];
  const findings = dirs.flatMap(lintSkill);
  for (const f of findings) console.log(`::warning file=${f.file}::${f.rule}: ${f.message}`);
  console.log(findings.length ? `${findings.length} finding(s) in ${dirs.length} skill(s)` : `✓ ${dirs.length} skill(s) clean`);
  process.exit(findings.length ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
