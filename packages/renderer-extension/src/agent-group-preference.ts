import { KNOWN_RENDERER_AGENTS, type ExternalRendererAgent } from "./agent-selection-state.js";

/**
 * Where an external Agent currently lives from the user's point of view:
 * - "main": shown directly in the Agent picker and the Connections list.
 * - "more": folded away under a collapsible "More Agents" group so the
 *   picker stays short as the number of supported Harnesses grows.
 *
 * This is a purely presentational preference. It never affects whether an
 * Agent is installed, enabled, or reachable — those remain governed by
 * `enabledAgents` / `RendererAgentAvailability` elsewhere.
 */
export type AgentGroupSection = "main" | "more";

export interface AgentGroupEntry {
  readonly agent: ExternalRendererAgent;
  readonly section: AgentGroupSection;
}

export interface AgentGroupPreferenceStore {
  /** All known external Agents, in display order, each tagged with its section. */
  list(): readonly AgentGroupEntry[];
  sectionOf(agent: ExternalRendererAgent): AgentGroupSection;
  /**
   * Move `agent` into `section`. When `beforeAgent` is provided the Agent is
   * inserted immediately before it (both must end up in the same section);
   * otherwise it is appended to the end of the target section.
   */
  moveAgent(
    agent: ExternalRendererAgent,
    section: AgentGroupSection,
    beforeAgent?: ExternalRendererAgent | null,
  ): void;
  /**
   * Quietly rewrite order + sections when the caller has already computed a
   * display-normalized list (e.g. installed-before-uninstalled). Persists but
   * does not notify subscribers — the caller is expected to already be
   * rendering `entries`.
   */
  reconcileOrder(entries: readonly AgentGroupEntry[]): void;
  resetToDefault(): void;
  subscribe(listener: () => void): () => void;
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

const EXTERNAL_AGENTS: readonly ExternalRendererAgent[] = KNOWN_RENDERER_AGENTS.filter(
  (agent): agent is ExternalRendererAgent => agent !== "codex",
);

interface StoredEntry {
  readonly agent: string;
  readonly section: AgentGroupSection;
}

function isKnownExternalAgent(value: unknown): value is ExternalRendererAgent {
  return typeof value === "string" && (EXTERNAL_AGENTS as readonly string[]).includes(value);
}

function isStoredEntry(value: unknown): value is StoredEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredEntry>;
  return (
    isKnownExternalAgent(candidate.agent) &&
    (candidate.section === "main" || candidate.section === "more")
  );
}

function readStorage(storage: Pick<Storage, "getItem"> | null): StoredEntry[] | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(AGENT_GROUP_PREFERENCE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isStoredEntry);
  } catch {
    return null;
  }
}

function writeStorage(
  storage: Pick<Storage, "setItem"> | null,
  entries: readonly StoredEntry[],
): void {
  if (!storage) return;
  try {
    storage.setItem(AGENT_GROUP_PREFERENCE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Best effort only: private browsing / quota errors should not break the UI.
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Creates an isolated preference store. Pass an explicit `storage` (or
 * `null`) in tests to avoid touching the real `localStorage` and to keep
 * cases independent from one another.
 */
export function createAgentGroupPreferenceStore(
  storage: Storage | null = safeLocalStorage(),
): AgentGroupPreferenceStore {
  let order: ExternalRendererAgent[] = [...EXTERNAL_AGENTS];
  let sections = new Map<ExternalRendererAgent, AgentGroupSection>(
    EXTERNAL_AGENTS.map((agent) => [agent, "main" as AgentGroupSection]),
  );
  const listeners = new Set<() => void>();

  const stored = readStorage(storage);
  if (stored && stored.length > 0) {
    const seen = new Set<ExternalRendererAgent>();
    const nextOrder: ExternalRendererAgent[] = [];
    for (const entry of stored) {
      const agent = entry.agent as ExternalRendererAgent;
      if (seen.has(agent)) continue;
      seen.add(agent);
      nextOrder.push(agent);
      sections.set(agent, entry.section);
    }
    // Agents that shipped after the user last saved a preference (new
    // Harnesses) default to "main" and land at the end of the list.
    for (const agent of EXTERNAL_AGENTS) {
      if (!seen.has(agent)) nextOrder.push(agent);
    }
    order = nextOrder;
  }

  const persist = (): void => {
    writeStorage(
      storage,
      order.map((agent) => ({ agent, section: sections.get(agent) ?? "main" })),
    );
  };
  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };

  return {
    list() {
      return order.map((agent) => ({ agent, section: sections.get(agent) ?? "main" }));
    },
    sectionOf(agent) {
      return sections.get(agent) ?? "main";
    },
    moveAgent(agent, section, beforeAgent = null) {
      if (!EXTERNAL_AGENTS.includes(agent)) return;
      order = order.filter((candidate) => candidate !== agent);
      const insertAt = beforeAgent && beforeAgent !== agent ? order.indexOf(beforeAgent) : -1;
      if (insertAt >= 0) order.splice(insertAt, 0, agent);
      else order.push(agent);
      sections.set(agent, section);
      persist();
      notify();
    },
    reconcileOrder(entries) {
      const nextOrder: ExternalRendererAgent[] = [];
      const nextSections = new Map<ExternalRendererAgent, AgentGroupSection>();
      const seen = new Set<ExternalRendererAgent>();
      for (const entry of entries) {
        if (!EXTERNAL_AGENTS.includes(entry.agent) || seen.has(entry.agent)) continue;
        seen.add(entry.agent);
        nextOrder.push(entry.agent);
        nextSections.set(entry.agent, entry.section);
      }
      for (const agent of EXTERNAL_AGENTS) {
        if (seen.has(agent)) continue;
        nextOrder.push(agent);
        nextSections.set(agent, sections.get(agent) ?? "main");
      }
      const unchanged =
        nextOrder.length === order.length &&
        nextOrder.every(
          (agent, index) =>
            agent === order[index] && (nextSections.get(agent) ?? "main") === (sections.get(agent) ?? "main"),
        );
      if (unchanged) return;
      order = nextOrder;
      sections = nextSections;
      persist();
    },
    resetToDefault() {
      order = [...EXTERNAL_AGENTS];
      sections = new Map(EXTERNAL_AGENTS.map((agent) => [agent, "main" as AgentGroupSection]));
      persist();
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

let sharedStore: AgentGroupPreferenceStore | null = null;

/** Shared singleton so the Connections settings page and every Agent picker stay in sync. */
export function getSharedAgentGroupPreferenceStore(): AgentGroupPreferenceStore {
  if (!sharedStore) sharedStore = createAgentGroupPreferenceStore();
  return sharedStore;
}
