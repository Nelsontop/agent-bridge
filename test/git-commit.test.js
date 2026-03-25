import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  autoCommitWorkspace,
  rollbackAutoCommitWorkspace
} from "../src/infrastructure/git/git-commit.js";

const TEST_TMP_DIR = path.join(process.cwd(), ".tmp-test");

function makeTempDir(prefix) {
  fs.mkdirSync(TEST_TMP_DIR, { recursive: true });
  return fs.mkdtempSync(path.join(TEST_TMP_DIR, prefix));
}

function runGit(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0"
    }
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

test("rollbackAutoCommitWorkspace removes the task auto commit and keeps changes", async () => {
  const repoDir = makeTempDir("codex-bridge-git-");
  const filePath = path.join(repoDir, "note.txt");
  fs.writeFileSync(filePath, "base\n", "utf8");

  runGit(["init"], repoDir);
  runGit(["config", "user.name", "Test User"], repoDir);
  runGit(["config", "user.email", "test@example.com"], repoDir);
  runGit(["add", "."], repoDir);
  runGit(["commit", "-m", "initial"], repoDir);
  const initialHead = runGit(["rev-parse", "--short", "HEAD"], repoDir);

  fs.writeFileSync(filePath, "base\nchange\n", "utf8");

  const config = {
    gitAutoCommitEnabled: true,
    gitAutoCommitMessagePrefix: ""
  };
  const task = {
    id: "T001",
    prompt: "优化 git commit 提交信息规则，不要默认 bridge: save T001 这种格式",
    workspaceDir: repoDir
  };

  const commitResult = await autoCommitWorkspace(config, task);
  assert.equal(commitResult.status, "committed");
  assert.equal(
    runGit(["log", "-1", "--format=%s"], repoDir),
    "优化 git commit 提交信息规则"
  );

  const rollbackResult = await rollbackAutoCommitWorkspace(
    config,
    task,
    commitResult.commitId,
    commitResult.commitMessage
  );
  assert.equal(rollbackResult.status, "rolled-back");
  assert.equal(runGit(["rev-parse", "--short", "HEAD"], repoDir), initialHead);
  assert.equal(fs.readFileSync(filePath, "utf8"), "base\nchange\n");
  assert.equal(runGit(["status", "--short"], repoDir), "M note.txt");
});
