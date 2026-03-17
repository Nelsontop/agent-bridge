import test from "node:test";
import assert from "node:assert/strict";
import { createClaudeCodeProvider } from "../src/providers/cli/claude-code-provider.js";

test("createClaudeCodeProvider delegates to generic runner", async () => {
  const calls = [];
  const provider = createClaudeCodeProvider(
    {
      claudeCodeCommand: ["claude", "--print"]
    },
    {
      runGenericCliTask(commandParts, options) {
        calls.push({ commandParts, options });
        return {
          cancel() {},
          result: Promise.resolve({ finalMessage: "ok", sessionId: "" })
        };
      }
    }
  );

  assert.equal(provider.name, "claude-code");
  assert.equal(provider.supportsResume, false);

  const execution = provider.runTask({ prompt: "hello", workspaceDir: "/tmp/ws" });
  const result = await execution.result;

  assert.deepEqual(calls[0].commandParts, [
    "claude",
    "--print",
    "--verbose",
    "--include-partial-messages",
    "--output-format",
    "stream-json"
  ]);
  assert.equal(calls[0].options.prompt, "hello");
  assert.equal(calls[0].options.workspaceDir, "/tmp/ws");
  assert.equal(typeof calls[0].options.parseStdoutLine, "function");
  assert.equal(result.finalMessage, "ok");
});

test("createClaudeCodeProvider parser converts text deltas to cumulative agent message", () => {
  let capturedOptions = null;
  const provider = createClaudeCodeProvider(
    {
      claudeCodeCommand: ["claude"]
    },
    {
      runGenericCliTask(_commandParts, options) {
        capturedOptions = options;
        return {
          cancel() {},
          result: Promise.resolve({ finalMessage: "ok", sessionId: "" })
        };
      }
    }
  );

  provider.runTask({ prompt: "x" });
  const parse = capturedOptions.parseStdoutLine;

  const first = parse(
    JSON.stringify({
      type: "stream_event",
      session_id: "sid-1",
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "你" }
      }
    })
  );
  const second = parse(
    JSON.stringify({
      type: "stream_event",
      session_id: "sid-1",
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "好" }
      }
    })
  );

  assert.equal(first.sessionId, "sid-1");
  assert.equal(first.finalMessage, "你");
  assert.equal(first.events[0].item.text, "你");
  assert.equal(second.finalMessage, "你好");
  assert.equal(second.events[0].item.text, "你好");
});
