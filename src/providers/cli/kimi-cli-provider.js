import { assertCliProvider } from "../../core/cli-provider.js";
import { runGenericCliTask } from "../../generic-cli-runner.js";

export function createKimiCliProvider(config, dependencies = {}) {
  const runTaskImpl = dependencies.runGenericCliTask || runGenericCliTask;

  return assertCliProvider({
    name: "kimi-cli",
    supportsResume: false,
    runTask(taskOptions) {
      return runTaskImpl(config.kimiCliCommand, {
        ...taskOptions,
        supportsResume: false
      });
    }
  });
}
