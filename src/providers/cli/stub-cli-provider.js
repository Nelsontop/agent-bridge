import { assertCliProvider } from "../../core/cli-provider.js";

export function createStubCliProvider({ name, displayName = "", reason = "" }) {
  const normalizedName = String(name || "").trim();
  return assertCliProvider({
    name: normalizedName,
    supportsResume: false,
    runTask() {
      const detail = reason || "provider integration is not implemented yet";
      throw new Error(
        `${displayName || normalizedName} provider is unavailable: ${detail}`
      );
    }
  });
}
