#!/usr/bin/env node
// Validates every SKILL.md against spec/README.md.
// Destination-agnostic — one check covers Claude, Codex, Copilot, Cursor,
// Gemini CLI, and the rest. Claude's plugin marketplace is checked
// separately in validate-claude-plugin.mjs.
import { readFileSync, existsSync, readdirSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { ROOT, createReporter } from "./lib/reporter.mjs";
import { SEMVER_RE, parseFrontmatter } from "./lib/skill-frontmatter.mjs";

import { discoverCategories, repositoryFiles, skillDirOf } from "./lib/skill-paths.mjs";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateSkillMd(skillMdPath, folderName, { fail, warn, relPath }, seenNames) {
  const label = relPath(skillMdPath);
  const raw = readFileSync(skillMdPath, "utf8");

  let frontmatter;
  try {
    frontmatter = parseFrontmatter(raw);
  } catch (e) {
    fail(`${label}: ${e.message}`);
    return;
  }

  for (const field of ["name", "description", "license"]) {
    if (!frontmatter[field]) fail(`${label}: missing required frontmatter field "${field}"`);
  }
  if (!frontmatter.metadata?.author) fail(`${label}: missing required frontmatter field "metadata.author"`);
  if (!frontmatter.metadata?.version) {
    fail(`${label}: missing required frontmatter field "metadata.version"`);
  } else if (!SEMVER_RE.test(String(frontmatter.metadata.version))) {
    fail(`${label}: metadata.version "${frontmatter.metadata.version}" is not valid semver (expected x.y.z)`);
  }

  if (frontmatter.name) {
    if (!NAME_RE.test(frontmatter.name)) {
      fail(`${label}: name "${frontmatter.name}" must be lowercase alphanumeric with hyphens only`);
    }
    if (frontmatter.name !== folderName) {
      fail(`${label}: frontmatter name "${frontmatter.name}" does not match folder name "${folderName}"`);
    }
    if (seenNames.has(frontmatter.name)) {
      fail(`${label}: skill name "${frontmatter.name}" is already used by another canonical skill`);
    }
    seenNames.add(frontmatter.name);
  }

  const desc = frontmatter.description;
  if (desc != null) {
    if (typeof desc !== "string") {
      fail(`${label}: frontmatter field "description" must be a string`);
    } else if (desc.length > 1024) {
      fail(`${label}: description exceeds 1024 characters (${desc.length})`);
    }
  }

  const lineCount = raw.split("\n").length;
  if (lineCount > 500) {
    warn(`${label}: SKILL.md is ${lineCount} lines, exceeds the 500-line guideline`);
  }
}

export function validateSkills(root, ctx) {
  const seenNames = new Set();
  const discovered = new Set();
  for (const { label, dir } of discoverCategories(root)) {
    const skillsDir = join(root, dir);
    if (!existsSync(skillsDir)) continue;

    const folders = readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const folder of folders) {
      const skillMdPath = join(skillsDir, folder, "SKILL.md");
      if (!existsSync(skillMdPath)) continue; // supporting folder, not an installable skill
      discovered.add(`${dir}/${folder}/SKILL.md`);
      validateSkillMd(skillMdPath, folder, ctx, seenNames);
    }
    if (folders.length && !folders.some((folder) => existsSync(join(skillsDir, folder, "SKILL.md")))) {
      ctx.warn(`${label}/skills has no skills yet`);
    }
  }
  // Use Git's tracked/non-ignored inventory rather than traversing caches,
  // dependencies or another checkout. Deleted paths are not source files.
  const paths = repositoryFiles(root);
  for (const path of new Set(paths)) {
    if (!path.endsWith("/SKILL.md") && path !== "SKILL.md") continue;
    if (!existsSync(join(root, path)) || path === "template/skill/SKILL.md") continue;
    if (!discovered.has(path) || `${skillDirOf(path)}/SKILL.md` !== path) ctx.fail(`${path}: expected <category>/skills/<skill>/SKILL.md`);
  }
}

function main() {
  const ctx = createReporter();
  validateSkills(ROOT, ctx);
  ctx.report();
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main();
