import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CATEGORY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Every category has the same layout. Answers uses a separate runtime, while
// template/ is authoring material rather than a published category.
export function discoverCategories(root) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && CATEGORY_RE.test(entry.name) && entry.name !== "template")
    .filter(({ name }) => ["skills", "plugin.json", ".claude-plugin/plugin.json"].some((path) => existsSync(join(root, name, path))))
    .map(({ name }) => ({ label: name, dir: `${name}/skills` }))
    .sort((a, b) => a.label.localeCompare(b.label));
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
