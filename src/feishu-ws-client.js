import larkSdk from "../.vendor/lark-sdk-1.59.0/lib/index.js";
import { fetchJsonWithRetry } from "./http-utils.js";

const { WSClient, LoggerLevel } = larkSdk;

export function extractWsEventType(payload) {
  return (
    payload?.event_type ||
    payload?.header?.event_type ||
    payload?.event?.type ||
    ""
  );
}

function createMetrics() {
  return {
    dispatchCount: 0,
    dispatchFailureCount: 0,
    lastErrorAt: "",
    lastErrorMessage: "",
    lastEventAt: "",
    lastEventType: "",
    requestCount: 0,
    recentEventTypes: [],
    retryCount: 0,
    timeoutCount: 0
  };
}

export class FeishuWsClient {
  constructor(config, bridgeService, options = {}) {
    this.config = config;
    this.bridgeService = bridgeService;
    this.fetchImpl = options.fetchImpl || fetch;
    this.metrics = createMetrics();
    this.client = new WSClient({
      appId: config.feishuAppId,
      appSecret: config.feishuAppSecret,
      loggerLevel: LoggerLevel.info,
      httpInstance: {
        request: this.request.bind(this)
      }
    });
  }

  trackFailure(error) {
    this.metrics.lastErrorAt = new Date().toISOString();
    this.metrics.lastErrorMessage = error.message || String(error);
  }

  recordEvent(payload) {
    const eventType = extractWsEventType(payload) || "unknown";
    this.metrics.dispatchCount += 1;
    this.metrics.lastEventAt = new Date().toISOString();
    this.metrics.lastEventType = eventType;
    this.metrics.recentEventTypes = [...this.metrics.recentEventTypes, eventType].slice(-10);
    console.log(`[ws] incoming event: ${eventType}`);
  }

  async request(options) {
    const url = String(options.url || "");
    const finalUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `${this.config.feishuBaseUrl}${url}`;

    this.metrics.requestCount += 1;
    const { payload } = await fetchJsonWithRetry({
      body: options.data,
      fetchImpl: this.fetchImpl,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(options.headers || {})
      },
      label: "feishu_ws_request",
      method: options.method || "GET",
      onFailure: ({ error }) => {
        this.trackFailure(error);
      },
      onRetry: ({ isTimeout }) => {
        this.metrics.retryCount += 1;
        if (isTimeout) {
          this.metrics.timeoutCount += 1;
        }
      },
      retries: this.config.feishuRequestRetries,
      retryDelayMs: this.config.feishuRequestRetryDelayMs,
      timeoutMs: this.config.feishuRequestTimeoutMs,
      url: finalUrl
    });

    return payload;
  }

  async start() {
    await this.client.start({
      eventDispatcher: {
        invoke: async (payload) => {
          this.recordEvent(payload);

          try {
            await this.bridgeService.dispatchEvent(payload);
          } catch (error) {
            this.metrics.dispatchFailureCount += 1;
            this.trackFailure(error);
            throw error;
          }

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

  getMetrics() {
    return {
      ...this.metrics
    };
  }
}
