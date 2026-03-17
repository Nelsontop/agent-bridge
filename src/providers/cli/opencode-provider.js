import { createStubCliProvider } from "./stub-cli-provider.js";

export function createOpencodeProvider() {
  return createStubCliProvider({
    name: "opencode",
    displayName: "opencode",
    reason: "CLI protocol adapter is pending"
  });
}
