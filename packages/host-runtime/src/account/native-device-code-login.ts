import { z } from "zod";

const nonBlank = z
  .string()
  .min(1)
  .max(1_024)
  .refine((value) => value.trim().length > 0);

/** Response to the device-code request owned by Host Settings, not a Desktop RPC schema. */
export const nativeDeviceCodeLoginResponseSchema = z.object({
  type: z.literal("chatgptDeviceCode"),
  loginId: nonBlank,
  verificationUrl: z
    .string()
    .url()
    .max(16_384)
    .refine((value) => {
      const url = new URL(value);
      return (
        !url.username &&
        !url.password &&
        ["https://auth.openai.com", "https://chatgpt.com"].includes(url.origin)
      );
    }),
  userCode: nonBlank,
});
