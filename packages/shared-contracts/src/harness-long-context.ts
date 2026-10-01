import { z } from "zod";
import { harnessPluginIdSchema } from "./harness-plugins.js";

export const HARNESS_LONG_CONTEXT_GET_METHOD = "codexhost/harness/long-context/get";
export const HARNESS_LONG_CONTEXT_SET_METHOD = "codexhost/harness/long-context/set";

export const harnessLongContextGetSchema = z
  .object({
    harnessId: harnessPluginIdSchema,
  })
  .strict();
export const harnessLongContextSetSchema = harnessLongContextGetSchema.extend({
  enabled: z.boolean(),
});
export const harnessLongContextSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export type HarnessLongContextGet = z.infer<typeof harnessLongContextGetSchema>;
export type HarnessLongContextSet = z.infer<typeof harnessLongContextSetSchema>;
export type HarnessLongContext = z.infer<typeof harnessLongContextSchema>;
