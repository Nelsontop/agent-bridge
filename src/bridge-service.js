import { runCodexTask } from "./codex-runner.js";
import { autoCommitWorkspace } from "./git-commit.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chatKeyFor(event) {
  return `${event.message.chat_type}:${event.message.chat_id}`;
}

function parseContent(event) {
  if (event.message.message_type !== "text") {
    return null;
  }

  const payload = JSON.parse(event.message.content || "{}");
  return typeof payload.text === "string" ? payload.text : null;
}

function stripMentions(text, mentions) {
  let output = text;
  for (const mention of mentions || []) {
    if (mention.name) {
      output = output.replaceAll(`@${mention.name}`, " ");
    }
    if (mention.key) {
      output = output.replaceAll(mention.key, " ");
    }
  }
  return output.replace(/\s+/g, " ").trim();
}

function splitText(text, maxChars) {
  const chunks = [];
  let rest = text.trim();
  while (rest.length > maxChars) {
    let index = rest.lastIndexOf("\n", maxChars);
    if (index < maxChars * 0.5) {
      index = rest.lastIndexOf(" ", maxChars);
    }
    if (index < maxChars * 0.5) {
      index = maxChars;
    }
    chunks.push(rest.slice(0, index).trim());
    rest = rest.slice(index).trim();
  }
  if (rest) {
    chunks.push(rest);
  }
  return chunks.length > 0 ? chunks : [""];
}

function formatTaskId(number) {
  return `T${String(number).padStart(4, "0")}`;
}

function helpText() {
  return [
    "Codex Feishu Bridge 命令：",
    "/help 查看帮助",
    "/status 查看当前会话、工作目录与任务状态",
    "/reset 清空当前聊天绑定的 Codex 会话",
    "/abort <任务号> 终止当前运行中的任务",
    "",
    "其余文本会直接发送给 Codex 执行。"
  ].join("\n");
}

