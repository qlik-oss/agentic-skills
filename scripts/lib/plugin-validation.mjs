// Repository packaging checks, not a substitute for each host's loader.
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { SEMVER_RE } from "./skill-frontmatter.mjs";

import { discoverCategories, listSkills, repositoryFiles } from "./skill-paths.mjs";

export const PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";

const LEGACY_NAMES = new Set(["qlik-cloud-skills", "qlik-cloud-community-skills"]);
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readJSON(root, path, errors) {
  try {
    const value = JSON.parse(readFileSync(join(root, path), "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected an object");
    return value;
  } catch (e) {
    errors.push(`${path}: ${e.message}`);
    return null;
  }
}

function discoverPluginRoots(root, errors, files) {
  const seen = new Set();
  return discoverCategories(root, files).filter(({ label }) => label !== "answers").flatMap((area) => {
    const manifest = readJSON(root, `${area.label}/plugin.json`, errors);
    if (!manifest) return [];
    if (seen.has(manifest.name)) errors.push(`duplicate plugin identity ${manifest.name}`);
    seen.add(manifest.name);
    return [{ ...area, plugin: manifest.name }];
  });
}

function identity(manifest, path, errors) {
  for (const field of ["name", "description", "version"]) {
    if (typeof manifest[field] !== "string" || !manifest[field].trim()) errors.push(`${path}: ${field} must be a nonempty string`);
  }
  if (typeof manifest.name === "string" && (!NAME_RE.test(manifest.name) || manifest.name.length > 64)) errors.push(`${path}: invalid plugin name`);
  if (!SEMVER_RE.test(manifest.version ?? "")) errors.push(`${path}: version must be x.y.z`);
}

function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep));
}

function directory(root, path, errors, label) {
  if (typeof path !== "string" || !path.startsWith("./") || path.split(/[\\/]/).includes("..")) {
    errors.push(`${label}: use a ./ path inside the package`);
    return null;
  }
  const abs = resolve(root, path);
  if (!existsSync(abs) || !statSync(abs).isDirectory() || !isInside(realpathSync(root), realpathSync(abs))) {
    errors.push(`${label}: missing directory or path outside package: ${path}`);
    return null;
  }
  return abs;
}

export function validatePortablePlugins(root) {
  const errors = [];
  const files = repositoryFiles(root);
  const pluginRoots = discoverPluginRoots(root, errors, files);
  for (const { dir } of pluginRoots) {
    const area = dirname(dir);
    const path = `${area}/plugin.json`;
    const manifest = readJSON(root, path, errors);
    if (!manifest) continue;
    for (const notice of ["LICENSE", "NOTICE"]) {
      const packaged = join(root, area, notice);
      if (!existsSync(packaged) || readFileSync(packaged, "utf8") !== readFileSync(join(root, notice), "utf8")) errors.push(`${path}: include the repository ${notice} unchanged`);
    }
    identity(manifest, path, errors);
    if (manifest.$schema !== PLUGIN_SCHEMA) errors.push(`${path}: declare Agent Plugins 1.0.0 schema`);
    if (typeof manifest.author?.name !== "string" || !manifest.author.name.trim()) errors.push(`${path}: author.name is required`);
    if (!Array.isArray(manifest.keywords) || !manifest.keywords.length || manifest.keywords.some((k) => typeof k !== "string" || !k.trim())) errors.push(`${path}: keywords must be nonempty strings`);
    for (const key of ["skills", "mcpServers", "apps", "interface"]) {
      if (key in manifest) errors.push(`${path}: ${key} is not a portable top-level field`);
    }
    const skills = directory(join(root, area), "./skills/", errors, path);
    if (skills) {
      const names = listSkills(root, dir, files);
      if (!names.length) errors.push(`${path}: package must contain skills`);
      for (const name of names) directory(join(root, area), `./skills/${name}/`, errors, path);
    }
    const claude = readJSON(root, `${area}/.claude-plugin/plugin.json`, errors);
    if (claude) {
      for (const field of ["name", "version", "description"]) {
        if (manifest[field] !== claude[field]) errors.push(`${path}: ${field} differs from Claude manifest`);
      }
    }
  }
  const catalogue = readJSON(root, ".agents/plugins/marketplace.json", errors);
  if (catalogue) {
    if (catalogue.name !== "qlik-task-skills") errors.push("Codex marketplace: expected name qlik-task-skills");
    if (!Array.isArray(catalogue.plugins)) errors.push("Codex marketplace: plugins must be an array");
    else {
      const seen = new Set();
      for (const entry of catalogue.plugins) {
        const area = pluginRoots.find(({ plugin }) => plugin === entry?.name);
        if (!area) { errors.push("Codex marketplace: select only discovered category plugins"); continue; }
        if (seen.has(entry.name)) errors.push(`Codex marketplace: duplicate plugin ${entry.name}`);
        seen.add(entry.name);
        if (entry.source?.source !== "local" || entry.source.path !== `./${dirname(area.dir)}`) errors.push(`Codex marketplace: ${entry.name} must select its area folder`);
        if (entry.policy?.installation !== "AVAILABLE" || entry.policy?.authentication !== "ON_INSTALL") errors.push(`Codex marketplace: ${entry.name} must remain opt-in with explicit authentication policy`);
        // Codex documents category by example only, so require a value without fixing the list.
        if (typeof entry.category !== "string" || !entry.category.trim()) errors.push(`Codex marketplace: ${entry.name} needs a category`);
      }
      for (const { plugin } of pluginRoots) if (!seen.has(plugin)) errors.push(`Codex marketplace: missing plugin ${plugin}`);
    }
  }
  return { errors };
}

