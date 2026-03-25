import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEnvFileText,
  buildMissingConfigGuide,
  buildSetupChecklist,
  parseEnvText
} from "../src/application/init-guide.js";

const TEST_PROJECT_DIR = "/workspace/project";

test("parseEnvText reads quoted and plain env values", () => {
  const parsed = parseEnvText(`
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET="secret value"
# comment
PORT=3000
`);

  assert.deepEqual(parsed, {
    FEISHU_APP_ID: "cli_xxx",
    FEISHU_APP_SECRET: "secret value",
    PORT: "3000"
  });
});

test("buildEnvFileText preserves unknown keys and updates managed ones", () => {
  const text = buildEnvFileText(
    "FEISHU_APP_ID=old\nCUSTOM_FLAG=1\n",
    {
      FEISHU_APP_ID: "cli_new",
      FEISHU_APP_SECRET: "secret value",
      CODEX_WORKSPACE_DIR: `${TEST_PROJECT_DIR}`,
      WORKSPACE_ALLOWED_ROOTS: `${TEST_PROJECT_DIR},/workspace/sandboxes`
    }
  );

  assert.equal(text.includes("FEISHU_APP_ID=cli_new"), true);
  assert.equal(text.includes("FEISHU_APP_SECRET=\"secret value\""), true);
  assert.equal(text.includes(`CODEX_WORKSPACE_DIR=${TEST_PROJECT_DIR}`), true);
  assert.equal(
    text.includes(`WORKSPACE_ALLOWED_ROOTS="${TEST_PROJECT_DIR},/workspace/sandboxes"`),
    true
  );
  assert.equal(text.includes("CUSTOM_FLAG=1"), true);
});

test("buildEnvFileText keeps AUTO_COMMIT_MESSAGE_PREFIX blank by default", () => {
  const text = buildEnvFileText("", {
    AUTO_COMMIT_AFTER_TASK_ENABLED: "false",
    AUTO_COMMIT_MESSAGE_PREFIX: ""
  });

  assert.equal(text.includes("AUTO_COMMIT_MESSAGE_PREFIX="), true);
  assert.equal(text.includes("AUTO_COMMIT_MESSAGE_PREFIX=bridge: save"), false);
});

test("setup checklist and missing config guide include actionable next steps", () => {
  const checklist = buildSetupChecklist({ envFilePath: `${TEST_PROJECT_DIR}/.env` });
  const guide = buildMissingConfigGuide({
    command: "npm run setup",
    missingKey: "FEISHU_APP_ID"
  });

  assert.equal(checklist.includes(`${TEST_PROJECT_DIR}/.env`), true);
  assert.equal(checklist.includes("npm start"), true);
  assert.equal(checklist.includes("npm run service:install"), true);
  assert.equal(guide.includes("FEISHU_APP_ID"), true);
  assert.equal(guide.includes("npm run setup"), true);
});
