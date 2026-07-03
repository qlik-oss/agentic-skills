#!/usr/bin/env node
// Validates .claude-plugin/marketplace.json and each plugin.json.
// Claude-only: the plugin marketplace layer is a Claude feature, not shared
// across destinations. SKILL.md frontmatter is checked separately in
// validate-skill-spec.mjs.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { ROOT, createReporter } from "./lib/reporter.mjs";

function readJSON(path, { fail, relPath }) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    fail(`${relPath(path)}: invalid JSON — ${e.message}`);
    return null;
  }
}

function validatePluginEntry(plugin, seenNames, ctx) {
  const { fail, warn, relPath } = ctx;
  const label = plugin?.name ?? "<unnamed plugin>";
  for (const field of ["name", "description", "source"]) {
    if (!plugin?.[field]) fail(`marketplace.json plugin "${label}": missing required field "${field}"`);
  }
  if (!plugin?.name || !plugin?.source) return;

  if (seenNames.has(plugin.name)) fail(`marketplace.json: duplicate plugin name "${plugin.name}"`);
  seenNames.add(plugin.name);

  if (typeof plugin.source !== "string") {
    fail(`marketplace.json plugin "${label}": "source" must be a string`);
    return;
  }

  const sourceDir = resolve(ROOT, plugin.source);
  const rel = relative(ROOT, sourceDir);
  if (rel.startsWith("..")) {
    fail(`plugin "${plugin.name}": source "${plugin.source}" resolves outside the repo root`);
    return;
  }
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    fail(`plugin "${plugin.name}": source directory "${plugin.source}" does not exist`);
    return;
  }

  const strict = plugin.strict !== false;
  const pluginJsonPath = join(sourceDir, ".claude-plugin", "plugin.json");
  const topLevelSkillPath = join(sourceDir, "SKILL.md");
  const hasPluginJson = existsSync(pluginJsonPath);
  const hasTopLevelSkill = existsSync(topLevelSkillPath);

  if (strict && !hasPluginJson && !hasTopLevelSkill) {
    fail(
      `plugin "${plugin.name}": strict mode requires "${relPath(pluginJsonPath)}" or a top-level SKILL.md ` +
        `under "${plugin.source}" (or set "strict": false on this marketplace entry)`
    );
  }

  if (hasPluginJson) {
    const manifest = readJSON(pluginJsonPath, ctx);
    if (manifest) {
      for (const field of ["name", "description"]) {
        if (!manifest[field]) fail(`${relPath(pluginJsonPath)}: missing required field "${field}"`);
      }
      if (manifest.name && manifest.name !== plugin.name) {
        warn(
          `${relPath(pluginJsonPath)}: name "${manifest.name}" does not match ` +
            `marketplace entry name "${plugin.name}"`
        );
      }
    }
  }
}

function main() {
  const ctx = createReporter();
  const { fail } = ctx;
  const marketplacePath = join(ROOT, ".claude-plugin", "marketplace.json");
  if (!existsSync(marketplacePath)) {
    fail(".claude-plugin/marketplace.json is missing");
    return ctx.report();
  }

  const marketplace = readJSON(marketplacePath, ctx);
  if (marketplace) {
    for (const field of ["name", "description", "plugins"]) {
      if (!(field in marketplace)) fail(`.claude-plugin/marketplace.json: missing required field "${field}"`);
    }
    if (marketplace.plugins && !Array.isArray(marketplace.plugins)) {
      fail(`.claude-plugin/marketplace.json: "plugins" must be an array`);
    } else if (Array.isArray(marketplace.plugins)) {
      const seenNames = new Set();
      for (const plugin of marketplace.plugins) validatePluginEntry(plugin, seenNames, ctx);
    }
  }

  ctx.report();
}

main();
