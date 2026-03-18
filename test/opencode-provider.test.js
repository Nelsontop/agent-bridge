import test from "node:test";
import assert from "node:assert/strict";
import { createOpencodeProvider } from "../src/providers/cli/opencode-provider.js";

test("createOpencodeProvider delegates to generic runner", async () => {
  const calls = [];
  const provider = createOpencodeProvider(
    {
      opencodeCommand: ["opencode", "run"]
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

  const execution = provider.runTask({ prompt: "hello", workspaceDir: "/tmp/ws" });
  const result = await execution.result;

  assert.deepEqual(calls[0].commandParts, ["opencode", "run"]);
  assert.equal(calls[0].options.prompt, "hello");
  assert.equal(result.finalMessage, "ok");
});
