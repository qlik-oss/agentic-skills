#!/usr/bin/env node
// Checks that every skill changed between two revisions has a higher
// metadata.version at the head revision than at the base revision.
//
// - Any file inside a skill folder counts as a change, not just SKILL.md.
// - Any increase is accepted (patch, minor, or major); unchanged or lower fails.
// - Each changed skill is checked on its own, so one PR can touch several.
// - New and fully deleted skills are exempt. template/ is not versioned.
// - Rollbacks roll forward: revert the content, but still bump the version.
//
// Usage:
//   node scripts/validate-skill-versions.mjs                       # working tree vs merge base with origin/main
//   node scripts/validate-skill-versions.mjs --base <rev> --head <rev>
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, createReporter } from "./lib/reporter.mjs";
import { SEMVER_RE, SKILL_TIERS, parseFrontmatter } from "./lib/skill-frontmatter.mjs";

const MAX_LISTED_FILES = 10;

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function verifyRevision(cwd, rev) {
  try {
    return git(cwd, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]).trim();
  } catch {
    throw new Error(`unknown revision "${rev}" — fetch more history or pass a valid --base/--head`);
  }
}

// Maps a repo-relative path to its skill folder, e.g.
// community/skills/foo/references/a.md -> community/skills/foo.
// Files directly in a tier folder (like its README) belong to no skill.
export function skillDirOf(path) {
  for (const { dir } of SKILL_TIERS) {
    const prefix = `${dir}/`;
    if (!path.startsWith(prefix)) continue;
    const parts = path.slice(prefix.length).split("/");
    return parts.length >= 2 ? `${dir}/${parts[0]}` : null;
  }
  return null;
}

export function parseVersion(value) {
  const s = String(value ?? "");
  return SEMVER_RE.test(s) ? s.split(".").map(Number) : null;
}

export function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// head === null means the working tree, including untracked files.
function changedEntries(cwd, base, head) {
  const args = ["diff", "--name-status", "-z", "-M", "--no-ext-diff", base];
  if (head) args.push(head);
  const tokens = git(cwd, args).split("\0");
  const entries = [];
  for (let i = 0; i < tokens.length && tokens[i]; ) {
    const status = tokens[i++];
    if (status.startsWith("R")) {
      entries.push({ status: "R", from: tokens[i++], path: tokens[i++] });
    } else if (status.startsWith("C")) {
      i++; // copy source is unchanged
      entries.push({ status: "A", path: tokens[i++] });
    } else {
      entries.push({ status: status[0], path: tokens[i++] });
    }
  }
  if (!head) {
    const untracked = git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean);
    for (const path of untracked) entries.push({ status: "A", path });
  }
  return entries;
}

function readSkillMd(cwd, rev, dir) {
  const path = `${dir}/SKILL.md`;
  if (rev === null) {
    const abs = join(cwd, ...path.split("/"));
    return existsSync(abs) ? readFileSync(abs, "utf8") : null;
  }
  try {
    return git(cwd, ["show", `${rev}:${path}`]);
  } catch {
    return null;
  }
}

function readVersion(raw) {
  let frontmatter;
  try {
    frontmatter = parseFrontmatter(raw);
  } catch (e) {
    return { error: e.message };
  }
  const value = frontmatter.metadata?.version;
  if (value == null) return { error: 'missing "metadata.version"' };
  const parsed = parseVersion(value);
  if (!parsed) return { error: `metadata.version "${value}" is not valid semver (expected x.y.z)` };
  return { value: String(value), parsed };
}

function listFiles(files) {
  const sorted = [...files].sort();
  const shown = sorted.slice(0, MAX_LISTED_FILES).join(", ");
  const more = sorted.length - MAX_LISTED_FILES;
  return more > 0 ? `${shown}, … and ${more} more` : shown;
}

// A skill moved between tiers under the same name (e.g. community -> official)
// keeps its version history. Rather than rely on git's similarity-based rename
// detection, which reports a move plus a large SKILL.md rewrite as delete + add,
// look for the same-named skill in another tier at the base revision that no
// longer exists at the head revision.
function findMovedFrom(cwd, baseRev, headRev, dir) {
  const name = basename(dir);
  for (const { dir: tierDir } of SKILL_TIERS) {
    const candidate = `${tierDir}/${name}`;
    if (candidate === dir) continue;
    if (readSkillMd(cwd, baseRev, candidate) !== null && readSkillMd(cwd, headRev, candidate) === null) {
      return candidate;
    }
  }
  return null;
}

