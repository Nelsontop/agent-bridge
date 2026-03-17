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

test("runGenericCliTask emits streaming events for stdout lines", async () => {
  const tempDir = makeTempDir("generic-cli-stream-");
  const scriptPath = path.join(tempDir, "stream.mjs");

  fs.writeFileSync(
    scriptPath,
    [
      "console.log('line-1');",
      "setTimeout(() => {",
      "  console.log('line-2');",
      "}, 30);",
      "setTimeout(() => {",
      "  console.log('done');",
      "}, 60);"
    ].join("\n"),
    "utf8"
  );

  const events = [];
  const runner = runGenericCliTask([process.execPath, scriptPath], {
    prompt: "ignored",
    workspaceDir: tempDir,
    onEvent(event) {
      events.push(event);
    }
  });

  const result = await runner.result;
  assert.match(result.finalMessage, /done/);
  assert.equal(events.length, 3);
  assert.deepEqual(events.map((event) => event.item?.text), ["line-1", "line-2", "done"]);
  for (const event of events) {
    assert.equal(event.type, "item.completed");
    assert.equal(event.item?.type, "agent_message");
  }
});

test("runGenericCliTask uses parseStdoutLine transformed events and final message", async () => {
  const tempDir = makeTempDir("generic-cli-parser-");
  const scriptPath = path.join(tempDir, "json-lines.mjs");

  fs.writeFileSync(
    scriptPath,
    [
      "console.log('{\"msg\":\"A\"}');",
      "console.log('{\"msg\":\"B\"}');"
    ].join("\n"),
    "utf8"
  );

  const events = [];
  let combined = "";
  const runner = runGenericCliTask([process.execPath, scriptPath], {
    prompt: "ignored",
    workspaceDir: tempDir,
    onEvent(event) {
      events.push(event);
    },
    parseStdoutLine(line) {
      const payload = JSON.parse(line);
      combined += payload.msg;
      return {
        sessionId: "stream-session",
        finalMessage: combined,
        suppressDefault: true,
        events: [
          {
            type: "item.completed",
            item: {
              type: "agent_message",
              text: combined
            }
          }
        ]
      };
    }
  });

  const result = await runner.result;
  assert.equal(result.sessionId, "stream-session");
  assert.equal(result.finalMessage, "AB");
  assert.deepEqual(events.map((event) => event.item?.text), ["A", "AB"]);
});
