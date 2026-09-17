import type { HarnessPluginContext } from "@codexhost/harness-adapter/plugin";
import { QoderAdapter } from "@codexhost/adapter-qoder";

export function createHarnessAdapter(context: HarnessPluginContext): QoderAdapter {
  return new QoderAdapter({
    variant: "cn",
    environment: { ...context.environment },
    platform: context.platform as NodeJS.Platform,
  });
}