export function validateClaudePlugins(root) {
  const errors = [];
  const files = repositoryFiles(root);
  const pluginRoots = discoverPluginRoots(root, errors, files);
  const marketplace = readJSON(root, ".claude-plugin/marketplace.json", errors);
  if (!marketplace) return { errors };
  for (const field of ["name", "description"]) {
    if (typeof marketplace[field] !== "string" || !marketplace[field].trim()) errors.push(`marketplace: ${field} must be a nonempty string`);
  }
  if (!Array.isArray(marketplace.plugins)) return { errors: [...errors, "marketplace: plugins must be an array"] };
  const seen = new Set();
  const canonical = new Set();
  for (const { dir } of pluginRoots) {
    for (const name of listSkills(root, dir, files)) canonical.add(realpathSync(join(root, dir, name)));
  }
  for (const entry of marketplace.plugins) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) { errors.push("marketplace: plugin entry must be an object"); continue; }
    const label = `plugin ${entry.name ?? "<unnamed>"}`;
    if (seen.has(entry.name)) errors.push(`${label}: duplicate name`);
    seen.add(entry.name);
    if (typeof entry.description !== "string" || !entry.description.trim()) errors.push(`${label}: description is required`);
    const source = directory(root, entry.source, errors, label);
    if (!source) continue;
    if (LEGACY_NAMES.has(entry.name)) {
      identity(entry, label, errors);
      if (source !== resolve(root) || entry.strict !== false || existsSync(join(source, ".claude-plugin/plugin.json"))) errors.push(`${label}: legacy bundle must use the manifest-free repository root with strict: false`);
      if (!Array.isArray(entry.skills) || !entry.skills.length) { errors.push(`${label}: explicit skill selection is required`); continue; }
      const selected = new Set();
      for (const path of entry.skills) {
        const skill = directory(source, path, errors, label);
        if (!skill) continue;
        const resolved = realpathSync(skill);
        if (!canonical.has(resolved)) errors.push(`${label}: ${path} must select a canonical coding-agent skill directly`);
        if (selected.has(resolved)) errors.push(`${label}: duplicate selected skill ${path}`);
        selected.add(resolved);
      }
    } else {
      const area = pluginRoots.find(({ plugin }) => plugin === entry.name);
      if (!area) { errors.push(`${label}: source must belong to a discovered category plugin`); continue; }
      if (source !== resolve(root, dirname(area.dir))) errors.push(`${label}: source must be its canonical area folder`);
      if (entry.skills || entry.strict === false) errors.push(`${label}: area plugins must use their manifest and default skills/ folder`);
      const manifest = readJSON(root, `${dirname(area.dir)}/.claude-plugin/plugin.json`, errors);
      if (manifest) {
        identity(manifest, label, errors);
        if (manifest.name !== entry.name) errors.push(`${label}: name differs from its manifest`);
      }
    }
  }
  for (const name of [...pluginRoots.map(({ plugin }) => plugin), ...LEGACY_NAMES]) {
    if (!seen.has(name)) errors.push(`marketplace: missing plugin ${name}`);
  }
  return { errors };
}
