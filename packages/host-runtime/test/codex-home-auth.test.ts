import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CODEX_API_AUTH_IDENTITY_FALLBACK,
  inspectCodexApiUsageSource,
  inspectCodexAuthDocuments,
  inspectCodexHomeAuth,
} from "../src/account/codex-home-auth.js";

describe("Codex home auth inspection", () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it("treats auth.json api_key as API auth without exposing the secret", () => {
    const inspection = inspectCodexAuthDocuments({
      authJson: JSON.stringify({ api_key: "sk-secret" }),
    });
    expect(inspection).toEqual({ kind: "api", identity: CODEX_API_AUTH_IDENTITY_FALLBACK });
    expect(JSON.stringify(inspection)).not.toMatch(/sk-secret/u);
  });

  it("treats ChatGPT tokens as account auth", () => {
    expect(
      inspectCodexAuthDocuments({
        authJson: JSON.stringify({ tokens: { access_token: "secret-token" } }),
      }),
    ).toEqual({ kind: "chatgpt", identity: "" });
  });

  it("prefers API when both credentials exist and preferred_auth_method is apikey", () => {
    expect(
      inspectCodexAuthDocuments({
        configToml: 'preferred_auth_method = "apikey"\n',
        authJson: JSON.stringify({ api_key: "sk-secret", tokens: { access_token: "secret-token" } }),
      }),
    ).toMatchObject({ kind: "api" });
  });

  it("prefers ChatGPT when both credentials exist without an apikey preference", () => {
    expect(
      inspectCodexAuthDocuments({
        configToml: 'preferred_auth_method = "chatgpt"\n',
        authJson: JSON.stringify({ api_key: "sk-secret", tokens: { access_token: "secret-token" } }),
      }),
    ).toMatchObject({ kind: "chatgpt" });
  });

  it("uses the configured model provider name as the API identity", () => {
    expect(
      inspectCodexAuthDocuments({
        configToml: `
model_provider = "bank"
preferred_auth_method = "apikey"

[model_providers.bank]
name = "BANK OF TOKEN"
base_url = "https://example.invalid/v1"
`,
        authJson: JSON.stringify({ api_key: "sk-secret" }),
      }),
    ).toEqual({ kind: "api", identity: "BANK OF TOKEN" });
  });

  it("reads API usage credentials from the provider table without exposing them in the auth summary", () => {
    const configToml = `
model_provider = "codex-for-me"
[model_providers.codex-for-me]
name = "BANK OF TOKEN"
base_url = "https://example.invalid"
requires_openai_auth = false
experimental_bearer_token = "sk-fixture-token"
`;
    const inspection = inspectCodexAuthDocuments({ configToml });
    expect(inspection).toEqual({ kind: "api", identity: "BANK OF TOKEN" });
    expect(JSON.stringify(inspection)).not.toMatch(/sk-fixture-token/u);
    expect(inspectCodexApiUsageSource({ configToml })).toEqual({
      baseUrl: "https://example.invalid",
      apiKey: "sk-fixture-token",
    });
  });

  it("treats a custom provider with a local bearer token as API auth without exposing the token", () => {
    const inspection = inspectCodexAuthDocuments({
      configToml: `
model_provider = "codex-for-me"
model = "gpt-5.6-sol"

[model_providers.codex-for-me]
name = "BANK OF TOKEN"
base_url = "https://example.invalid"
wire_api = "responses"
requires_openai_auth = false
experimental_bearer_token = "sk-fixture-token"
`,
    });
    expect(inspection).toEqual({ kind: "api", identity: "BANK OF TOKEN" });
    expect(JSON.stringify(inspection)).not.toMatch(/sk-fixture-token/u);
  });

  it("reads CODEX_HOME config.toml and auth.json from disk", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "codexhost-home-auth-"));
    directories.push(directory);
    await writeFile(
      path.join(directory, "config.toml"),
      'preferred_auth_method = "apikey"\nmodel_provider = "openai"\n',
    );
    await writeFile(path.join(directory, "auth.json"), `${JSON.stringify({ api_key: "sk-secret" })}\n`);
    await expect(inspectCodexHomeAuth(directory)).resolves.toEqual({
      kind: "api",
      identity: CODEX_API_AUTH_IDENTITY_FALLBACK,
    });
  });
});
