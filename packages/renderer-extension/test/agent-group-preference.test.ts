import { describe, expect, it } from "vitest";

import {
  AGENT_GROUP_PREFERENCE_STORAGE_KEY,
  createAgentGroupPreferenceStore,
  DEFAULT_MAIN_EXTERNAL_AGENTS,
  defaultAgentGroupSection,
  partitionAgentsByInstallStatus,
  type AgentGroupEntry,
} from "../src/agent-group-preference.js";
import { KNOWN_RENDERER_AGENTS, type ExternalRendererAgent } from "../src/agent-selection-state.js";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? (data.get(key) ?? null) : null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

describe("partitionAgentsByInstallStatus", () => {
  it("keeps installed agents ahead of uninstalled ones while preserving relative order", () => {
    const installed = new Set<ExternalRendererAgent>(["claude-code", "grok"]);
    const entries: AgentGroupEntry[] = [
      { agent: "pi", section: "main" },
      { agent: "claude-code", section: "main" },
      { agent: "opencode", section: "main" },
      { agent: "grok", section: "main" },
    ];
    expect(
      partitionAgentsByInstallStatus(entries, (agent) => installed.has(agent)).map(
        (entry) => entry.agent,
      ),
    ).toEqual(["claude-code", "grok", "pi", "opencode"]);
  });

  it("returns the original relative order when every agent shares an install state", () => {
    const entries: AgentGroupEntry[] = [
      { agent: "pi", section: "more" },
      { agent: "omp", section: "more" },
    ];
    expect(partitionAgentsByInstallStatus(entries, () => true).map((entry) => entry.agent)).toEqual(
      ["pi", "omp"],
    );
    expect(
      partitionAgentsByInstallStatus(entries, () => false).map((entry) => entry.agent),
    ).toEqual(["pi", "omp"]);
  });

  it("handles an empty list", () => {
    expect(partitionAgentsByInstallStatus([], () => true)).toEqual([]);
  });
});

describe("AgentGroupPreferenceStore defaults", () => {
  it("puts featured Agents in Main and the rest in More on first run", () => {
    const store = createAgentGroupPreferenceStore(memoryStorage());
    const featured = new Set<string>(DEFAULT_MAIN_EXTERNAL_AGENTS);
    for (const agent of KNOWN_RENDERER_AGENTS) {
      if (agent === "codex") continue;
      expect(store.sectionOf(agent)).toBe(featured.has(agent) ? "main" : "more");
      expect(defaultAgentGroupSection(agent)).toBe(store.sectionOf(agent));
    }
    expect(
      store
        .list()
        .filter((entry) => entry.section === "main")
        .map((entry) => entry.agent),
    ).toEqual(["pi", "claude-code", "opencode", "grok", "hermes"]);
  });

  it("keeps a saved preference and defaults later Harnesses with the first-run rule", () => {
    const storage = memoryStorage({
      [AGENT_GROUP_PREFERENCE_STORAGE_KEY]: JSON.stringify([
        { agent: "omp", section: "main" },
        { agent: "pi", section: "more" },
      ]),
    });
    const store = createAgentGroupPreferenceStore(storage);
    expect(store.sectionOf("omp")).toBe("main");
    expect(store.sectionOf("pi")).toBe("more");
    expect(store.sectionOf("claude-code")).toBe("main");
    expect(store.sectionOf("qoder")).toBe("more");
    expect(store.sectionOf("muse")).toBe("more");
  });

  it("resetToDefault restores the featured / More split", () => {
    const store = createAgentGroupPreferenceStore(memoryStorage());
    store.moveAgent("omp", "main");
    store.moveAgent("pi", "more");
    store.resetToDefault();
    expect(store.sectionOf("pi")).toBe("main");
    expect(store.sectionOf("omp")).toBe("more");
    expect(store.sectionOf("hermes")).toBe("main");
    expect(store.sectionOf("cursor-cli")).toBe("more");
  });
});

describe("AgentGroupPreferenceStore.reconcileOrder", () => {
  it("persists a normalized order without notifying subscribers", () => {
    const storage = memoryStorage();
    const store = createAgentGroupPreferenceStore(storage);
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.reconcileOrder([
      { agent: "claude-code", section: "main" },
      { agent: "pi", section: "main" },
      { agent: "grok", section: "more" },
    ]);

    expect(notifications).toBe(0);
    expect(store.list().slice(0, 3)).toEqual([
      { agent: "claude-code", section: "main" },
      { agent: "pi", section: "main" },
      { agent: "grok", section: "more" },
    ]);
    expect(store.sectionOf("grok")).toBe("more");
  });

  it("no-ops when the requested order already matches", () => {
    const store = createAgentGroupPreferenceStore(memoryStorage());
    const before = store
      .list()
      .map((entry) => `${entry.agent}:${entry.section}`)
      .join(",");
    store.reconcileOrder([...store.list()]);
    expect(
      store
        .list()
        .map((entry) => `${entry.agent}:${entry.section}`)
        .join(","),
    ).toBe(before);
  });
});
