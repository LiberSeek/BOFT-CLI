import { readFile } from "node:fs/promises";
import path from "node:path";

export const CODEX_API_AUTH_IDENTITY_FALLBACK = "BANK OF TOKEN";

export type CodexHomeAuthKind = "api" | "chatgpt";

export interface CodexHomeAuthInspection {
  readonly kind: CodexHomeAuthKind;
  readonly identity: string;
}

function tomlUnquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const quote = trimmed[0];
    if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function tomlTopLevelAssignment(source: string, key: string): string | undefined {
  const pattern = new RegExp(`^${key}\\s*=\\s*(.+)$`, "im");
  let currentTable = "";
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const table = line.match(/^\[([^\]]+)\]$/u);
    if (table) {
      currentTable = table[1] ?? "";
      continue;
    }
    if (currentTable) continue;
    const match = line.match(pattern);
    if (match?.[1]) return tomlUnquote(match[1]);
  }
  return undefined;
}

interface CodexModelProviderAuth {
  readonly id: string;
  readonly name?: string;
  readonly baseUrl?: string;
  readonly bearerToken?: string;
  readonly envKey?: string;
  readonly requiresOpenAiAuth: boolean;
  readonly hasLocalApiCredential: boolean;
}

export interface CodexApiUsageSource {
  readonly baseUrl: string;
  readonly apiKey: string;
}

function tomlBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function tomlProviderTableNames(providerId: string): Set<string> {
  return new Set([
    `model_providers.${providerId}`,
    `model_providers."${providerId}"`,
    `model_providers.'${providerId}'`,
  ]);
}

function parseModelProviderAuth(
  source: string | undefined,
): CodexModelProviderAuth | undefined {
  if (!source) return undefined;
  const providerId = tomlTopLevelAssignment(source, "model_provider");
  if (!providerId) return undefined;
  const tables = tomlProviderTableNames(providerId);
  let currentTable = "";
  let name: string | undefined;
  let baseUrl: string | undefined;
  let bearerToken: string | undefined;
  let envKey: string | undefined;
  let requiresOpenAiAuth: boolean | undefined;
  let hasLocalApiCredential = false;
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const table = line.match(/^\[([^\]]+)\]$/u);
    if (table) {
      currentTable = table[1] ?? "";
      continue;
    }
    if (!tables.has(currentTable)) continue;
    const assignment = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/u);
    if (!assignment) continue;
    const key = assignment[1] ?? "";
    const value = tomlUnquote(assignment[2] ?? "");
    if (key === "name" && value) name = value;
    if (key === "base_url" && value) baseUrl = value;
    if (key === "requires_openai_auth") requiresOpenAiAuth = tomlBoolean(value);
    if (key === "experimental_bearer_token" && value.trim().length > 0) {
      bearerToken = value.trim();
      hasLocalApiCredential = true;
    }
    if (key === "env_key" && value.trim().length > 0) {
      envKey = value.trim();
      hasLocalApiCredential = true;
    }
  }
  return {
    id: providerId,
    ...(name ? { name } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    ...(bearerToken ? { bearerToken } : {}),
    ...(envKey ? { envKey } : {}),
    requiresOpenAiAuth: requiresOpenAiAuth ?? providerId === "openai",
    hasLocalApiCredential,
  };
}

function preferredAuthMethod(config: string | undefined): "apikey" | "chatgpt" | undefined {
  const value = config ? tomlTopLevelAssignment(config, "preferred_auth_method") : undefined;
  if (value === "apikey" || value === "chatgpt") return value;
  return undefined;
}

function isBuiltInOpenAiProvider(providerId: string | undefined): boolean {
  return providerId === "openai" || providerId === "openai-chatgpt";
}

export function inspectCodexAuthDocuments(input: {
  readonly configToml?: string;
  readonly authJson?: string;
}): CodexHomeAuthInspection {
  let hasApiKey = false;
  let hasTokens = false;
  if (input.authJson) {
    try {
      const auth = JSON.parse(input.authJson) as Record<string, unknown>;
      hasApiKey = typeof auth.api_key === "string" && auth.api_key.trim().length > 0;
      hasTokens = Boolean(auth.tokens) && typeof auth.tokens === "object";
    } catch {
      // Ignore malformed auth.json; treat as no local credentials.
    }
  }
  const preferred = preferredAuthMethod(input.configToml);
  const provider = parseModelProviderAuth(input.configToml);
  const usesCustomApiProvider =
    Boolean(provider) &&
    !isBuiltInOpenAiProvider(provider?.id) &&
    provider?.requiresOpenAiAuth === false;
  const kind: CodexHomeAuthKind =
    preferred === "chatgpt" && hasTokens
      ? "chatgpt"
      : hasApiKey && (preferred === "apikey" || !hasTokens)
        ? "api"
        : usesCustomApiProvider || provider?.hasLocalApiCredential
          ? "api"
          : hasTokens
            ? "chatgpt"
            : preferred === "apikey"
              ? "api"
              : "chatgpt";
  if (kind === "api") {
    return {
      kind,
      identity: provider?.name?.trim() || CODEX_API_AUTH_IDENTITY_FALLBACK,
    };
  }
  return { kind, identity: "" };
}

async function readOptionalUtf8(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function authJsonApiKey(authJson: string | undefined): string | undefined {
  if (!authJson) return undefined;
  try {
    const auth = JSON.parse(authJson) as Record<string, unknown>;
    return typeof auth.api_key === "string" && auth.api_key.trim() ? auth.api_key.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Local API credentials for usage queries. Never include this in renderer-facing summaries. */
export function inspectCodexApiUsageSource(input: {
  readonly configToml?: string;
  readonly authJson?: string;
  readonly env?: NodeJS.ProcessEnv;
}): CodexApiUsageSource | null {
  const provider = parseModelProviderAuth(input.configToml);
  const baseUrl = provider?.baseUrl?.trim();
  if (!baseUrl) return null;
  const env = input.env ?? process.env;
  const apiKey =
    provider?.bearerToken?.trim() ||
    authJsonApiKey(input.authJson) ||
    (provider?.envKey ? env[provider.envKey]?.trim() : undefined);
  if (!apiKey) return null;
  return { baseUrl, apiKey };
}

export async function inspectCodexHomeAuth(codexHome: string): Promise<CodexHomeAuthInspection> {
  const root = path.resolve(codexHome);
  const [configToml, authJson] = await Promise.all([
    readOptionalUtf8(path.join(root, "config.toml")),
    readOptionalUtf8(path.join(root, "auth.json")),
  ]);
  return inspectCodexAuthDocuments({
    ...(configToml ? { configToml } : {}),
    ...(authJson ? { authJson } : {}),
  });
}

export async function inspectCodexHomeApiUsageSource(
  codexHome: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CodexApiUsageSource | null> {
  const root = path.resolve(codexHome);
  const [configToml, authJson] = await Promise.all([
    readOptionalUtf8(path.join(root, "config.toml")),
    readOptionalUtf8(path.join(root, "auth.json")),
  ]);
  return inspectCodexApiUsageSource({
    ...(configToml ? { configToml } : {}),
    ...(authJson ? { authJson } : {}),
    env,
  });
}
