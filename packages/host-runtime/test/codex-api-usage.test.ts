import { describe, expect, it, vi } from "vitest";

import { inspectCodexApiUsageSource } from "../src/account/codex-home-auth.js";
import {
  codexApiUsageUrl,
  extractCodexApiUsage,
  inspectCodexApiAccountCredits,
  projectCodexApiUsageToCredits,
} from "../src/account/codex-api-usage.js";

describe("Codex API usage", () => {
  it("joins /v1/usage onto a provider base URL and dedupes an existing /v1 suffix", () => {
    expect(codexApiUsageUrl("https://example.invalid")).toBe("https://example.invalid/v1/usage");
    expect(codexApiUsageUrl("https://example.invalid/v1/")).toBe("https://example.invalid/v1/usage");
  });

  it("extracts remaining, unit, and validity from the native usage payload", () => {
    expect(
      extractCodexApiUsage({
        remaining: 12.5,
        unit: "USD",
        is_active: true,
      }),
    ).toEqual({ remaining: 12.5, unit: "USD" });
    expect(extractCodexApiUsage({ quota: { remaining: "8", unit: "credits" } })).toEqual({
      remaining: 8,
      unit: "credits",
    });
    expect(extractCodexApiUsage({ balance: 0 })).toEqual({ remaining: 0, unit: "USD" });
    expect(() => extractCodexApiUsage({ remaining: 1, isValid: false })).toThrow(
      /inactive/u,
    );
  });

  it("reads API usage credentials from the local provider without putting the secret in auth summaries", () => {
    const source = inspectCodexApiUsageSource({
      configToml: `
model_provider = "bank"
[model_providers.bank]
name = "BANK OF TOKEN"
base_url = "https://example.invalid/v1"
experimental_bearer_token = "sk-fixture-token"
`,
    });
    expect(source).toEqual({
      baseUrl: "https://example.invalid/v1",
      apiKey: "sk-fixture-token",
    });
  });

  it("queries GET /v1/usage with the bearer token and projects remaining credits", async () => {
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://example.invalid/v1/usage");
      expect(init.method).toBe("GET");
      expect(init.headers).toMatchObject({ Authorization: "Bearer sk-fixture-token" });
      return {
        ok: true,
        json: async () => ({ remaining: 42.125, unit: "USD", is_active: true }),
      } as Response;
    });
    await expect(
      inspectCodexApiAccountCredits("/tmp/unused", {
        fetch: fetchImpl as typeof fetch,
        source: { baseUrl: "https://example.invalid", apiKey: "sk-fixture-token" },
      }),
    ).resolves.toEqual(projectCodexApiUsageToCredits({ remaining: 42.125, unit: "USD" }));
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
