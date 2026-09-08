import type { AccountCreditsSnapshot } from "@codexhost/shared-contracts";

import {
  inspectCodexHomeApiUsageSource,
  type CodexApiUsageSource,
} from "./codex-home-auth.js";

const REQUEST_TIMEOUT_MS = 15_000;

export interface CodexApiUsageSnapshot {
  readonly remaining: number;
  readonly unit: string;
}

export interface InspectCodexApiUsageInput {
  readonly fetch?: typeof fetch;
  readonly env?: NodeJS.ProcessEnv;
  readonly signal?: AbortSignal;
  readonly source?: CodexApiUsageSource | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function boolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function codexApiUsageUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/u, "");
  if (!trimmed) throw new Error("Codex API usage base URL is empty");
  const withPath = /\/v1$/iu.test(trimmed) ? `${trimmed}/usage` : `${trimmed}/v1/usage`;
  const parsed = new URL(withPath);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Codex API usage URL must be http or https");
  }
  return parsed.toString();
}

export function extractCodexApiUsage(response: unknown): CodexApiUsageSnapshot | null {
  if (!isRecord(response)) return null;
  const quota = isRecord(response.quota) ? response.quota : undefined;
  const remaining =
    finiteNumber(response.remaining) ??
    finiteNumber(quota?.remaining) ??
    finiteNumber(response.balance);
  if (remaining === undefined) return null;
  const isValid = boolean(response.is_active) ?? boolean(response.isValid) ?? true;
  if (!isValid) throw new Error("Codex API usage is inactive");
  return {
    remaining,
    unit: text(response.unit) ?? text(quota?.unit) ?? "USD",
  };
}

export function projectCodexApiUsageToCredits(
  usage: CodexApiUsageSnapshot,
): AccountCreditsSnapshot {
  return {
    remaining: usage.remaining,
    unit: usage.unit,
    periodType: "unknown",
  };
}

export async function inspectCodexApiAccountCredits(
  codexHome: string,
  input: InspectCodexApiUsageInput = {},
): Promise<AccountCreditsSnapshot | null> {
  const source =
    input.source === undefined
      ? await inspectCodexHomeApiUsageSource(codexHome, input.env)
      : input.source;
  if (!source) return null;
  const fetchImpl = input.fetch ?? fetch;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
  const response = await fetchImpl(codexApiUsageUrl(source.baseUrl), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${source.apiKey}`,
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Codex API usage request failed (${response.status})`);
  }
  const usage = extractCodexApiUsage(await response.json());
  return usage ? projectCodexApiUsageToCredits(usage) : null;
}
