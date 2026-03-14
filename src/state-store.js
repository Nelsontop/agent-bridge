import fs from "node:fs";
import path from "node:path";

const EMPTY_STATE = {
  version: 1,
  conversations: {}
};

export class StateStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = structuredClone(EMPTY_STATE);
    this.load();
  }

  load() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });

    if (!fs.existsSync(this.filePath)) {
      this.save();
      return;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      this.state = {
        version: 1,
        conversations: parsed.conversations || {}
      };
    } catch (error) {
      console.warn("[state] failed to load state file, recreating:", error.message);
      this.state = structuredClone(EMPTY_STATE);
      this.save();
    }
  }

  save() {
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
    fs.renameSync(tmpPath, this.filePath);
  }

  getConversation(chatKey) {
    return this.state.conversations[chatKey] || null;
  }

  upsertConversation(chatKey, patch) {
    const current = this.getConversation(chatKey) || {};
    this.state.conversations[chatKey] = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.state.conversations[chatKey];
  }

  clearConversation(chatKey) {
    delete this.state.conversations[chatKey];
    this.save();
  }

  conversationCount() {
    return Object.keys(this.state.conversations).length;
  }
}
