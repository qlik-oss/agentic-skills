import { load as loadYaml } from "js-yaml";

export const SEMVER_RE = /^\d+\.\d+\.\d+$/;

const FRONTMATTER_RE = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export function parseFrontmatter(raw) {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) throw new Error("missing YAML frontmatter");
  try {
    return loadYaml(match[1]) || {};
  } catch (e) {
    throw new Error(`invalid YAML frontmatter — ${e.message}`);
  }
}
