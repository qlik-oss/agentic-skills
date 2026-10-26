import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkSkillVersions, compareVersions, parseVersion, skillDirOf } from "../validate-skill-versions.mjs";

// Isolate test repos from the developer's global git config (signing, hooks).
const GIT_CONFIG = [
  "-c", "user.name=test",
  "-c", "user.email=test@example.com",
  "-c", "commit.gpgsign=false",
  "-c", "core.hooksPath=/dev/null",
  "-c", "init.defaultBranch=main",
];

function makeRepo(t) {
  const cwd = mkdtempSync(join(tmpdir(), "skill-versions-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", [...GIT_CONFIG, ...args], { cwd, encoding: "utf8" }).trim();
  const write = (path, content) => {
    const abs = join(cwd, ...path.split("/"));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  };
  const remove = (path) => rmSync(join(cwd, ...path.split("/")), { recursive: true, force: true });
  const skill = (dir, version, body = "Body.") => {
    const name = dir.split("/").pop();
    write(
      `${dir}/SKILL.md`,
      `---\nname: ${name}\ndescription: Test skill.\nlicense: Apache-2.0\nmetadata:\n  author: test\n  version: ${version}\n---\n\n${body}\n`,
    );
  };
  const commit = (message = "change") => {
    git("add", "-A");
    git("commit", "-q", "--allow-empty", "-m", message);
    return git("rev-parse", "HEAD");
  };
  const check = (base, head = "HEAD") => checkSkillVersions({ cwd, base, head });
  git("init", "-q");
  return { cwd, git, write, remove, skill, commit, check };
}

const A = "community/skills/skill-a";
const B = "official/skills/skill-b";

function seed(repo) {
  repo.skill(A, "1.0.0");
  repo.write(`${A}/references/guide.md`, "Guide.\n");
  repo.skill(B, "2.3.4");
  repo.write("community/skills/README.md", "Tier readme.\n");
  repo.write("template/skill/SKILL.md", "---\nname: your-skill-name\nmetadata:\n  version: 1.0.0\n---\n");
  return repo.commit("seed");
}

test("helpers", () => {
  assert.equal(skillDirOf(`${A}/references/guide.md`), A);
  assert.equal(skillDirOf(`${B}/SKILL.md`), B);
  assert.equal(skillDirOf("community/skills/README.md"), null);
  assert.equal(skillDirOf("template/skill/SKILL.md"), null);
  assert.equal(skillDirOf("README.md"), null);
  assert.deepEqual(parseVersion("1.10.0"), [1, 10, 0]);
  assert.equal(parseVersion("1.0"), null);
  assert.equal(parseVersion("v1.0.0"), null);
  assert.ok(compareVersions([1, 10, 0], [1, 9, 0]) > 0);
  assert.equal(compareVersions([1, 2, 3], [1, 2, 3]), 0);
});

test("fails when SKILL.md changes without a bump", (t) => {
  const repo = makeRepo(t);
  const base = seed(repo);
  repo.skill(A, "1.0.0", "Edited body.");
  repo.commit();
  const { errors } = repo.check(base);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /community\/skills\/skill-a: metadata\.version must increase .*base 1\.0\.0, head 1\.0\.0/);
  assert.match(errors[0], /changed: SKILL\.md/);
  assert.match(errors[0], /e\.g\. 1\.0\.1/);
});

test("fails when only a reference file changes", (t) => {
  const repo = makeRepo(t);
  const base = seed(repo);
  repo.write(`${A}/references/guide.md`, "Updated guide.\n");
  repo.commit();
  const { errors } = repo.check(base);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /changed: references\/guide\.md/);
});

test("fails when a supporting file is deleted without a bump", (t) => {
  const repo = makeRepo(t);
  const base = seed(repo);
  repo.remove(`${A}/references/guide.md`);
  repo.commit();
  assert.equal(repo.check(base).errors.length, 1);
});

for (const [kind, version] of [["patch", "1.0.1"], ["minor", "1.1.0"], ["major", "2.0.0"]]) {
  test(`passes on a ${kind} bump`, (t) => {
    const repo = makeRepo(t);
    const base = seed(repo);
    repo.skill(A, version);
    repo.write(`${A}/references/guide.md`, "Updated guide.\n");
    repo.commit();
    const { errors, checked } = repo.check(base);
    assert.deepEqual(errors, []);
    assert.deepEqual(checked, [{ dir: A, base: "1.0.0", head: version }]);
  });
}

test("compares versions numerically", (t) => {
  const repo = makeRepo(t);
  repo.skill(A, "1.9.0");
  const base = repo.commit();
  repo.skill(A, "1.10.0");
  repo.commit();
  assert.deepEqual(repo.check(base).errors, []);
});

test("fails on a lower version with a rollback hint", (t) => {
  const repo = makeRepo(t);
  repo.skill(A, "1.3.0", "Bad change.");
  const base = repo.commit();
  repo.skill(A, "1.2.0", "Good content.");
  repo.commit("revert");
  const { errors } = repo.check(base);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /for a rollback, keep the reverted content and set metadata\.version above 1\.3\.0 \(e\.g\. 1\.3\.1\)/);
});

