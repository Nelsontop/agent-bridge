import { assertCliProvider } from "../../core/cli-provider.js";
import { runGenericCliTask } from "../../infrastructure/cli/generic-cli-runner.js";

function ensureClaudeStreamJsonCommand(commandParts) {
  const args = Array.isArray(commandParts) ? [...commandParts] : [];
  if (args.length === 0) {
    return ["claude", "--print", "--verbose", "--output-format", "stream-json", "--include-partial-messages"];
  }

  if (!args.includes("--print")) {
    args.push("--print");
  }
  if (!args.includes("--verbose")) {
    args.push("--verbose");
  }
  if (!args.includes("--include-partial-messages")) {
    args.push("--include-partial-messages");
  }

  const equalFormatIndex = args.findIndex((item) => item.startsWith("--output-format="));
  if (equalFormatIndex >= 0) {
    args[equalFormatIndex] = "--output-format=stream-json";
    return args;
  }

  const optionIndex = args.indexOf("--output-format");
  if (optionIndex >= 0) {
    if (optionIndex + 1 < args.length) {
      args[optionIndex + 1] = "stream-json";
    } else {
      args.push("stream-json");
    }
    return args;
  }

  args.push("--output-format", "stream-json");
  return args;
}

function createClaudeStreamParser() {
  let partialText = "";
  let lastEmittedText = "";
  let lastFinalMessage = "";

  function asAgentEvent(text) {
    return {
      type: "item.completed",
      item: {
        type: "agent_message",
        text
      }
    };
  }

  return function parseStdoutLine(line) {
    let payload;
    try {
      payload = JSON.parse(line);
    } catch {
      return null;
    }

    const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
    const base = { sessionId, suppressDefault: true };

    if (payload.type === "stream_event") {
      const event = payload.event || {};

      if (event.type === "content_block_start" && event.content_block?.type === "text") {
        const initialText = String(event.content_block?.text || "");
        if (initialText) {
          partialText += initialText;
        }
      }

      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        const deltaText = String(event.delta?.text || "");
        if (deltaText) {
          partialText += deltaText;
        }
      }

      const normalized = partialText.trim();
      if (normalized && normalized !== lastEmittedText) {
        lastEmittedText = normalized;
        lastFinalMessage = normalized;
        return {
          ...base,
          finalMessage: lastFinalMessage,
          events: [asAgentEvent(normalized)]
        };
      }
      return base;
    }

    if (payload.type === "result" && typeof payload.result === "string" && payload.result.trim()) {
      lastFinalMessage = payload.result.trim();
      return {
        ...base,
        finalMessage: lastFinalMessage,
        events: [asAgentEvent(lastFinalMessage)]
      };
    }

    if (
      payload.type === "assistant" &&
      Array.isArray(payload.message?.content)
    ) {
      const text = payload.message.content
        .map((item) => (item?.type === "text" ? String(item.text || "") : ""))
        .join("")
        .trim();
      if (text) {
        partialText = text;
        lastEmittedText = text;
        lastFinalMessage = text;
        return {
          ...base,
          finalMessage: text,
          events: [asAgentEvent(text)]
        };
      }
    }

    return base;
  };
}

export function createClaudeCodeProvider(config, dependencies = {}) {
  const runTaskImpl = dependencies.runGenericCliTask || runGenericCliTask;
  const commandParts = ensureClaudeStreamJsonCommand(config.claudeCodeCommand);
  const parseStdoutLine = createClaudeStreamParser();

  return assertCliProvider({
    name: "claude-code",
    supportsResume: false,
    runTask(taskOptions) {
      return runTaskImpl(commandParts, {
        ...taskOptions,
        supportsResume: false,
        parseStdoutLine
      });
    }
  });
}
