import type { HarnessAdapter } from "@codexhost/harness-adapter";
import {
  HARNESS_LONG_CONTEXT_SET_METHOD,
  harnessLongContextGetSchema,
  harnessLongContextSchema,
  harnessLongContextSetSchema,
  type HarnessLongContext,
} from "@codexhost/shared-contracts";

export class HarnessLongContextError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "HarnessLongContextError";
  }
}

/** Public plugin capability only. The Renderer cannot choose the model suffix. */
export async function handleHarnessLongContext(
  method: string,
  params: unknown,
  adapters: ReadonlyMap<string, HarnessAdapter>,
): Promise<HarnessLongContext> {
  try {
    if (method === HARNESS_LONG_CONTEXT_SET_METHOD) {
      const parsed = harnessLongContextSetSchema.safeParse(params);
      if (!parsed.success) throw new HarnessLongContextError(-32602, "Invalid 1M context request");
      const adapter = adapters.get(parsed.data.harnessId);
      if (!adapter?.setLongContext) {
        throw new HarnessLongContextError(-32078, "1M context is unavailable for this Harness");
      }
      return harnessLongContextSchema.parse(await adapter.setLongContext(parsed.data.enabled));
    }
    const parsed = harnessLongContextGetSchema.safeParse(params);
    if (!parsed.success) throw new HarnessLongContextError(-32602, "Invalid 1M context request");
    const adapter = adapters.get(parsed.data.harnessId);
    if (!adapter?.getLongContext) {
      throw new HarnessLongContextError(-32078, "1M context is unavailable for this Harness");
    }
    return harnessLongContextSchema.parse(await adapter.getLongContext());
  } catch (error) {
    if (error instanceof HarnessLongContextError) throw error;
    throw new HarnessLongContextError(-32077, "Could not read or save the 1M context setting");
  }
}
