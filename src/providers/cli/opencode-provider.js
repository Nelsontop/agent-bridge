import { assertCliProvider } from "../../core/cli-provider.js";
import { runGenericCliTask } from "../../generic-cli-runner.js";

export function createOpencodeProvider(config, dependencies = {}) {
  const runTaskImpl = dependencies.runGenericCliTask || runGenericCliTask;

  return assertCliProvider({
    name: "opencode",
    supportsResume: false,
    runTask(taskOptions) {
      return runTaskImpl(config.opencodeCommand, {
        ...taskOptions,
        supportsResume: false
      });
    }
  });
}
