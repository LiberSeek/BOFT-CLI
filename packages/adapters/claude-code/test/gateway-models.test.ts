import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  applyGatewayModelCatalog,
  customAnthropicBaseUrl,
  gatewayModelsUrl,
  readClaudeUserSettingsEnv,
} from "../src/gateway-models.js";

const sdkSnapshot = {
  models: [
    {
      value: "default",
      displayName: "Default (recommended)",
      description: "ignored",
      supportsAutoMode: true,
    },
    { value: "opus", displayName: "Opus" },
    { value: "haiku", displayName: "Haiku" },
  ],
  canSelectModel: true,
  canSelectPermissionMode: true,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Claude gateway Model catalog", () => {
  it("treats missing or official Anthropic endpoints as account mode", () => {
    expect(customAnthropicBaseUrl({})).toBeUndefined();
    expect(
      customAnthropicBaseUrl({ ANTHROPIC_BASE_URL: "https://api.anthropic.com" }),
    ).toBeUndefined();
    expect(
      customAnthropicBaseUrl({ ANTHROPIC_BASE_URL: "https://api.anthropic.com/v1" }),
    ).toBeUndefined();
    expect(customAnthropicBaseUrl({ ANTHROPIC_BASE_URL: "not a url" })).toBeUndefined();
    expect(customAnthropicBaseUrl({ ANTHROPIC_BASE_URL: "https://api.boft.ai/" })).toBe(
      "https://api.boft.ai",
    );
  });

  it("builds the Anthropic-compatible /v1/models URL from the configured base", () => {
    expect(gatewayModelsUrl("https://api.boft.ai")).toBe(
      "https://api.boft.ai/v1/models?limit=1000",
    );
    expect(gatewayModelsUrl("https://api.boft.ai/v1")).toBe(
      "https://api.boft.ai/v1/models?limit=1000",
    );
  });

  it("keeps the SDK catalog when ANTHROPIC_BASE_URL is not a custom gateway", async () => {
    const fetch = vi.fn();
    await expect(
      applyGatewayModelCatalog(
        sdkSnapshot,
        { ANTHROPIC_BASE_URL: "https://api.anthropic.com" },
        {
          fetch,
          readUserSettingsEnv: async () => ({}),
        },
      ),
    ).resolves.toBe(sdkSnapshot);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("replaces alias rows with live /v1/models while keeping Default and Auto mode", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://gateway.example/v1/models?limit=1000");
      expect(init).toMatchObject({
        method: "GET",
        redirect: "error",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer secret-token",
          "x-api-key": "secret-key",
        },
      });
      return jsonResponse({
        data: [
          { id: "claude-sonnet-5", display_name: "Sonnet 5" },
          { id: "gpt-5.4" },
          { id: "default", display_name: "should-not-replace-default" },
          { id: "gpt-5.4", display_name: "duplicate" },
          { id: "" },
          { display_name: "missing-id" },
        ],
      });
    });

    const result = await applyGatewayModelCatalog(
      sdkSnapshot,
      {
        ANTHROPIC_BASE_URL: "https://gateway.example/",
        ANTHROPIC_AUTH_TOKEN: "secret-token",
        ANTHROPIC_API_KEY: "secret-key",
      },
      { fetch, readUserSettingsEnv: async () => ({}) },
    );

    expect(result).toEqual({
      models: [
        {
          value: "default",
          displayName: "Default (recommended)",
          description: "ignored",
          supportsAutoMode: true,
        },
        { value: "claude-sonnet-5", displayName: "Sonnet 5" },
        { value: "gpt-5.4", displayName: "gpt-5.4" },
      ],
      canSelectModel: true,
      canSelectPermissionMode: true,
    });
    expect(JSON.stringify(result)).not.toMatch(/secret-token|secret-key/u);
  });

  it("falls back to the SDK catalog when the gateway request fails", async () => {
    await expect(
      applyGatewayModelCatalog(
        sdkSnapshot,
        { ANTHROPIC_BASE_URL: "https://gateway.example" },
        {
          fetch: async () => jsonResponse({ data: [] }, 401),
          readUserSettingsEnv: async () => ({}),
        },
      ),
    ).resolves.toBe(sdkSnapshot);
    await expect(
      applyGatewayModelCatalog(
        sdkSnapshot,
        { ANTHROPIC_BASE_URL: "https://gateway.example" },
        {
          fetch: async () => {
            throw new Error("timeout");
          },
          readUserSettingsEnv: async () => ({}),
        },
      ),
    ).resolves.toBe(sdkSnapshot);
  });

  it("fills missing gateway env from Claude user settings without overriding Host values", async () => {
    const directory = path.join(os.tmpdir(), `claude-gateway-${Date.now()}`);
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "settings.json"),
      `${JSON.stringify({
        env: {
          ANTHROPIC_BASE_URL: "https://from-settings.example",
          ANTHROPIC_AUTH_TOKEN: "settings-token",
          ANTHROPIC_API_KEY: "settings-key",
        },
      })}\n`,
    );

    const fromSettings = await readClaudeUserSettingsEnv({ CLAUDE_CONFIG_DIR: directory });
    expect(fromSettings).toEqual({
      ANTHROPIC_BASE_URL: "https://from-settings.example",
      ANTHROPIC_AUTH_TOKEN: "settings-token",
      ANTHROPIC_API_KEY: "settings-key",
    });

    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://from-settings.example/v1/models?limit=1000");
      expect(init?.headers).toMatchObject({ Authorization: "Bearer settings-token" });
      return jsonResponse({ data: [{ id: "claude-opus-5", name: "Opus 5" }] });
    });
    const result = await applyGatewayModelCatalog(
      sdkSnapshot,
      { CLAUDE_CONFIG_DIR: directory },
      { fetch, readUserSettingsEnv: readClaudeUserSettingsEnv },
    );
    expect(result.models).toEqual([
      {
        value: "default",
        displayName: "Default (recommended)",
        description: "ignored",
        supportsAutoMode: true,
      },
      { value: "claude-opus-5", displayName: "Opus 5" },
    ]);

    const ignored = vi.fn(async () => jsonResponse({ data: [] }));
    await applyGatewayModelCatalog(
      sdkSnapshot,
      {
        ANTHROPIC_BASE_URL: "https://api.anthropic.com",
        CLAUDE_CONFIG_DIR: directory,
      },
      { fetch: ignored, readUserSettingsEnv: readClaudeUserSettingsEnv },
    );
    expect(ignored).not.toHaveBeenCalled();
  });
});
