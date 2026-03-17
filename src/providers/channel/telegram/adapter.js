import { assertChannelAdapter } from "../../../core/channel-adapter.js";

export class TelegramChannelAdapter {
  constructor() {
    this.name = "telegram";
  }

  attachBridge(_bridgeService) {}

  async start() {
    throw new Error("telegram adapter is not implemented yet");
  }

  async sendText() {
    throw new Error("telegram adapter is not implemented yet");
  }

  async sendCard() {
    throw new Error("telegram adapter is not implemented yet");
  }

  async updateCard() {
    throw new Error("telegram adapter is not implemented yet");
  }

  getMetrics() {
    return {
      telegram: {
        implemented: false
      }
    };
  }
}

export function createTelegramChannelAdapter() {
  return assertChannelAdapter(new TelegramChannelAdapter());
}
