import test from "node:test";
import assert from "node:assert/strict";
import { createKimiCliProvider } from "../src/providers/cli/kimi-cli-provider.js";

test("createKimiCliProvider delegates to generic runner", async () => {
  const calls = [];
  const provider = createKimiCliProvider(
    {
      kimiCliCommand: ["kimi", "chat"]
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

  assert.deepEqual(calls[0].commandParts, ["kimi", "chat"]);
  assert.equal(calls[0].options.prompt, "hello");
  assert.equal(result.finalMessage, "ok");
});
