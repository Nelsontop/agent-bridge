import test from "node:test";
import assert from "node:assert/strict";
import { buildHealthPayload } from "../src/application/health-payload.js";

test("buildHealthPayload uses adapter transport instead of inferred value", () => {
  const payload = buildHealthPayload({
    bridge: {
      getHealth() {
        return {
          channelProvider: "feishu",
          cliProvider: "codex",
          runningTasks: 1
        };
      }
    },
    channelAdapter: {
      getTransport() {
        return "custom-transport";
      },
      getMetrics() {
        return {
          feishu: { requestCount: 2 },
          reconnect: { retries: 1 },
          ws: { dispatchCount: 3 }
        };
      }
    }
  });

  assert.equal(payload.ok, true);
  assert.equal(payload.transport, "custom-transport");
  assert.equal(payload.channelProvider, "feishu");
  assert.equal(payload.cliProvider, "codex");
  assert.equal(payload.runningTasks, 1);
  assert.deepEqual(payload.feishu, { requestCount: 2 });
  assert.deepEqual(payload.reconnect, { retries: 1 });
  assert.deepEqual(payload.ws, { dispatchCount: 3 });
});

test("buildHealthPayload normalizes missing metrics to null", () => {
  const payload = buildHealthPayload({
    bridge: {
      getHealth() {
        return {};
      }
    },
    channelAdapter: {
      getTransport() {
        return "demo";
      },
      getMetrics() {
        return {};
      }
    }
  });

  assert.equal(payload.transport, "demo");
  assert.equal(payload.feishu, null);
  assert.equal(payload.reconnect, null);
  assert.equal(payload.ws, null);
});
