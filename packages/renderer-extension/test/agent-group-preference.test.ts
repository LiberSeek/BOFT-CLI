import { describe, expect, it, vi } from "vitest";
import {
  AGENT_GROUP_PREFERENCE_STORAGE_KEY,
  createAgentGroupPreferenceStore,
  DEFAULT_MAIN_EXTERNAL_AGENTS,
  defaultAgentGroupSection,
  partitionAgentsByInstallStatus,
  type AgentGroupEntry,
} from "../src/agent-group-preference.js";
import { KNOWN_RENDERER_AGENTS, type ExternalRendererAgent } from "../src/agent-selection-state.js";

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
    const store = createAgentGroupPreferenceStore(null);
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

  it("applies featured defaults only after the Host confirms a reset", () => {
    const store = createAgentGroupPreferenceStore(null);
    const writer = vi.fn();
    store.setWriter(writer);
    store.setSyncStatus("ready");
    store.replace([
      { agent: "omp", section: "main" },
      { agent: "pi", section: "more" },
    ]);
    store.resetToDefault();
    expect(writer).toHaveBeenLastCalledWith([]);
    expect(store.sectionOf("pi")).toBe("more");
    store.replace([]);
    expect(store.sectionOf("pi")).toBe("main");
    expect(store.sectionOf("omp")).toBe("more");
    expect(store.sectionOf("hermes")).toBe("main");
    expect(store.sectionOf("cursor-cli")).toBe("more");
  });
});

describe("AgentGroupPreferenceStore.reconcileOrder", () => {
  it("rewrites memory without notifying subscribers", () => {
    const store = createAgentGroupPreferenceStore(null);
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
    const store = createAgentGroupPreferenceStore(null);
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

  it("commits a changed order when the Host writer is ready", () => {
    const store = createAgentGroupPreferenceStore(null);
    const writer = vi.fn();
    store.setWriter(writer);
    store.setSyncStatus("ready");
    store.reconcileOrder([
      { agent: "claude-code", section: "main" },
      { agent: "pi", section: "more" },
    ]);
    expect(writer).toHaveBeenCalledOnce();
    expect(store.sectionOf("pi")).toBe("more");
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    createAgentGroupPreferenceStore(storage).reconcileOrder([{ agent: "pi", section: "more" }]);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe("Host-confirmed Agent grouping", () => {
  it("folds only confirmed missing installations by default", () => {
    const store = createAgentGroupPreferenceStore(null);
    expect(store.list(new Set(["pi"])).find((entry) => entry.agent === "pi")?.section).toBe("more");
    expect(store.sectionOf("pi", true)).toBe("more");
    expect(store.sectionOf("pi", false)).toBe("main");
  });

  it("reads legacy preferences only for migration and never writes browser storage", () => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify([{ agent: "pi", section: "more" }])),
      setItem: vi.fn(),
    };
    const store = createAgentGroupPreferenceStore(storage);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(store.sectionOf("pi")).toBe("main");
    expect(store.legacyEntries()[0]).toEqual({ agent: "pi", section: "more" });
    expect(storage.getItem).toHaveBeenCalledWith(AGENT_GROUP_PREFERENCE_STORAGE_KEY);
    store.replace([{ agent: "grok", section: "more" }]);
    expect(store.sectionOf("grok")).toBe("more");
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("does not modify ordering without a Host writer, including on failure or disposal", () => {
    const store = createAgentGroupPreferenceStore(null);
    const original = store.list();
    for (const status of ["loading", "ready", "error", "saving"] as const) {
      store.setSyncStatus(status);
      store.moveAgent("grok", "more", "pi");
      store.resetToDefault();
      expect(store.list()).toEqual(original);
    }
  });

  it("sends changes to the Host and applies only confirmed results", () => {
    const store = createAgentGroupPreferenceStore(null);
    const writer = vi.fn();
    store.setWriter(writer);
    store.setSyncStatus("ready");
    store.moveAgent("grok", "more", "pi");
    expect(writer).toHaveBeenCalledOnce();
    expect(store.sectionOf("grok")).toBe("main");
    const [entries] = writer.mock.calls[0] ?? [];
    store.replace(entries);
    expect(store.sectionOf("grok")).toBe("more");
    store.resetToDefault();
    expect(writer).toHaveBeenLastCalledWith([]);
    store.replace([]);
    expect(store.sectionOf("grok")).toBe("main");
    store.setWriter(null);
    store.moveAgent("pi", "more");
    expect(store.sectionOf("pi")).toBe("main");
  });

  it("ignores corrupt legacy data", () => {
    const store = createAgentGroupPreferenceStore({ getItem: () => "invalid JSON" });
    expect(store.legacyEntries()).toEqual(createAgentGroupPreferenceStore(null).legacyEntries());
  });
});