function truncateText(text, maxChars) {
  const normalized = String(text || "").trim();
  if (!normalized || normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function buildReplyTarget(config, event) {
  return {
    chatId: event.message.chat_id,
    replyToMessageId: config.feishuReplyToMessageEnabled
      ? event.message.message_id
      : ""
  };
}

function buildCardButton(text, type, value) {
  return {
    tag: "button",
    text: {
      tag: "plain_text",
      content: text
    },
    type,
    value
  };
}

function extractEventType(eventEnvelope) {
  return eventEnvelope?.header?.event_type || eventEnvelope?.event?.type || "";
}

function extractCardAction(eventEnvelope) {
  const event = eventEnvelope?.event || {};
  const action = event.action || eventEnvelope?.action;
  const value = action?.value || {};
  if (!action || !value.action) {
    return null;
  }

  return {
    name: value.action,
    value,
    senderOpenId:
      event.operator?.operator_id?.open_id ||
      eventEnvelope?.operator?.operator_id?.open_id ||
      "",
    chatId: value.chatId || value.chat_id || "",
    chatKey: value.chatKey || value.chat_key || "",
    replyToMessageId:
      value.replyToMessageId ||
      value.reply_to_message_id ||
      value.sourceMessageId ||
      "",
    taskId: value.taskId || value.task_id || ""
  };
}

export class BridgeService {
  constructor(config, store, feishuClient) {
    this.config = config;
    this.store = store;
    this.feishuClient = feishuClient;
    this.nextTaskNumber = 1;
    this.queue = [];
    this.running = new Map();
  }

  resolveWorkspaceDir(chatKey, chatId) {
    return (
      this.config.chatWorkspaceMappings.get(chatKey) ||
      this.config.chatWorkspaceMappings.get(chatId) ||
      this.config.codexWorkspaceDir
    );
  }

  async dispatchEvent(eventEnvelope) {
    const eventType = extractEventType(eventEnvelope);
    if (eventType === "card.action.trigger") {
      await this.handleCardAction(eventEnvelope);
      return null;
    }

    const event = eventEnvelope.event;
    if (!event || event.message?.message_type === undefined) {
      return null;
    }
    if (event.sender?.sender_type && event.sender.sender_type !== "user") {
      return null;
    }

    const senderOpenId = event.sender?.sender_id?.open_id || "";
    if (
      this.config.feishuAllowedOpenIds.size > 0 &&
      !this.config.feishuAllowedOpenIds.has(senderOpenId)
    ) {
      await this.safeSend(
        buildReplyTarget(this.config, event),
        "当前用户未被授权使用这个 Codex 桥接器。"
      );
      return null;
    }

    const rawText = parseContent(event);
    if (!rawText) {
      await this.safeSend(
        buildReplyTarget(this.config, event),
        "当前仅支持文本消息。"
      );
      return null;
    }

    const mentions = event.message.mentions || [];
    if (
      event.message.chat_type !== "p2p" &&
      this.config.requireMentionInGroup &&
      !this.isBotMentioned(mentions)
    ) {
      return null;
    }

    const text = stripMentions(rawText, mentions);
    const chatKey = chatKeyFor(event);
    const target = buildReplyTarget(this.config, event);
    if (!text) {
      await this.safeSend(target, helpText());
      return null;
    }

    if (text.startsWith("/")) {
      await this.handleCommand({
        commandText: text,
        chatId: event.message.chat_id,
        chatKey,
        target,
        senderOpenId
      });
      return null;
    }

    const task = this.enqueueTask(event, text, senderOpenId, target);
    if (this.config.taskAckEnabled) {
      await this.sendTaskAck(task);
    }
    this.pumpQueue();
    return null;
  }

  async handleCardAction(eventEnvelope) {
    const action = extractCardAction(eventEnvelope);
    if (!action) {
      return;
    }

    if (
      this.config.feishuAllowedOpenIds.size > 0 &&
      !this.config.feishuAllowedOpenIds.has(action.senderOpenId)
    ) {
      await this.safeSend(
        {
          chatId: action.chatId,
          replyToMessageId: action.replyToMessageId
        },
        "当前用户未被授权使用这个 Codex 桥接器。"
      );
      return;
    }

    if (action.name === "abort") {
      await this.handleCommand({
        commandText: `/abort ${action.taskId}`.trim(),
        chatId: action.chatId,
        chatKey: action.chatKey,
        target: {
          chatId: action.chatId,
          replyToMessageId: action.replyToMessageId
        },
        senderOpenId: action.senderOpenId
      });
      return;
    }

    if (action.name === "reset") {
      await this.handleCommand({
        commandText: "/reset",
        chatId: action.chatId,
        chatKey: action.chatKey,
        target: {
          chatId: action.chatId,
          replyToMessageId: action.replyToMessageId
        },
        senderOpenId: action.senderOpenId
      });
    }
  }

  isBotMentioned(mentions) {
    if (!mentions || mentions.length === 0) {
      return false;
    }
    if (!this.config.feishuBotOpenId) {
      return true;
    }
    return mentions.some(
      (mention) => mention.id?.open_id === this.config.feishuBotOpenId
    );
  }

  enqueueTask(event, prompt, senderOpenId, target) {
    const chatKey = chatKeyFor(event);
    const id = formatTaskId(this.nextTaskNumber++);
    const workspaceDir = this.resolveWorkspaceDir(chatKey, event.message.chat_id);
    const task = {
      id,
      prompt,
      senderOpenId,
      event,
      target,
      chatKey,
      workspaceDir,
      enqueuedAt: new Date().toISOString(),
      status: "queued"
    };
    this.queue.push(task);
    return task;
  }

  buildActionCard({ title, body, chatId, chatKey, replyToMessageId, taskId }) {
    const actions = [];
    if (taskId) {
      actions.push(
        buildCardButton("Abort", "danger", {
          action: "abort",
          taskId,
          chatId,
          chatKey,
          replyToMessageId
        })
      );
    }
    actions.push(
      buildCardButton("Reset Session", "default", {
        action: "reset",
        chatId,
        chatKey,
        replyToMessageId
      })
    );

    return {
      config: {
        wide_screen_mode: true
      },
      header: {
        template: taskId ? "orange" : "blue",
        title: {
          tag: "plain_text",
          content: title
        }
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: body
          }
        },
        {
          tag: "action",
          actions
        }
      ]
    };
  }

  async sendTaskAck(task) {
    const queueIndex = this.queue.findIndex((item) => item.id === task.id);
    const position = queueIndex >= 0 ? `${queueIndex + 1}` : "1";
    const body = [
      `任务已入队：\`${task.id}\``,
      `工作目录：\`${task.workspaceDir}\``,
      `队列位置：${position}`
    ].join("\n");

    if (this.config.feishuInteractiveCardsEnabled) {
      await this.safeSendCard(
        task.target,
        this.buildActionCard({
          title: `Codex Task ${task.id}`,
          body,
          chatId: task.target.chatId,
          chatKey: task.chatKey,
          replyToMessageId: task.target.replyToMessageId,
          taskId: task.id
        })
      );
      return;
    }

    await this.safeSend(
      task.target,
      `已接收任务 ${task.id}，队列位置 ${position}。工作目录：${task.workspaceDir}`
    );
  }

  async handleCommand({ commandText, chatId, chatKey, target }) {
    const [command, ...rest] = commandText.trim().split(/\s+/);

    if (command === "/help") {
      await this.safeSend(target, helpText());
      return;
    }

    if (command === "/reset") {
      this.store.clearConversation(chatKey);
      await this.safeSend(target, "已清空当前聊天绑定的 Codex 会话。");
      return;
    }

    if (command === "/status") {
      const conversation = this.store.getConversation(chatKey);
      const runningTask = [...this.running.values()].find(
        (task) => task.chatKey === chatKey
      );
      const queuedCount = this.queue.filter((task) => task.chatKey === chatKey).length;
      const workspaceDir = this.resolveWorkspaceDir(chatKey, chatId);
      const lines = [
        `chatKey: ${chatKey}`,
        `workspace: ${workspaceDir}`,
        `sessionId: ${conversation?.sessionId || "无"}`,
        `running: ${runningTask ? `${runningTask.id} (${runningTask.startedAt})` : "无"}`,
        `queued: ${queuedCount}`
      ];

      if (this.config.feishuInteractiveCardsEnabled) {
        await this.safeSendCard(
          target,
          this.buildActionCard({
            title: "Codex Status",
            body: lines.join("\n"),
            chatId,
            chatKey,
            replyToMessageId: target.replyToMessageId,
            taskId: runningTask?.id || ""
          })
        );
        return;
      }

      await this.safeSend(target, lines.join("\n"));
      return;
    }

    if (command === "/abort") {
      const taskId = rest[0];
      if (!taskId) {
        await this.safeSend(target, "用法：/abort T0001");
        return;
      }

      const runningTask = this.running.get(taskId);
      if (!runningTask) {
        await this.safeSend(target, `未找到运行中的任务 ${taskId}。`);
        return;
      }

      runningTask.runner.cancel();
      await this.safeSend(target, `已请求终止任务 ${taskId}。`);
      return;
    }

    await this.safeSend(target, `未知命令：${command}\n\n${helpText()}`);
  }

  pumpQueue() {
    while (
      this.running.size < this.config.maxConcurrentTasks &&
      this.queue.length > 0
    ) {
      const task = this.queue.shift();
      this.runTask(task).catch((error) => {
        console.error(`[task:${task.id}] unexpected error`, error);
      });
    }
  }

  queueStreamText(task, target, text) {
    const normalized = String(text || "").trim();
    if (!normalized) {
      return;
    }

    task.streamChain = task.streamChain
      .then(async () => {
        const now = Date.now();
        const elapsed = now - task.lastStreamSentAt;
        const waitMs = this.config.feishuStreamUpdateMinIntervalMs - elapsed;
        if (waitMs > 0) {
          await sleep(waitMs);
        }

        const chunks = splitText(normalized, this.config.maxReplyChars);
        for (const chunk of chunks) {
          await this.safeSend(target, chunk);
        }
        task.lastStreamSentAt = Date.now();
      })
      .catch((error) => {
        console.error(`[task:${task.id}] stream send failed`, error);
      });
  }

  handleRunnerEvent(task, target, event) {
    if (!this.config.feishuStreamOutputEnabled || !event?.item) {
      return;
    }

    const { item } = event;
    if (item.type === "agent_message" && event.type === "item.completed") {
      const text = String(item.text || "").trim();
      if (!text || text === task.lastStreamedAgentMessage) {
        return;
      }

      task.lastStreamedAgentMessage = text;
      this.queueStreamText(
        task,
        target,
        `任务 ${task.id} 进度更新：\n\n${text}`
      );
      return;
    }

    if (!this.config.feishuStreamCommandStatusEnabled || item.type !== "command_execution") {
      return;
    }

    if (event.type === "item.started") {
      if (task.startedCommandIds.has(item.id)) {
        return;
      }
      task.startedCommandIds.add(item.id);
      this.queueStreamText(
        task,
        target,
        `任务 ${task.id} 正在执行命令：\n${truncateText(item.command, this.config.maxReplyChars)}`
      );
      return;
    }

    if (event.type === "item.completed") {
      if (task.completedCommandIds.has(item.id)) {
        return;
      }
      task.completedCommandIds.add(item.id);

      const output = truncateText(
        item.aggregated_output,
        Math.max(200, this.config.maxReplyChars - 120)
      );
      const lines = [
        `任务 ${task.id} 命令${item.exit_code === 0 ? "已完成" : "结束"}：`,
        truncateText(item.command, this.config.maxReplyChars)
      ];
      if (item.exit_code !== null && item.exit_code !== undefined) {
        lines.push(`exit: ${item.exit_code}`);
      }
      if (output) {
        lines.push("", output);
      }

      this.queueStreamText(task, target, lines.join("\n"));
    }
  }

  formatAutoCommitResult(result) {
    if (!this.config.gitAutoCommitEnabled) {
      return "";
    }
    if (result.status === "disabled") {
      return "";
    }
    if (result.status === "committed") {
      return `自动提交：已创建提交 ${result.commitId || "(unknown)"}`;
    }
    if (result.status === "skipped" && result.reason === "no-changes") {
      return "自动提交：没有检测到变更";
    }
    if (result.status === "skipped" && result.reason === "not-git-repo") {
      return "自动提交：当前工作目录不是 Git 仓库";
    }
    return `自动提交失败：${result.detail || result.reason || "unknown error"}`;
  }

  async runTask(task) {
    task.status = "running";
    task.startedAt = new Date().toISOString();
    task.streamChain = Promise.resolve();
    task.lastStreamSentAt = 0;
    task.lastStreamedAgentMessage = "";
    task.startedCommandIds = new Set();
    task.completedCommandIds = new Set();

    const conversation = this.store.getConversation(task.chatKey);
    const sessionId =
      conversation?.workspaceDir === task.workspaceDir ? conversation?.sessionId || null : null;
    const runner = runCodexTask(this.config, {
      prompt: task.prompt,
      sessionId,
      workspaceDir: task.workspaceDir,
      onEvent: (event) => {
        this.handleRunnerEvent(task, task.target, event);
      }
    });

    task.runner = runner;
    this.running.set(task.id, task);

    try {
      const result = await runner.result;
      await task.streamChain;
      this.store.upsertConversation(task.chatKey, {
        sessionId: result.sessionId,
        lastTaskId: task.id,
        lastSenderOpenId: task.senderOpenId,
        workspaceDir: task.workspaceDir
      });

      const autoCommitResult = await autoCommitWorkspace(this.config, task);
      const headerLines = [`任务 ${task.id} 已完成。`];
      if (result.sessionId) {
        headerLines.push(`session: ${result.sessionId}`);
      }
      headerLines.push(`workspace: ${task.workspaceDir}`);
      const commitSummary = this.formatAutoCommitResult(autoCommitResult);
      if (commitSummary) {
        headerLines.push(commitSummary);
      }

      const alreadyStreamedFinalMessage =
        this.config.feishuStreamOutputEnabled &&
        result.finalMessage.trim() &&
        result.finalMessage.trim() === task.lastStreamedAgentMessage;
      const finalText = alreadyStreamedFinalMessage
        ? headerLines.join("\n")
        : `${headerLines.join("\n")}\n\n${result.finalMessage}`;
      const chunks = splitText(finalText, this.config.maxReplyChars);
      for (const chunk of chunks) {
        await this.safeSend(task.target, chunk);
      }

      if (this.config.feishuInteractiveCardsEnabled) {
        await this.safeSendCard(
          task.target,
          this.buildActionCard({
            title: `Codex Task ${task.id}`,
            body: [
              "任务已完成。",
              `工作目录：\`${task.workspaceDir}\``,
              commitSummary || "自动提交未启用"
            ].join("\n"),
            chatId: task.target.chatId,
            chatKey: task.chatKey,
            replyToMessageId: task.target.replyToMessageId
          })
        );
      }
    } catch (error) {
      await task.streamChain;
      const autoCommitResult = await autoCommitWorkspace(this.config, task);
      const commitSummary = this.formatAutoCommitResult(autoCommitResult);
      const text = [
        `任务 ${task.id} 执行失败：`,
        error.message || String(error)
      ];
      if (commitSummary) {
        text.push("", commitSummary);
      }
      await this.safeSend(task.target, text.join("\n"));
    } finally {
      this.running.delete(task.id);
      this.pumpQueue();
    }
  }

  async safeSend(target, text) {
    if (!target?.chatId) {
      return;
    }
    try {
      await this.feishuClient.sendText(target.chatId, text, {
        replyToMessageId: target.replyToMessageId
      });
    } catch (error) {
      console.error("[feishu] send failed:", error);
    }
  }

  async safeSendCard(target, card) {
    if (!target?.chatId) {
      return;
    }
    try {
      await this.feishuClient.sendCard(target.chatId, card, {
        replyToMessageId: target.replyToMessageId
      });
    } catch (error) {
      console.error("[feishu] send card failed:", error);
    }
  }

  getHealth() {
    return {
      runningTasks: this.running.size,
      queuedTasks: this.queue.length,
      conversations: this.store.conversationCount()
    };
  }
}
