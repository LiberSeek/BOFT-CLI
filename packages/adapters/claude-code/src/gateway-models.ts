import { readFile } from "node:fs/promises";
import path from "node:path";

import { HARNESS_MODEL_LABEL_MAX_LENGTH } from "@codexhost/shared-contracts";

import {
  CLAUDE_MODEL_VALUE_MAX_LENGTH,
  type ClaudeModelInspectionSnapshot,
} from "./model-catalog.js";

const GATEWAY_MODELS_TIMEOUT_MS = 3_000;
const GATEWAY_MODELS_MAX_BYTES = 2 * 1024 * 1024;
const OFFICIAL_ANTHROPIC_HOST = "api.anthropic.com";
const SETTINGS_ENV_KEYS = [
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_API_KEY",
] as const;

export interface GatewayCatalogDependencies {
  fetch?: typeof fetch;
  readUserSettingsEnv?: (environment: NodeJS.ProcessEnv) => Promise<Record<string, string>>;
  timeoutMs?: number;
}

function trimmedEnv(environment: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = environment[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function officialAnthropicHost(hostname: string): boolean {
  return hostname.replace(/\.$/u, "").toLowerCase() === OFFICIAL_ANTHROPIC_HOST;
}

export function customAnthropicBaseUrl(environment: NodeJS.ProcessEnv): string | undefined {
  const raw = trimmedEnv(environment, "ANTHROPIC_BASE_URL");
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  if (officialAnthropicHost(url.hostname)) return undefined;
  return raw.replace(/\/+$/u, "");
}

export function gatewayModelsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/u, "");
  const prefix = /\/v1$/iu.test(trimmed) ? trimmed : `${trimmed}/v1`;
  return `${prefix}/models?limit=1000`;
}

function claudeConfigDirectory(environment: NodeJS.ProcessEnv): string | undefined {
  const configured = trimmedEnv(environment, "CLAUDE_CONFIG_DIR");
  if (configured) return configured;
  const home = trimmedEnv(environment, "HOME") ?? trimmedEnv(environment, "USERPROFILE");
  return home ? path.join(home, ".claude") : undefined;
}

export async function readClaudeUserSettingsEnv(
  environment: NodeJS.ProcessEnv,
): Promise<Record<string, string>> {
  const configDir = claudeConfigDirectory(environment);
  if (!configDir) return {};
  try {
    const raw = await readFile(path.join(configDir, "settings.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const env = (parsed as { env?: unknown }).env;
    if (env === null || typeof env !== "object" || Array.isArray(env)) return {};
    const overlay: Record<string, string> = {};
    for (const key of SETTINGS_ENV_KEYS) {
      const value = (env as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim().length > 0) overlay[key] = value;
    }
    return overlay;
  } catch {
    return {};
  }
}

export async function withClaudeGatewayEnvironment(
  environment: NodeJS.ProcessEnv,
  readUserSettingsEnv: GatewayCatalogDependencies["readUserSettingsEnv"] = readClaudeUserSettingsEnv,
): Promise<NodeJS.ProcessEnv> {
  const overlay = await readUserSettingsEnv(environment);
  const merged: NodeJS.ProcessEnv = { ...environment };
  for (const [name, value] of Object.entries(overlay)) {
    if (merged[name] === undefined) merged[name] = value;
  }
  return merged;
}

function boundedLabel(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return trimmed;
  return trimmed.length <= HARNESS_MODEL_LABEL_MAX_LENGTH
    ? trimmed
    : trimmed.slice(0, HARNESS_MODEL_LABEL_MAX_LENGTH);
}

function gatewayRow(value: unknown): { value: string; displayName: string } | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    if (typeof value !== "string") return undefined;
    const id = value.trim();
    if (id.length === 0 || id.length > CLAUDE_MODEL_VALUE_MAX_LENGTH) return undefined;
    const label = boundedLabel(id);
    return label.length === 0 ? undefined : { value: id, displayName: label };
  }
  const record = value as Record<string, unknown>;
  const idCandidate = record.id ?? record.value;
  if (typeof idCandidate !== "string") return undefined;
  const id = idCandidate.trim();
  if (id.length === 0 || id.length > CLAUDE_MODEL_VALUE_MAX_LENGTH) return undefined;
  const labelCandidate =
    (typeof record.display_name === "string" && record.display_name) ||
    (typeof record.displayName === "string" && record.displayName) ||
    (typeof record.name === "string" && record.name) ||
    id;
  const label = boundedLabel(labelCandidate);
  return label.length === 0 ? undefined : { value: id, displayName: label };
}

function nativeDefaultRow(models: unknown): Record<string, unknown> {
  if (Array.isArray(models)) {
    for (const row of models) {
      if (row === null || typeof row !== "object" || Array.isArray(row)) continue;
      const record = row as Record<string, unknown>;
      if (typeof record.value === "string" && record.value.trim() === "default") {
        return { ...record };
      }
    }
  }
  return { value: "default", displayName: "Default" };
}

function nativeSupportsAutoMode(models: unknown): boolean {
  if (!Array.isArray(models)) return false;
  return models.some(
    (row) =>
      row !== null &&
      typeof row === "object" &&
      !Array.isArray(row) &&
      (row as { supportsAutoMode?: unknown }).supportsAutoMode === true,
  );
}

function parseGatewayModels(payload: unknown): Array<{ value: string; displayName: string }> {
  const list = Array.isArray(payload)
    ? payload
    : payload !== null && typeof payload === "object" && !Array.isArray(payload)
      ? ((payload as { data?: unknown; models?: unknown }).data ??
        (payload as { models?: unknown }).models)
      : undefined;
  if (!Array.isArray(list)) return [];
  const rows: Array<{ value: string; displayName: string }> = [];
  const seen = new Set<string>();
  for (const candidate of list) {
    const row = gatewayRow(candidate);
    if (!row || row.value === "default" || seen.has(row.value)) continue;
    seen.add(row.value);
    rows.push(row);
  }
  return rows;
}

export async function applyGatewayModelCatalog(
  snapshot: ClaudeModelInspectionSnapshot,
  environment: NodeJS.ProcessEnv,
  dependencies: GatewayCatalogDependencies = {},
): Promise<ClaudeModelInspectionSnapshot> {
  const resolved = await withClaudeGatewayEnvironment(
    environment,
    dependencies.readUserSettingsEnv,
  );
  const baseUrl = customAnthropicBaseUrl(resolved);
  if (!baseUrl) return snapshot;

  const timeoutMs = dependencies.timeoutMs ?? GATEWAY_MODELS_TIMEOUT_MS;
  const fetchImpl = dependencies.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = trimmedEnv(resolved, "ANTHROPIC_AUTH_TOKEN");
  const apiKey = trimmedEnv(resolved, "ANTHROPIC_API_KEY");
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers["x-api-key"] = apiKey;

  let payload: unknown;
  try {
    const response = await fetchImpl(gatewayModelsUrl(baseUrl), {
      method: "GET",
      headers,
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return snapshot;
    const body = await response.text();
    if (body.length > GATEWAY_MODELS_MAX_BYTES) return snapshot;
    payload = JSON.parse(body) as unknown;
  } catch {
    return snapshot;
  }

  const gatewayRows = parseGatewayModels(payload);
  if (gatewayRows.length === 0) return snapshot;

  const defaultRow = nativeDefaultRow(snapshot.models);
  if (nativeSupportsAutoMode(snapshot.models)) defaultRow.supportsAutoMode = true;
  return {
    ...snapshot,
    models: [defaultRow, ...gatewayRows],
  };
}
