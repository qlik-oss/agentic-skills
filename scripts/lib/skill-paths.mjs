import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const CATEGORY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Every category has the same layout. Answers uses a separate runtime, while
// template/ is authoring material rather than a published category.
// Discovery reads Git's tracked/non-ignored inventory, so ignored build output
// (for example dist/skills/) is never treated as a category or a skill.
export function discoverCategories(root, files = repositoryFiles(root)) {
  const present = files.filter((path) => existsSync(join(root, path)));
  const names = new Set();
  for (const path of present) {
    const [name, ...rest] = path.split("/");
    const tail = rest.join("/");
    if (!CATEGORY_RE.test(name) || name === "template") continue;
    if (tail.startsWith("skills/") || tail === "plugin.json" || tail === ".claude-plugin/plugin.json") names.add(name);
  }
  return [...names]
    .map((name) => ({ label: name, dir: `${name}/skills` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Skill folder names directly under a category's skills/ directory whose
// SKILL.md is tracked or untracked-but-not-ignored.
export function listSkills(root, dir, files = repositoryFiles(root)) {
  const prefix = `${dir}/`;
  const names = new Set();
  for (const path of files) {
    if (!path.startsWith(prefix)) continue;
    const parts = path.slice(prefix.length).split("/");
    if (parts.length === 2 && parts[1] === "SKILL.md" && existsSync(join(root, path))) names.add(parts[0]);
  }
  return [...names].sort();
}

// Pure path matching also works against historical categories that no longer
// exist in the working tree, including the old official/community layout.
export function skillDirOf(path) {
  const match = path.match(/^([^/]+)\/skills\/([^/]+)\/.+/);
  if (!match || !CATEGORY_RE.test(match[1]) || match[1] === "template") return null;
  return `${match[1]}/skills/${match[2]}`;
}

export function repositoryFiles(root, revision = null) {
  const args = revision === null
    ? ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]
    : ["ls-tree", "-r", "--name-only", "-z", revision];
  return [...new Set(execFileSync("git", args, {
    cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  }).split("\0").filter(Boolean))];
}
