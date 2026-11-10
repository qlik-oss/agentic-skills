import { load as loadYaml } from "js-yaml";

export const SEMVER_RE = /^\d+\.\d+\.\d+$/;

// Installable skill tiers. template/ is a starter, not a published skill.
export const SKILL_TIERS = [
  { label: "official", dir: "official/skills" },
  { label: "community", dir: "community/skills" },
];

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
