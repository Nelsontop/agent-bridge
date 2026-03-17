import { createDingtalkChannelAdapter } from "./dingtalk/adapter.js";
import { createFeishuChannelAdapter } from "./feishu/adapter.js";
import { createTelegramChannelAdapter } from "./telegram/adapter.js";

export const SUPPORTED_CHANNEL_ADAPTERS = [
  "feishu",
  "dingtalk",
  "telegram"
];

export function createChannelAdapter(config, { name = "feishu", options = {} } = {}) {
  if (name === "feishu") {
    return createFeishuChannelAdapter(config, options);
  }
  if (name === "dingtalk") {
    return createDingtalkChannelAdapter(config, options);
  }
  if (name === "telegram") {
    return createTelegramChannelAdapter(config, options);
  }
  throw new Error(
    `Unsupported channel adapter: ${name}. Supported values: ${SUPPORTED_CHANNEL_ADAPTERS.join(", ")}`
  );
}