/**
 * Compares skill versions between two revisions of the repo at `cwd`.
 * `head` may be null to compare against the working tree.
 * Returns { errors, warnings, checked } where checked lists skills that passed.
 */
export function checkSkillVersions({ cwd, base, head = null }) {
  const baseRev = verifyRevision(cwd, base);
  const headRev = head === null ? null : verifyRevision(cwd, head);

  const skills = new Map();
  const touch = (path) => {
    const dir = skillDirOf(path);
    if (!dir) return;
    if (!skills.has(dir)) skills.set(dir, { files: new Set() });
    skills.get(dir).files.add(path.slice(dir.length + 1));
  };

  for (const entry of changedEntries(cwd, baseRev, headRev)) {
    touch(entry.path);
    if (entry.status === "R") touch(entry.from);
  }

  const errors = [];
  const warnings = [];
  const checked = [];

  for (const dir of [...skills.keys()].sort()) {
    const { files } = skills.get(dir);

    const headRaw = readSkillMd(cwd, headRev, dir);
    if (headRaw === null) continue; // deleted skill, or not a skill folder

    let baseDir = dir;
    let baseRaw = readSkillMd(cwd, baseRev, dir);
    if (baseRaw === null) {
      const movedFrom = findMovedFrom(cwd, baseRev, headRev, dir);
      if (movedFrom) {
        baseDir = movedFrom;
        baseRaw = readSkillMd(cwd, baseRev, movedFrom);
      }
    }
    if (baseRaw === null) continue; // new skill: nothing to compare against

    const headVersion = readVersion(headRaw);
    if (headVersion.error) {
      errors.push(`${dir}: cannot check version bump — ${headVersion.error}`);
      continue;
    }
    const baseVersion = readVersion(baseRaw);
    if (baseVersion.error) {
      warnings.push(`${dir}: base version unreadable (${baseDir}/SKILL.md: ${baseVersion.error}); skipping bump check`);
      continue;
    }

    const from = baseDir === dir ? "" : ` (moved from ${baseDir})`;
    const cmp = compareVersions(headVersion.parsed, baseVersion.parsed);
    if (cmp > 0) {
      checked.push({ dir, base: baseVersion.value, head: headVersion.value });
      continue;
    }

    const [major, minor, patch] = baseVersion.parsed;
    const suggestion = `${major}.${minor}.${patch + 1}`;
    const hint =
      cmp < 0
        ? `for a rollback, keep the reverted content and set metadata.version above ${baseVersion.value} (e.g. ${suggestion})`
        : `bump metadata.version above ${baseVersion.value} (e.g. ${suggestion}, or a minor/major bump)`;
    errors.push(
      `${dir}${from}: metadata.version must increase when the skill changes (base ${baseVersion.value}, head ${headVersion.value})\n` +
        `  changed: ${listFiles(files)}\n` +
        `  hint: ${hint}`,
    );
  }

  return { errors, warnings, checked };
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") continue;
    const m = arg.match(/^--(base|head)(?:=(.*))?$/);
    if (!m) throw new Error(`unknown argument "${arg}" (expected --base <rev> and/or --head <rev>)`);
    const value = m[2] ?? argv[++i];
    if (!value) throw new Error(`--${m[1]} requires a revision`);
    opts[m[1]] = value;
  }
  return opts;
}

function defaultBase(cwd) {
  for (const ref of ["origin/main", "main"]) {
    try {
      return git(cwd, ["merge-base", "HEAD", ref]).trim();
    } catch {
      // try the next candidate
    }
  }
  throw new Error("could not find a merge base with origin/main or main; pass --base <rev>");
}

function main() {
  let result;
  let base;
  let head;
  try {
    const opts = parseArgs(process.argv.slice(2));
    base = opts.base ?? defaultBase(ROOT);
    head = opts.head ?? null;
    result = checkSkillVersions({ cwd: ROOT, base, head });
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }

  console.log(`Comparing skill versions: ${base} -> ${head ?? "working tree"}`);
  for (const { dir, base: from, head: to } of result.checked) console.log(`  ${dir}: ${from} -> ${to}`);

  const reporter = createReporter();
  for (const w of result.warnings) reporter.warn(w);
  for (const e of result.errors) reporter.fail(e);
  reporter.report();
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main();
}