test("checks each changed skill independently", (t) => {
  const repo = makeRepo(t);
  const base = seed(repo);
  repo.skill(A, "1.0.1", "Edited.");
  repo.skill(B, "2.3.4", "Edited.");
  repo.commit();
  const { errors, checked } = repo.check(base);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^official\/skills\/skill-b:/);
  assert.deepEqual(checked.map((c) => c.dir), [A]);
});

test("reports every unbumped skill", (t) => {
  const repo = makeRepo(t);
  const base = seed(repo);
  repo.write(`${A}/references/guide.md`, "Updated.\n");
  repo.skill(B, "2.3.4", "Edited.");
  repo.commit();
  assert.equal(repo.check(base).errors.length, 2);
});

test("one bump covers several commits to the same skill", (t) => {
  const repo = makeRepo(t);
  const base = seed(repo);
  repo.skill(A, "1.1.0", "First.");
  repo.commit();
  repo.write(`${A}/references/guide.md`, "Second.\n");
  repo.commit();
  assert.deepEqual(repo.check(base).errors, []);
});

test("exempts new and deleted skills", (t) => {
  const repo = makeRepo(t);
  const base = seed(repo);
  repo.skill("community/skills/skill-new", "0.1.0");
  repo.remove(B);
  repo.commit();
  const { errors, checked } = repo.check(base);
  assert.deepEqual(errors, []);
  assert.deepEqual(checked, []);
});

test("ignores template, tier READMEs, and files outside skills", (t) => {
  const repo = makeRepo(t);
  const base = seed(repo);
  repo.write("template/skill/SKILL.md", "---\nname: your-skill-name\nmetadata:\n  version: 1.0.0\n---\nEdited.\n");
  repo.write("community/skills/README.md", "Edited.\n");
  repo.write("README.md", "Edited.\n");
  repo.commit();
  assert.deepEqual(repo.check(base), { errors: [], warnings: [], checked: [] });
});

test("a skill moved between tiers keeps its version history", (t) => {
  const repo = makeRepo(t);
  const base = seed(repo);
  repo.git("mv", A, "official/skills/skill-a");
  repo.commit("promote");
  const { errors } = repo.check(base);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^official\/skills\/skill-a \(moved from community\/skills\/skill-a\):/);

  repo.skill("official/skills/skill-a", "1.1.0");
  repo.commit("bump");
  assert.deepEqual(repo.check(base).errors, []);
});

test("a renamed skill is a new skill", (t) => {
  const repo = makeRepo(t);
  const base = seed(repo);
  repo.git("mv", A, "community/skills/skill-renamed");
  repo.skill("community/skills/skill-renamed", "1.0.0");
  repo.commit("rename");
  assert.deepEqual(repo.check(base).errors, []);
});

test("handles file names with spaces", (t) => {
  const repo = makeRepo(t);
  const base = seed(repo);
  repo.write(`${A}/references/my notes.md`, "Notes.\n");
  repo.commit();
  const { errors } = repo.check(base);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /changed: references\/my notes\.md/);
});

test("fails on an invalid head version", (t) => {
  const repo = makeRepo(t);
  const base = seed(repo);
  repo.skill(A, "1.1");
  repo.commit();
  const { errors } = repo.check(base);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /cannot check version bump — metadata\.version "1\.1" is not valid semver/);
});

test("only blames the PR for its own changes on a GitHub-style merge commit", (t) => {
  const repo = makeRepo(t);
  seed(repo);
  repo.git("checkout", "-q", "-b", "feature");
  repo.skill(B, "2.4.0", "PR change.");
  repo.commit("pr");
  repo.git("checkout", "-q", "main");
  repo.write(`${A}/references/guide.md`, "Landed on main without a bump.\n");
  repo.commit("main moved on");
  // GitHub's refs/pull/N/merge: first parent is the base branch, second is the PR head.
  repo.git("merge", "-q", "--no-ff", "--no-edit", "feature");
  const { errors, checked } = repo.check("HEAD^1", "HEAD");
  assert.deepEqual(errors, []);
  assert.deepEqual(checked.map((c) => c.dir), [B]);
});

test("compares against the latest base when main bumped the skill first", (t) => {
  const repo = makeRepo(t);
  seed(repo);
  repo.git("checkout", "-q", "-b", "feature");
  repo.write(`${A}/references/guide.md`, "PR edit without a bump.\n");
  repo.commit("pr");
  repo.git("checkout", "-q", "main");
  repo.skill(A, "1.1.0", "Main release.");
  repo.commit("main bump");
  repo.git("merge", "-q", "--no-ff", "--no-edit", "feature");
  const { errors } = repo.check("HEAD^1", "HEAD");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /base 1\.1\.0, head 1\.1\.0/);
});

test("working-tree mode sees uncommitted and untracked changes", (t) => {
  const repo = makeRepo(t);
  const base = seed(repo);
  repo.write(`${A}/references/guide.md`, "Uncommitted.\n");
  repo.write(`${B}/references/new.md`, "Untracked.\n");
  const { errors } = checkSkillVersions({ cwd: repo.cwd, base, head: null });
  assert.equal(errors.length, 2);
});

test("throws a clear error for an unknown revision", (t) => {
  const repo = makeRepo(t);
  seed(repo);
  assert.throws(() => repo.check("does-not-exist"), /unknown revision "does-not-exist"/);
});
