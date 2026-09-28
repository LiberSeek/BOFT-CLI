import type { HarnessDisplayEntries } from "@codexhost/shared-contracts";
import { KNOWN_RENDERER_AGENTS, type ExternalRendererAgent } from "./agent-selection-state.js";

/** Display-only grouping; never affects installation or availability. */
export type AgentGroupSection = "main" | "more";
export interface AgentGroupEntry {
  readonly agent: ExternalRendererAgent;
  readonly section: AgentGroupSection;
}
export type AgentGroupSyncStatus = "loading" | "ready" | "saving" | "error";
export interface AgentGroupPreferenceStore {
  list(notInstalled?: ReadonlySet<ExternalRendererAgent>): readonly AgentGroupEntry[];
  sectionOf(agent: ExternalRendererAgent, notInstalled?: boolean): AgentGroupSection;
  moveAgent(
    agent: ExternalRendererAgent,
    section: AgentGroupSection,
    beforeAgent?: ExternalRendererAgent | null,
  ): void;
  /**
   * Quietly rewrite order + sections when the caller has already computed a
   * display-normalized list (e.g. installed-before-uninstalled). Updates memory
   * without notifying subscribers — the caller is expected to already be
   * rendering `entries`. When the Host writer is ready, the same list is
   * committed for confirmation. Does not write localStorage.
   */
  reconcileOrder(entries: readonly AgentGroupEntry[]): void;
  resetToDefault(): void;
  subscribe(listener: () => void): () => void;
  legacyEntries(): HarnessDisplayEntries;
  replace(entries: HarnessDisplayEntries): void;
  syncStatus(): AgentGroupSyncStatus;
  setSyncStatus(status: AgentGroupSyncStatus): void;
  setWriter(writer: ((entries: HarnessDisplayEntries) => void) | null): void;
}

/**
 * Stable-partition `entries` into installed agents first, then uninstalled,
 * preserving relative order within each bucket. Used by Connections and the
 * Agent picker so the two surfaces never mix install states.
 */
export function partitionAgentsByInstallStatus<T extends { agent: ExternalRendererAgent }>(
  entries: readonly T[],
  isInstalled: (agent: ExternalRendererAgent) => boolean,
): T[] {
  const installed: T[] = [];
  const uninstalled: T[] = [];
  for (const entry of entries) {
    (isInstalled(entry.agent) ? installed : uninstalled).push(entry);
  }
  return [...installed, ...uninstalled];
}

export const AGENT_GROUP_PREFERENCE_STORAGE_KEY = "codexhost.agentGroupPreference.v1";

/**
 * First-run Main group. Everything else starts in More so a fresh install
 * does not dump every uninstalled Harness into the picker. Saved preferences
 * and explicit drags still win; this only fills in `auto` entries and
 * `resetToDefault()` after the Host confirms an empty list.
 */
export const DEFAULT_MAIN_EXTERNAL_AGENTS = [
  "claude-code",
  "grok",
  "pi",
  "hermes",
  "opencode",
] as const satisfies readonly ExternalRendererAgent[];

const DEFAULT_MAIN_EXTERNAL_AGENT_SET = new Set<ExternalRendererAgent>(
  DEFAULT_MAIN_EXTERNAL_AGENTS,
);

export function defaultAgentGroupSection(agent: ExternalRendererAgent): AgentGroupSection {
  return DEFAULT_MAIN_EXTERNAL_AGENT_SET.has(agent) ? "main" : "more";
}

const EXTERNAL_AGENTS: readonly ExternalRendererAgent[] = KNOWN_RENDERER_AGENTS.filter(
  (agent): agent is ExternalRendererAgent => agent !== "codex",
);

function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function resolvedSection(
  section: "main" | "more" | "auto" | undefined,
  agent: ExternalRendererAgent,
  notInstalled: boolean,
): AgentGroupSection {
  if (section && section !== "auto") return section;
  if (notInstalled) return "more";
  return defaultAgentGroupSection(agent);
}

