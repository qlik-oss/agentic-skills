import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { ROOT } from "../lib/reporter.mjs";
import { PLUGIN_SCHEMA, validateClaudePlugins, validatePortablePlugins } from "../lib/plugin-validation.mjs";
import { validateSkills } from "../validate-skill-spec.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "qlik-packages-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q"], { cwd: root });
  const write = (path, value) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), typeof value === "string" ? value : JSON.stringify(value));
  };
  const skill = (dir, name) => write(`${dir}/${name}/SKILL.md`, `---\nname: ${name}\ndescription: A test workflow.\nlicense: Apache-2.0\nmetadata:\n  author: fixture\n  version: 1.0.0\n---\nInstructions.\n`);
  const plugins = [];
  const codex = [];
  write("LICENSE", "Fixture licence.\n");
  write("NOTICE", "Fixture attribution.\n");
  const categories = [
    { label: "analytics", plugin: "qlik-analytics" },
    { label: "automation", plugin: "qlik-automate" },
    { label: "answers" },
  ];
  for (const { label, plugin } of categories) {
    const dir = `${label}/skills`;
    skill(dir, `test-${label}`);
    if (!plugin) continue;
    const common = { name: plugin, version: "1.0.0", description: "A test package.", author: { name: "Test" } };
    write(`${label}/plugin.json`, { $schema: PLUGIN_SCHEMA, ...common, keywords: ["test"] });
    write(`${label}/.claude-plugin/plugin.json`, common);
    write(`${label}/LICENSE`, "Fixture licence.\n");
    write(`${label}/NOTICE`, "Fixture attribution.\n");
    plugins.push({ name: plugin, source: `./${label}/`, description: common.description });
    codex.push({ name: plugin, source: { source: "local", path: `./${label}` }, policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" }, category: "Productivity" });
  }
  for (const name of ["qlik-cloud-skills", "qlik-cloud-community-skills"]) {
    plugins.push({ name, source: "./", version: "1.0.0", description: "Legacy selection.", strict: false, skills: ["./analytics/skills/test-analytics/"] });
  }
  const marketplace = { name: "qlik-cloud-skills", description: "Test catalogue.", plugins };
  const save = () => write(".claude-plugin/marketplace.json", marketplace);
  save();
  write(".agents/plugins/marketplace.json", { name: "qlik-task-skills", plugins: codex });
  const spec = () => {
    const errors = [];
    validateSkills(root, { fail: (e) => errors.push(e), warn: () => {}, relPath: (p) => relative(root, p) });
    return errors;
  };
  return { root, write, skill, marketplace, save, spec };
}

test("area packages share content; explicit overlapping legacy selections are allowed", (t) => {
  const f = fixture(t);
  assert.deepEqual(validatePortablePlugins(f.root).errors, []);
  assert.deepEqual(validateClaudePlugins(f.root).errors, []);
  assert.deepEqual(f.spec(), []);
});

test("portable and Claude identities cannot drift", (t) => {
  const f = fixture(t);
  f.write("analytics/.claude-plugin/plugin.json", { name: "wrong", version: "2.0.0", description: "A test package." });
  assert.ok(validatePortablePlugins(f.root).errors.some((e) => e.includes("name differs")));
  assert.ok(validatePortablePlugins(f.root).errors.some((e) => e.includes("version differs")));
  assert.ok(validateClaudePlugins(f.root).errors.some((e) => e.includes("name differs")));
});

test("a package with no installed skills fails", (t) => {
  const f = fixture(t);
  rmSync(join(f.root, "automation/skills/test-automation"), { recursive: true });
  assert.ok(validatePortablePlugins(f.root).errors.some((e) => e.includes("package must contain skills")));
});

test("standalone packages must retain licence and attribution notices", (t) => {
  const f = fixture(t);
  rmSync(join(f.root, "automation/NOTICE"));
  assert.ok(validatePortablePlugins(f.root).errors.some((e) => e.includes("include the repository NOTICE")));
});

test("Codex catalogue cannot publish Answers or legacy repository-root selections", (t) => {
  const f = fixture(t);
  f.write(".agents/plugins/marketplace.json", { name: "qlik-task-skills", plugins: [{ name: "answers", source: { source: "local", path: "./answers" } }] });
  assert.ok(validatePortablePlugins(f.root).errors.some((e) => e.includes("select only discovered category plugins")));
});

test("portable manifests require the correct format and reject compatibility-only skill paths", (t) => {
  const f = fixture(t);
  const path = "analytics/plugin.json";
  const manifest = JSON.parse(readFileSync(join(f.root, path)));
  manifest.$schema = "https://example.com/other";
  manifest.skills = "../automation/skills";
  f.write(path, manifest);
  const errors = validatePortablePlugins(f.root).errors;
  assert.ok(errors.some((e) => e.includes("declare Agent Plugins")));
  assert.ok(errors.some((e) => e.includes("skills is not a portable")));
});

for (const selection of ["./answers/skills/test-answers/", "./analytics/skills/", "./analytics/skills/missing/", "../outside/"]) {
  test(`legacy selection rejects ${selection}`, (t) => {
    const f = fixture(t);
    f.marketplace.plugins.at(-1).skills = [selection];
    f.save();
    assert.ok(validateClaudePlugins(f.root).errors.length > 0);
  });
}

test("duplicate selected skills fail, including alternate spellings of the same path", (t) => {
  const f = fixture(t);
  f.marketplace.plugins.at(-1).skills.push("./analytics/skills/test-analytics/./");
  f.save();
  assert.ok(validateClaudePlugins(f.root).errors.some((e) => e.includes("duplicate selected skill")));
});

test("a legacy bundle cannot fall back to scanning the repository", (t) => {
  const f = fixture(t);
  delete f.marketplace.plugins.at(-1).skills;
  f.save();
  assert.ok(validateClaudePlugins(f.root).errors.some((e) => e.includes("explicit skill selection")));
});

test("marketplace must expose each area and retain legacy identities", (t) => {
  const f = fixture(t);
  f.marketplace.plugins = f.marketplace.plugins.slice(1, -1);
  f.save();
  const errors = validateClaudePlugins(f.root).errors;
  assert.ok(errors.some((e) => e.includes("missing plugin qlik-analytics")));
  assert.ok(errors.some((e) => e.includes("missing plugin qlik-cloud-community-skills")));
});

test("catalogue source cannot escape via a symlink", (t) => {
  const f = fixture(t);
  symlinkSync(tmpdir(), join(f.root, "outside"));
  f.marketplace.plugins[0].source = "./outside/";
  f.save();
  assert.ok(validateClaudePlugins(f.root).errors.some((e) => e.includes("outside package")));
});

test("global skill names cannot collide between areas or with Answers", (t) => {
  const f = fixture(t);
  f.skill("answers/skills", "test-analytics");
  assert.ok(f.spec().some((e) => e.includes("already used by another canonical skill")));
});

test("misplaced and nested skills are rejected; template and ignored copies are excluded", (t) => {
  const f = fixture(t);
  f.skill("outside", "misplaced");
  f.skill("analytics/skills/nested/skills", "nested");
  f.write("template/skill/SKILL.md", "Template placeholder.");
  f.write(".gitignore", "dist/\n");
  f.skill("dist/package/skills", "generated");
  const errors = f.spec();
  assert.equal(errors.length, 2);
  assert.ok(errors.every((e) => e.includes("expected <category>/skills/<skill>/SKILL.md")));
});

test("an ignored package root with skills/ directly beneath it is not a category", (t) => {
  const f = fixture(t);
  f.write(".gitignore", "dist/\nanalytics/skills/scratch/\n");
  // Same name as a canonical skill: would collide if discovered.
  f.skill("dist/skills", "test-analytics");
  f.skill("analytics/skills", "scratch");
  assert.deepEqual(f.spec(), []);
  assert.deepEqual(validatePortablePlugins(f.root).errors, []);
  assert.deepEqual(validateClaudePlugins(f.root).errors, []);
});

test("real legacy bundles retain exactly the pre-migration skill membership", () => {
  const { plugins } = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/marketplace.json")));
  const membership = (name) => plugins.find((p) => p.name === name).skills.map((p) => p.split("/").filter(Boolean).at(-1)).sort();
  assert.deepEqual(membership("qlik-cloud-skills"), [
    "qlik-ai-readiness-optimizer", "qlik-automation-builder", "qlik-data-analyst", "qlik-embed", "qlik-extension-nebula-migration",
  ]);
  assert.deepEqual(membership("qlik-cloud-community-skills"), ["qlik-load-script", "qlik-sense-app-analysis", "qlik-talk-to-data"]);
});

test("a new category is discovered without changing validator code", (t) => {
  const f = fixture(t);
  const folder = "data-quality";
  const name = "qlik-quality"; // Identity need not match the category's folder.
  f.skill(`${folder}/skills`, "quality-check");
  assert.deepEqual(f.spec(), []);
  assert.ok(validatePortablePlugins(f.root).errors.some((e) => e.includes("data-quality/plugin.json")));
  const common = { name, version: "1.0.0", description: "Check data quality.", author: { name: "Test" } };
  f.write(`${folder}/plugin.json`, { $schema: PLUGIN_SCHEMA, ...common, keywords: ["quality"] });
  f.write(`${folder}/.claude-plugin/plugin.json`, common);
  f.write(`${folder}/LICENSE`, "Fixture licence.\n");
  f.write(`${folder}/NOTICE`, "Fixture attribution.\n");
  assert.ok(validateClaudePlugins(f.root).errors.some((e) => e.includes(`missing plugin ${name}`)));
  assert.ok(validatePortablePlugins(f.root).errors.some((e) => e.includes(`missing plugin ${name}`)));
  f.marketplace.plugins.push({ name, description: common.description, source: `./${folder}/` });
  f.save();
  const codex = JSON.parse(readFileSync(join(f.root, ".agents/plugins/marketplace.json")));
  codex.plugins.push({ name, source: { source: "local", path: `./${folder}` }, policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" }, category: "Data & Analytics" });
  f.write(".agents/plugins/marketplace.json", codex);
  assert.deepEqual(validatePortablePlugins(f.root).errors, []);
  assert.deepEqual(validateClaudePlugins(f.root).errors, []);
});

test("discovering categories does not admit duplicate plugin identities", (t) => {
  const f = fixture(t);
  f.write("new-area/plugin.json", JSON.parse(readFileSync(join(f.root, "analytics/plugin.json"))));
  assert.ok(validatePortablePlugins(f.root).errors.some((e) => e.includes("duplicate plugin identity")));
});
