import larkSdk from "../.vendor/lark-sdk-1.59.0/lib/index.js";

const { WSClient, LoggerLevel } = larkSdk;

export class FeishuWsClient {
  constructor(config, bridgeService) {
    this.config = config;
    this.bridgeService = bridgeService;
    this.client = new WSClient({
      appId: config.feishuAppId,
      appSecret: config.feishuAppSecret,
      loggerLevel: LoggerLevel.info,
      httpInstance: {
        request: this.request.bind(this)
      }
    });
  }

  async request(options) {
    const url = String(options.url || "");
    const finalUrl = url.startsWith("http://") || url.startsWith("https://")
      ? url
      : `${this.config.feishuBaseUrl}${url}`;

    const response = await fetch(finalUrl, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(options.headers || {})
      },
      body: options.data ? JSON.stringify(options.data) : undefined
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.msg || response.statusText);
    }
    return payload;
  }

  async start() {
    await this.client.start({
      eventDispatcher: {
        invoke: async (payload) => {
          await this.bridgeService.dispatchEvent(payload);
          return null;
        }
      }
    });
  }

  close({ force = false } = {}) {
    this.client.close({ force });
  }

  getReconnectInfo() {
    return this.client.getReconnectInfo();
  }
}
