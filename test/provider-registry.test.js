import test from "node:test";
import assert from "node:assert/strict";
import {
  createBuiltinCliProviderRegistry,
  SUPPORTED_CLI_PROVIDERS
} from "../src/providers/cli/index.js";

test("builtin CLI provider registry contains all configured providers", () => {
  const registry = createBuiltinCliProviderRegistry(
    {
      codexWorkspaceDir: "/tmp/workspace",
      claudeCodeCommand: ["claude"],
      opencodeCommand: ["opencode"],
      kimiCliCommand: ["kimi"]
    },
    {
      runCodexTask() {
        return {
          cancel() {},
          result: Promise.resolve({ finalMessage: "ok", sessionId: "thread" })
        };
      },
      runGenericCliTask() {
        return {
          cancel() {},
          result: Promise.resolve({ finalMessage: "ok", sessionId: "" })
        };
      }
    }
  );

  assert.deepEqual(registry.list().sort(), [...SUPPORTED_CLI_PROVIDERS].sort());
});

test("all builtin CLI providers return executable handles", () => {
  const registry = createBuiltinCliProviderRegistry(
    {
      codexWorkspaceDir: "/tmp/workspace",
      claudeCodeCommand: ["claude"],
      opencodeCommand: ["opencode"],
      kimiCliCommand: ["kimi"]
    },
    {
      runCodexTask() {
        return {
          cancel() {},
          result: Promise.resolve({ finalMessage: "ok", sessionId: "thread" })
        };
      },
      runGenericCliTask() {
        return {
          cancel() {},
          result: Promise.resolve({ finalMessage: "ok", sessionId: "" })
        };
      }
    }
  );

  for (const name of ["opencode", "kimi-cli", "claude-code"]) {
    const provider = registry.get(name);
    const execution = provider.runTask({ prompt: "hi" });
    assert.equal(typeof execution.cancel, "function");
  }
});
