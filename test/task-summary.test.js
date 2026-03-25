import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTaskCommitMessage,
  buildTaskName,
  summarizeTaskPrompt
} from "../src/application/task-summary.js";

test("summarizeTaskPrompt keeps action + topic for natural language requests", () => {
  const summary = summarizeTaskPrompt(
    "请修复 src/application/bridge-service.js 的会话复用问题",
    64
  );
  assert.match(summary, /^修复src\/application\/bridge-service/);
});

test("buildTaskName falls back to summarized prompt", () => {
  const name = buildTaskName({
    id: "T001",
    nameSummary: "",
    prompt: "请检查 health payload 的 transport 字段"
  });
  assert.equal(name, "T001-检查healthpayload的tr");
});

test("buildTaskCommitMessage normalizes chinese prompts into short commit subjects", () => {
  const message = buildTaskCommitMessage({
    id: "T060",
    prompt: "优化 git commit 提交信息规则，不要默认 bridge: save T060 这种格式"
  });
  assert.equal(message, "优化 git commit 提交信息规则");
});

test("buildTaskCommitMessage keeps english subjects concise", () => {
  const message = buildTaskCommitMessage({
    prompt: "Fix Feishu message routing when the workspace is not bound"
  });
  assert.equal(message, "Fix Feishu message routing when the workspace is not bound");
  assert.ok(message.length <= 60);
});

test("buildTaskCommitMessage strips english request wrappers", () => {
  const message = buildTaskCommitMessage({
    prompt: "Please improve auto commit message generation, do not use task ids by default"
  });
  assert.equal(message, "Improve auto commit message generation");
});

test("buildTaskCommitMessage truncates long subjects to a short commit-style title", () => {
  const message = buildTaskCommitMessage({
    prompt:
      "请优化 git commit 提交信息规则，统一固定动作前缀，并限制默认长度避免自动提交标题过长影响可读性"
  });
  assert.equal(message, "优化 git commit 提交信息规则");
  assert.ok(message.length <= 60);
});
