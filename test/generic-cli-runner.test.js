import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { runGenericCliTask } from "../src/generic-cli-runner.js";

const TEST_TMP_DIR = path.join(process.cwd(), ".tmp-test");

function makeTempDir(prefix) {
  fs.mkdirSync(TEST_TMP_DIR, { recursive: true });
  return fs.mkdtempSync(path.join(TEST_TMP_DIR, prefix));
}

test("runGenericCliTask resolves stdout as finalMessage", async () => {
  const tempDir = makeTempDir("generic-cli-");
  const scriptPath = path.join(tempDir, "echo.mjs");

  fs.writeFileSync(
    scriptPath,
    [
      "const prompt = process.argv[2] || '';",
      "console.log(`echo:${prompt}`);"
    ].join("\n"),
    "utf8"
  );

  const runner = runGenericCliTask([process.execPath, scriptPath], {
    prompt: "hello",
    workspaceDir: tempDir
  });

  const result = await runner.result;
  assert.equal(result.finalMessage, "echo:hello");
  assert.equal(result.sessionId, "");
});

test("runGenericCliTask rejects on non-zero exit", async () => {
  const tempDir = makeTempDir("generic-cli-fail-");
  const scriptPath = path.join(tempDir, "fail.mjs");

  fs.writeFileSync(
    scriptPath,
    [
      "console.error('boom');",
      "process.exit(2);"
    ].join("\n"),
    "utf8"
  );

  const runner = runGenericCliTask([process.execPath, scriptPath], {
    prompt: "ignored",
    workspaceDir: tempDir
  });

  await assert.rejects(runner.result, /boom/);
});