/** Host-confirmed state stays in memory; localStorage is read only for migration. */
export function createAgentGroupPreferenceStore(
  storage: Pick<Storage, "getItem"> | null = safeLocalStorage(),
): AgentGroupPreferenceStore {
  const normalize = (input: HarnessDisplayEntries): HarnessDisplayEntries => {
    const seen = new Set<string>();
    const result = input.filter((entry) => {
      if (seen.has(entry.agent)) return false;
      seen.add(entry.agent);
      return true;
    });
    for (const agent of EXTERNAL_AGENTS) {
      if (!seen.has(agent)) result.push({ agent, section: "auto" });
    }
    return result;
  };
  const legacyEntries = (): HarnessDisplayEntries => {
    try {
      const value: unknown = JSON.parse(
        storage?.getItem(AGENT_GROUP_PREFERENCE_STORAGE_KEY) ?? "null",
      );
      if (Array.isArray(value)) {
        return normalize(
          value.filter(
            (entry): entry is HarnessDisplayEntries[number] =>
              entry &&
              typeof entry.agent === "string" &&
              ["main", "more", "auto"].includes(entry.section),
          ),
        );
      }
    } catch {
      /* Missing or inaccessible legacy data uses the default order. */
    }
    return normalize([]);
  };
  let entries: HarnessDisplayEntries = normalize([]);
  let status: AgentGroupSyncStatus = "loading";
  let writer: ((entries: HarnessDisplayEntries) => void) | null = null;
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };
  const replace = (input: HarnessDisplayEntries): void => {
    const next = normalize(input);
    if (JSON.stringify(next) === JSON.stringify(entries)) return;
    entries = next;
    notify();
  };
  const commit = (next: HarnessDisplayEntries): void => {
    if (status !== "ready" && status !== "error") return;
    writer?.(next);
  };
  const project = (notInstalled?: ReadonlySet<ExternalRendererAgent>): AgentGroupEntry[] =>
    entries
      .filter((entry) => (EXTERNAL_AGENTS as readonly string[]).includes(entry.agent))
      .map((entry) => {
        const agent = entry.agent as ExternalRendererAgent;
        return {
          agent,
          section: resolvedSection(entry.section, agent, notInstalled?.has(agent) ?? false),
        };
      });
  return {
    legacyEntries,
    replace,
    syncStatus: () => status,
    setSyncStatus(next) {
      if (status !== next) {
        status = next;
        notify();
      }
    },
    setWriter(next) {
      writer = next;
    },
    list(notInstalled) {
      return project(notInstalled);
    },
    sectionOf(agent, notInstalled = false) {
      const section = entries.find((entry) => entry.agent === agent)?.section;
      return resolvedSection(section, agent, notInstalled);
    },
    moveAgent(agent, section, beforeAgent = null) {
      if (!EXTERNAL_AGENTS.includes(agent)) return;
      const next = entries.filter((entry) => entry.agent !== agent);
      const index =
        beforeAgent && beforeAgent !== agent
          ? next.findIndex((entry) => entry.agent === beforeAgent)
          : -1;
      const moved = { agent, section };
      if (index >= 0) next.splice(index, 0, moved);
      else next.push(moved);
      commit(next);
    },
    reconcileOrder(requested) {
      const seen = new Set<ExternalRendererAgent>();
      const next: HarnessDisplayEntries = [];
      for (const entry of requested) {
        if (!EXTERNAL_AGENTS.includes(entry.agent) || seen.has(entry.agent)) continue;
        seen.add(entry.agent);
        next.push({ agent: entry.agent, section: entry.section });
      }
      for (const existing of entries) {
        const agent = existing.agent as ExternalRendererAgent;
        if (seen.has(agent) || !EXTERNAL_AGENTS.includes(agent)) continue;
        seen.add(agent);
        next.push(existing);
      }
      for (const agent of EXTERNAL_AGENTS) {
        if (!seen.has(agent)) next.push({ agent, section: "auto" });
      }
      const normalized = normalize(next);
      const currentVisible = project();
      const nextVisible = normalized
        .filter((entry) => (EXTERNAL_AGENTS as readonly string[]).includes(entry.agent))
        .map((entry) => {
          const agent = entry.agent as ExternalRendererAgent;
          return {
            agent,
            section: resolvedSection(entry.section, agent, false),
          };
        });
      const sameVisible =
        currentVisible.length === nextVisible.length &&
        currentVisible.every(
          (entry, index) =>
            entry.agent === nextVisible[index]?.agent &&
            entry.section === nextVisible[index]?.section,
        );
      if (sameVisible) return;
      entries = normalized;
      commit(normalized);
    },
    resetToDefault() {
      commit([]);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

let sharedStore: AgentGroupPreferenceStore | null = null;
export function getSharedAgentGroupPreferenceStore(): AgentGroupPreferenceStore {
  if (!sharedStore) sharedStore = createAgentGroupPreferenceStore();
  return sharedStore;
}
