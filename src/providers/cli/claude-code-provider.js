import { createStubCliProvider } from "./stub-cli-provider.js";

export function createClaudeCodeProvider() {
  return createStubCliProvider({
    name: "claude-code",
    displayName: "claude-code",
    reason: "CLI protocol adapter is pending"
  });
}
