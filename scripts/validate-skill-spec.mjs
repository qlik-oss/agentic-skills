#!/usr/bin/env node
// Validates every SKILL.md against spec/README.md.
// Destination-agnostic — one check covers Claude, Codex, Copilot, Cursor,
// Gemini CLI, and the rest. Claude's plugin marketplace is checked
// separately in validate-claude-plugin.mjs.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { ROOT, createReporter } from "./lib/reporter.mjs";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

const TIERS = [
  { label: "official", skillsDir: join(ROOT, "official", "skills") },
  { label: "community", skillsDir: join(ROOT, "community", "skills") },
];

function validateSkillMd(skillMdPath, folderName, { fail, warn, relPath }, seenNamesInTier) {
  const label = relPath(skillMdPath);
  const raw = readFileSync(skillMdPath, "utf8");

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    fail(`${label}: missing YAML frontmatter`);
    return;
  }

  let frontmatter;
  try {
    frontmatter = yaml.load(match[1]) || {};
  } catch (e) {
    fail(`${label}: invalid YAML frontmatter — ${e.message}`);
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
    if (seenNamesInTier.has(frontmatter.name)) {
      fail(`${label}: skill name "${frontmatter.name}" is already used by another skill in this tier`);
    }
    seenNamesInTier.add(frontmatter.name);
  }

  if (frontmatter.description && frontmatter.description.length > 1024) {
    fail(`${label}: description exceeds 1024 characters (${frontmatter.description.length})`);
  }

  const lineCount = raw.split("\n").length;
  if (lineCount > 500) {
    warn(`${label}: SKILL.md is ${lineCount} lines, exceeds the 500-line guideline`);
  }
}

function main() {
  const ctx = createReporter();
  for (const { label, skillsDir } of TIERS) {
    if (!existsSync(skillsDir)) continue;

    const seenNamesInTier = new Set();
    const folders = readdirSync(skillsDir).filter((e) => statSync(join(skillsDir, e)).isDirectory());
    for (const folder of folders) {
      const skillMdPath = join(skillsDir, folder, "SKILL.md");
      if (!existsSync(skillMdPath)) continue; // supporting folder, not an installable skill
      validateSkillMd(skillMdPath, folder, ctx, seenNamesInTier);
    }
    if (folders.length && seenNamesInTier.size === 0) {
      ctx.warn(`${label}/skills has no skills yet`);
    }
  }
  ctx.report();
}

main();
