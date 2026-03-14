import test from "node:test";
import assert from "node:assert/strict";
import { BridgeService } from "../src/bridge-service.js";

function createConfig(overrides = {}) {
  return {
    chatWorkspaceMappings: new Map(),
    codexWorkspaceDir: "/tmp/codex-workspace",
    feishuAllowedOpenIds: new Set(),
    feishuBotOpenId: "",
    feishuInteractiveCardsEnabled: false,
    feishuReplyToMessageEnabled: true,
    feishuStreamCommandStatusEnabled: false,
    feishuStreamOutputEnabled: false,
    feishuStreamUpdateMinIntervalMs: 0,
    gitAutoCommitEnabled: false,
    maxConcurrentTasks: 2,
    maxReplyChars: 200,
    requireMentionInGroup: true,
    taskAckEnabled: false,
    ...overrides
  };
}

function createStore() {
  const conversations = {};
  return {
    clearConversation(chatKey) {
      delete conversations[chatKey];
    },
    conversationCount() {
      return Object.keys(conversations).length;
    },
    getConversation(chatKey) {
      return conversations[chatKey] || null;
    },
    upsertConversation(chatKey, patch) {
      conversations[chatKey] = {
        ...(conversations[chatKey] || {}),
        ...patch
      };
      return conversations[chatKey];
    }
  };
}

function createClient() {
  return {
    cards: [],
    texts: [],
    async sendCard(chatId, card, options = {}) {
      this.cards.push({ chatId, card, options });
    },
    async sendText(chatId, text, options = {}) {
      this.texts.push({ chatId, text, options });
    }
  };
}

test("dispatchEvent tolerates malformed text payloads", async () => {
  const client = createClient();
  const bridge = new BridgeService(createConfig(), createStore(), client);

  await bridge.dispatchEvent({
    event: {
      message: {
        chat_id: "chat-1",
        chat_type: "p2p",
        content: "{invalid",
        message_id: "msg-1",
        message_type: "text"
      },
      sender: {
        sender_id: {
          open_id: "ou_123"
        },
        sender_type: "user"
      }
    }
  });

  assert.deepEqual(client.texts, [
    {
      chatId: "chat-1",
      options: {
        replyToMessageId: "msg-1"
      },
      text: "消息内容解析失败，暂不支持该消息格式。"
    }
  ]);
});

test("pumpQueue skips blocked tasks from the same chat", () => {
  const bridge = new BridgeService(createConfig(), createStore(), createClient());
  const startedTaskIds = [];

  bridge.running.set("T0001", {
    chatKey: "p2p:chat-a"
  });
  bridge.queue.push(
    { id: "T0002", chatKey: "p2p:chat-a" },
    { id: "T0003", chatKey: "p2p:chat-b" }
  );
  bridge.runTask = (task) => {
    startedTaskIds.push(task.id);
    bridge.running.set(task.id, task);
    return Promise.resolve();
  };

  bridge.pumpQueue();

  assert.deepEqual(startedTaskIds, ["T0003"]);
  assert.deepEqual(
    bridge.queue.map((task) => task.id),
    ["T0002"]
  );
});

test("abort command cannot cancel a task from another chat", async () => {
  const client = createClient();
  const bridge = new BridgeService(createConfig(), createStore(), client);
  let cancelled = false;

  bridge.running.set("T0007", {
    chatKey: "p2p:chat-b",
    runner: {
      cancel() {
        cancelled = true;
      }
    }
  });

  await bridge.handleCommand({
    commandText: "/abort T0007",
    chatId: "chat-a",
    chatKey: "p2p:chat-a",
    target: {
      chatId: "chat-a",
      replyToMessageId: "msg-2"
    }
  });

  assert.equal(cancelled, false);
  assert.deepEqual(client.texts, [
    {
      chatId: "chat-a",
      options: {
        replyToMessageId: "msg-2"
      },
      text: "当前聊天没有运行中的任务 T0007。"
    }
  ]);
});
