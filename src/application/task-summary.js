function normalizeSummaryText(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, (match) => {
      const gitSkill = match.match(/skills\/(?:\.curated|\.experimental)\/([^/?#]+)/);
      if (gitSkill) {
        return `${gitSkill[1]} 技能`;
      }
      const githubTree = match.match(/github\.com\/[^/]+\/[^/]+\/tree\/[^/]+\/(.+)$/);
      if (githubTree) {
        const last = githubTree[1].split("/").filter(Boolean).pop();
        return last || "链接";
      }
      return "链接";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  let truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace >= Math.floor(maxChars * 0.6) && /\s/.test(text)) {
    truncated = truncated.slice(0, lastSpace);
  }
  return truncated.replace(/[，。；！？,.!?\s_-]+$/g, "").trim();
}

const SUMMARY_ACTION_RULES = [
  [/^(请)?(优化|改进|改良)/, "优化"],
  [/^(请)?(修复|解决|排查|处理)/, "修复"],
  [/^(请)?(新增|增加|添加|支持|实现)/, "新增"],
  [/^(请)?(安装|集成)/, "安装"],
  [/^(请)?(测试|验证)/, "测试"],
  [/^(请)?(检查|查看|审查|review|review当前)/i, "检查"],
  [/^(请)?(分析|解释|说明)/, "分析"],
  [/^(请)?(重构)/, "重构"],
  [/^(请)?(整理|汇总|总结)/, "整理"]
];

const COMMIT_ACTION_RULES = [
  [/^(请)?(优化|改进|改良)/, "优化"],
  [/^(请)?(修复|解决|排查|处理)/, "修复"],
  [/^(请)?(新增|增加|添加|支持|实现)/, "新增"],
  [/^(请)?(安装|集成)/, "安装"],
  [/^(请)?(测试|验证)/, "测试"],
  [/^(请)?(检查|查看|审查|review|review当前)/i, "检查"],
  [/^(请)?(分析|解释|说明)/, "分析"],
  [/^(请)?(重构)/, "重构"],
  [/^(请)?(整理|汇总|总结)/, "整理"],
  [/^(fix|resolve|repair)\b/i, "Fix"],
  [/^(add|create|implement)\b/i, "Add"],
  [/^(update|change|adjust)\b/i, "Update"],
  [/^(improve|optimize|enhance)\b/i, "Improve"],
  [/^(refactor|clean up)\b/i, "Refactor"],
  [/^(remove|drop)\b/i, "Remove"],
  [/^(support|enable)\b/i, "Support"],
  [/^(document)\b/i, "Document"],
  [/^(test|verify)\b/i, "Test"],
  [/^(check|review|inspect)\b/i, "Check"]
];

function detectSummaryAction(text) {
  const normalized = normalizeSummaryText(text);
  for (const [pattern, label] of SUMMARY_ACTION_RULES) {
    if (pattern.test(normalized)) {
      return label;
    }
  }
  return "";
}

function detectCommitAction(text) {
  const normalized = normalizeSummaryText(text)
    .replace(/^(请|帮我|麻烦你|需要你)\s*/i, "")
    .replace(/^(please|pls)\s+/i, "")
    .replace(/^(can you|could you|would you)\s+/i, "")
    .replace(/^(看下|看看)\s*/, "");
  for (const [pattern, label] of COMMIT_ACTION_RULES) {
    if (pattern.test(normalized)) {
      return label;
    }
  }
  return "";
}

function extractSummaryTopic(text, action) {
  const normalized = normalizeSummaryText(text)
    .replace(/^(请|帮我|麻烦你|需要你)\s*/, "")
    .replace(/^(看下|看看)\s*/, "");
  if (!normalized) {
    return "";
  }

  if (action) {
    const actionPattern = new RegExp(`^${action}`);
    const withoutAction = normalized.replace(actionPattern, "").trim();
    const directTopic = withoutAction
      .split(/[，。；！？,.!?\n]/, 1)[0]
      .replace(/^(一下|下|一下子|一下这个|一下这条|一下当前)\s*/, "")
      .replace(/^(任务|技能|功能|按钮)\s*/, (match) => match)
      .trim();
    if (directTopic) {
      return directTopic;
    }
  }

  const codeMatch = normalized.match(/([A-Za-z0-9._/-]+\.(js|ts|md|json|yaml|yml))/i);
  if (codeMatch) {
    return codeMatch[1];
  }

  return normalized.split(/[，。；！？,.!?\n]/, 1)[0].trim();
}

export function summarizeTaskPrompt(prompt, maxChars = 18) {
  const normalized = normalizeSummaryText(
    String(prompt || "")
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(0, 3)
      .join(" ")
  );
  if (!normalized) {
    return "task";
  }

  const action = detectSummaryAction(normalized);
  let topic = extractSummaryTopic(normalized, action);
  topic = topic
    .replace(/^(当前|这个|这次)\s*/, "")
    .replace(/(，|。|；|！|？).*$/, "")
    .replace(/\s+/g, "")
    .replace(/^请/, "")
    .trim();

  let summary = action
    ? `${action}${topic && !topic.startsWith(action) ? topic : topic.replace(new RegExp(`^${action}`), "")}`
    : topic || normalized;
  summary = summary
    .replace(/^(检查当前)/, "检查")
    .replace(/^(查看当前)/, "查看")
    .replace(/^(review)/i, "审查")
    .trim();

  if (!summary) {
    summary = "task";
  }
  return truncateText(summary, maxChars) || "task";
}

export function buildTaskCommitMessage(task, maxChars = 60) {
  const normalized = normalizeSummaryText(
    String(task?.prompt || "")
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(0, 3)
      .join(" ")
  );

  const compactPrompt = normalized
    .replace(/^(请|帮我|麻烦你|需要你)\s*/i, "")
    .replace(/^(please|pls)\s+/i, "")
    .replace(/^(can you|could you|would you)\s+/i, "")
    .replace(/^(看下|看看)\s*/, "")
    .split(/[，。；！？,.!?\n]/, 1)[0]
    .replace(/\s+/g, " ")
    .replace(/[，。；！？,.!?]+$/g, "")
    .trim();

  const action = detectCommitAction(compactPrompt);
  if (action) {
    const actionPattern = new RegExp(`^${action}\\s*`, "i");
    const topic = compactPrompt
      .replace(actionPattern, "")
      .replace(/^(一下|下|一下子|一下这个|一下这条|一下当前)\s*/i, "")
      .replace(/^(the|a|an)\s+/i, "")
      .trim();
    const separator =
      topic && (/^[A-Za-z]/.test(action) || /^[A-Za-z0-9]/.test(topic)) ? " " : "";
    const message = `${action}${separator}${topic}`.trim();
    if (message) {
      return truncateText(message, maxChars) || "update workspace";
    }
  }

  const summary = summarizeTaskPrompt(task?.prompt || "", Math.min(maxChars, 32));
  if (summary !== "task") {
    return truncateText(summary, maxChars) || "Update workspace";
  }
  return "Update workspace";
}

export function buildTaskName(task) {
  return `${task.id}-${task.nameSummary || summarizeTaskPrompt(task.prompt)}`;
}
