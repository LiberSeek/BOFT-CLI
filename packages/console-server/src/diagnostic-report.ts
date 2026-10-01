import os from "node:os";

import type {
  ConsoleSummary,
  ControllerStatus,
  LogFileEntry,
  StartupRecord,
} from "./diagnostics.js";
import type { InspectDocument } from "./installation.js";

export const REPORT_LOG_TAIL_BYTES = 32 * 1024;
const REPORT_LOG_FILES = 2;
const REPORT_STARTUP_RECORDS = 5;

export interface DiagnosticInput {
  consoleVersion: string;
  distribution: { version: string; distribution: string; target: string } | null;
  summary: ConsoleSummary;
  inspect: InspectDocument | null;
  inspectError: string | null;
  startup: StartupRecord[];
  controller: ControllerStatus | null;
  controllerAlive: boolean;
  logs: LogFileEntry[];
}

export interface DiagnosticReport {
  schemaVersion: 1;
  generatedAt: string;
  platform: { os: NodeJS.Platform; arch: string; release: string };
  codexhost: { version: string; distribution: string | null; target: string | null };
  summary: ConsoleSummary;
  desktop: InspectDocument["desktop"];
  desktopError: string | null;
  runtime: { running: boolean } | null;
  inspectError: string | null;
  controller: (ControllerStatus & { alive: boolean }) | null;
  startup: StartupRecord[];
  logs: { name: string; size: number; tail: string }[];
}

/** Replaces the home directory with `~` everywhere, including JSON-escaped Windows paths. */
export function redactHome(text: string, home: string = os.homedir()): string {
  if (!home || home === "/" || home.length < 3) return text;
  const variants = new Set([home, JSON.stringify(home).slice(1, -1)]);
  let result = text;
  for (const variant of variants) result = result.split(variant).join("~");
  return result;
}

export async function buildDiagnosticReport(
  input: DiagnosticInput,
  readTail: (name: string, maxBytes: number) => Promise<string | null>,
  now: () => Date = () => new Date(),
): Promise<DiagnosticReport> {
  const logs: DiagnosticReport["logs"] = [];
  for (const entry of input.logs.slice(0, REPORT_LOG_FILES)) {
    const tail = await readTail(entry.name, REPORT_LOG_TAIL_BYTES);
    if (tail !== null) logs.push({ name: entry.name, size: entry.size, tail });
  }
  return {
    schemaVersion: 1,
    generatedAt: now().toISOString(),
    platform: { os: process.platform, arch: process.arch, release: os.release() },
    codexhost: {
      version: input.distribution?.version ?? input.consoleVersion,
      distribution: input.distribution?.distribution ?? null,
      target: input.distribution?.target ?? null,
    },
    summary: input.summary,
    desktop: input.inspect?.desktop ?? null,
    desktopError: input.inspect?.desktopError ?? null,
    runtime: input.inspect ? { running: input.inspect.runtime.running } : null,
    inspectError: input.inspectError,
    controller: input.controller ? { ...input.controller, alive: input.controllerAlive } : null,
    startup: input.startup.slice(0, REPORT_STARTUP_RECORDS),
    logs,
  };
}

/** Serialized report with the home directory redacted. */
export function serializeDiagnosticReport(report: DiagnosticReport, home?: string): string {
  return redactHome(`${JSON.stringify(report, null, 2)}\n`, home);
}
