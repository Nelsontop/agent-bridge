import { createStubCliProvider } from "./stub-cli-provider.js";

export function createKimiCliProvider() {
  return createStubCliProvider({
    name: "kimi-cli",
    displayName: "kimi-cli",
    reason: "CLI protocol adapter is pending"
  });
}
