import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  autoCommitWorkspace,
  rollbackAutoCommitWorkspace
} from "../src/git-commit.js";

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
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-bridge-git-"));
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
    gitAutoCommitMessagePrefix: "bridge: save"
  };
  const task = {
    id: "T001",
    workspaceDir: repoDir
  };

  const commitResult = await autoCommitWorkspace(config, task);
  assert.equal(commitResult.status, "committed");

  const rollbackResult = await rollbackAutoCommitWorkspace(config, task, commitResult.commitId);
  assert.equal(rollbackResult.status, "rolled-back");
  assert.equal(runGit(["rev-parse", "--short", "HEAD"], repoDir), initialHead);
  assert.equal(fs.readFileSync(filePath, "utf8"), "base\nchange\n");
  assert.equal(runGit(["status", "--short"], repoDir), "M note.txt");
});
