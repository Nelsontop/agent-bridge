import { runCodexTask } from "../../infrastructure/cli/codex-runner.js";
import { assertCliProvider } from "../../core/cli-provider.js";

export function createCodexProvider(config, dependencies = {}) {
  const runTaskImpl = dependencies.runCodexTask || runCodexTask;

  return assertCliProvider({
    name: "codex",
    supportsResume: true,
    runTask(taskOptions) {
      return runTaskImpl(config, taskOptions);
    }
  });
}
