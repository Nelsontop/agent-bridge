import test from "node:test";
import assert from "node:assert/strict";
import { FeishuWsClient, extractWsEventType } from "../src/feishu-ws-client.js";

test("extractWsEventType supports flattened and nested payloads", () => {
  assert.equal(
    extractWsEventType({ event_type: "card.action.trigger" }),
    "card.action.trigger"
  );
  assert.equal(
    extractWsEventType({ header: { event_type: "im.message.receive_v1" } }),
    "im.message.receive_v1"
  );
  assert.equal(
    extractWsEventType({ event: { type: "legacy.type" } }),
    "legacy.type"
  );
});

test("FeishuWsClient records recent event types", () => {
  const client = {
    metrics: {
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
    }
  };

  FeishuWsClient.prototype.recordEvent.call(client, {
    event_type: "im.message.receive_v1"
  });
  FeishuWsClient.prototype.recordEvent.call(client, {
    event_type: "card.action.trigger"
  });

  const metrics = client.metrics;
  assert.equal(metrics.dispatchCount, 2);
  assert.equal(metrics.lastEventType, "card.action.trigger");
  assert.deepEqual(metrics.recentEventTypes, [
    "im.message.receive_v1",
    "card.action.trigger"
  ]);
});
