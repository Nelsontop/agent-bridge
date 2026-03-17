import { assertChannelAdapter } from "../../../core/channel-adapter.js";

export class DingtalkChannelAdapter {
  constructor() {
    this.name = "dingtalk";
  }

  attachBridge(_bridgeService) {}

  async start() {
    throw new Error("dingtalk adapter is not implemented yet");
  }

  async sendText() {
    throw new Error("dingtalk adapter is not implemented yet");
  }

  async sendCard() {
    throw new Error("dingtalk adapter is not implemented yet");
  }

  async updateCard() {
    throw new Error("dingtalk adapter is not implemented yet");
  }

  getMetrics() {
    return {
      dingtalk: {
        implemented: false
      }
    };
  }
}

export function createDingtalkChannelAdapter() {
  return assertChannelAdapter(new DingtalkChannelAdapter());
}
