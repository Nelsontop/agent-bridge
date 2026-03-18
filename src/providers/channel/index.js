import { createFeishuChannelAdapter } from "./feishu/adapter.js";

export const SUPPORTED_CHANNEL_ADAPTERS = [
  "feishu"
];

export function createChannelAdapter(config, { name = "feishu", options = {} } = {}) {
  if (name === "feishu") {
    return createFeishuChannelAdapter(config, options);
  }
  throw new Error(
    `Unsupported channel adapter: ${name}. Supported values: ${SUPPORTED_CHANNEL_ADAPTERS.join(", ")}`
  );
}
