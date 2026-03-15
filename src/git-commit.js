import { spawn } from "node:child_process";

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.once("error", reject);
    child.once("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

function buildCommitMessage(prefix, task) {
  return `${prefix} ${task.id}`;
}

function buildExpectedCommitMessage(config, task) {
  return buildCommitMessage(config.gitAutoCommitMessagePrefix, task);
}

export async function autoCommitWorkspace(config, task) {
  const workspaceDir = task.workspaceDir;
  if (!config.gitAutoCommitEnabled || !workspaceDir) {
    return { status: "disabled" };
  }

  const repoCheck = await run("git", ["rev-parse", "--is-inside-work-tree"], workspaceDir);
  if (repoCheck.code !== 0 || repoCheck.stdout !== "true") {
    return { status: "skipped", reason: "not-git-repo" };
  }

  const status = await run("git", ["status", "--porcelain"], workspaceDir);
  if (status.code !== 0) {
    return {
      status: "failed",
      reason: "status-error",
      detail: status.stderr || status.stdout || `git status exited with ${status.code}`
    };
  }
  if (!status.stdout) {
    return { status: "skipped", reason: "no-changes" };
  }

  const add = await run("git", ["add", "-A"], workspaceDir);
  if (add.code !== 0) {
    return {
      status: "failed",
      reason: "add-error",
      detail: add.stderr || add.stdout || `git add exited with ${add.code}`
    };
  }

  const commit = await run(
    "git",
    ["commit", "-m", buildExpectedCommitMessage(config, task)],
    workspaceDir
  );
  if (commit.code !== 0) {
    return {
      status: "failed",
      reason: "commit-error",
      detail: commit.stderr || commit.stdout || `git commit exited with ${commit.code}`
    };
  }

  const head = await run("git", ["rev-parse", "--short", "HEAD"], workspaceDir);
  return {
    status: "committed",
    commitId: head.code === 0 ? head.stdout : "",
    detail: commit.stdout || commit.stderr
  };
}

export async function rollbackAutoCommitWorkspace(config, task, commitId) {
  const workspaceDir = task.workspaceDir;
  if (!config.gitAutoCommitEnabled || !workspaceDir || !commitId) {
    return { status: "skipped", reason: "disabled" };
  }

  const repoCheck = await run("git", ["rev-parse", "--is-inside-work-tree"], workspaceDir);
  if (repoCheck.code !== 0 || repoCheck.stdout !== "true") {
    return { status: "skipped", reason: "not-git-repo" };
  }

  const head = await run("git", ["rev-parse", "--short", "HEAD"], workspaceDir);
  if (head.code !== 0) {
    return {
      status: "failed",
      reason: "head-error",
      detail: head.stderr || head.stdout || `git rev-parse exited with ${head.code}`
    };
  }
  if (head.stdout !== commitId) {
    return { status: "skipped", reason: "head-moved" };
  }

  const subject = await run("git", ["log", "-1", "--format=%s"], workspaceDir);
  if (subject.code !== 0) {
    return {
      status: "failed",
      reason: "subject-error",
      detail: subject.stderr || subject.stdout || `git log exited with ${subject.code}`
    };
  }
  if (subject.stdout !== buildExpectedCommitMessage(config, task)) {
    return { status: "skipped", reason: "message-mismatch" };
  }

  const reset = await run("git", ["reset", "--mixed", "HEAD~1"], workspaceDir);
  if (reset.code !== 0) {
    return {
      status: "failed",
      reason: "reset-error",
      detail: reset.stderr || reset.stdout || `git reset exited with ${reset.code}`
    };
  }

  return {
    status: "rolled-back",
    commitId,
    detail: reset.stdout || reset.stderr
  };
}
