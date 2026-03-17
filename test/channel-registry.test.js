import test from "node:test";
import assert from "node:assert/strict";
import {
  createChannelAdapter,
  SUPPORTED_CHANNEL_ADAPTERS
} from "../src/providers/channel/index.js";

test("channel registry resolves supported channel adapters", () => {
  const feishuAdapter = createChannelAdapter(
    { feishuAppId: "x", feishuAppSecret: "y" },
    {
      name: "feishu",
      options: {
        feishuClient: {
          sendText() {},
          sendCard() {},
          updateCard() {},
          getMetrics() {
            return {};
          }
        },
        wsClient: {
          start() {},
          close() {},
          getReconnectInfo() {
            return {};
          },
          getMetrics() {
            return {};
          }
        }
      }
    }
  );
  assert.equal(feishuAdapter.name, "feishu");

  const dingtalkAdapter = createChannelAdapter({}, { name: "dingtalk" });
  const telegramAdapter = createChannelAdapter({}, { name: "telegram" });
  assert.equal(dingtalkAdapter.name, "dingtalk");
  assert.equal(telegramAdapter.name, "telegram");
  assert.deepEqual(SUPPORTED_CHANNEL_ADAPTERS, ["feishu", "dingtalk", "telegram"]);
});

test("channel registry rejects unknown channels", () => {
  assert.throws(
    () => createChannelAdapter({}, { name: "slack" }),
    /Unsupported channel adapter/
  );
});
