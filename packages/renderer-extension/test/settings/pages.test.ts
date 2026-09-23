import {
  harnessIdSchema,
  hostThreadIdSchema,
  type CodexAccountListResult,
  type CredentialImportsRequest,
  type HarnessAccountInspectResult,
  type HarnessAccountListResult,
  type HarnessAccountSourceListResult,
  type HarnessId,
  type HarnessSessionListParams,
  type UpdateCheckResult,
  type UpdateStatus,
} from "@codexhost/shared-contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/settings/icons.js", () => ({
  createRendererSettingsIcon: () => "icon",
  createRendererSettingsBrandIcon: () => "brand-icon",
  createRendererSettingsGitHubIcon: () => "github-icon",
  isRendererSettingsIconName: () => true,
}));

vi.mock("../../src/assets/logo-animated.mp4", () => ({
  default: "data:video/mp4;base64,AAAA",
}));

import { createAgentGroupPreferenceStore } from "../../src/agent-group-preference.js";
import { RendererSettingsPageScope } from "../../src/settings/core.js";
import {
  createConnectionsSettingsPage,
  requestConnectionsPageFocus,
} from "../../src/settings/connections-page.js";
import { harnessInstallGuide } from "../../src/settings/harness-install.js";
import {
  RENDERER_UPDATE_REQUEST_TIMEOUT_MS,
  RendererUpdateRequestTimeoutError,
} from "../../src/settings/update-request.js";
import {
  defaultImportName,
  mountCredentialImports,
} from "../../src/settings/credential-imports.js";
import { credentialImportChinese } from "../../src/settings/credential-import-messages.js";
import { createHarnessAccounts } from "../../src/settings/harness-accounts.js";
import { rendererSettingsMessages } from "../../src/settings/localization.js";
import { createRendererModelClient } from "../../src/renderer-model-client.js";
import { RendererSessionImportUnavailableError } from "../../src/renderer-session-import-client.js";
const HARNESS_SESSION_LIST_METHOD = "codexhost/harness/session-import/list";
const HARNESS_SESSION_IMPORT_METHOD = "codexhost/harness/session-import/import";
import {
  CODEXHOST_RELEASES_LATEST_URL,
  createDefaultRendererSettingsPages,
} from "../../src/settings/pages.js";
import type {
  RendererConnectionDiagnostics,
  RendererConnectionSnapshot,
} from "../../src/settings/pages.js";

class FakeElement {
  readonly children: unknown[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly style: Record<string, string> = {};
  readonly #listeners = new Map<string, (event?: unknown) => void>();
  className = "";
  hidden = false;
  href = "";
  id = "";
  rel = "";
  target = "";
  textContent = "";
  title = "";
  type = "";
  value = "";
  tabIndex = 0;
  disabled = false;
  focused = false;
  open = false;
  parent: FakeElement | undefined;
  get isConnected(): boolean {
    return Boolean(this.parent);
  }
  showModal(): void {
    this.open = true;
  }
  close(): void {
    this.open = false;
    this.dispatch("close");
  }
  remove(): void {
    if (this.parent) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    this.parent = undefined;
  }
  querySelector(selector: string): FakeElement | null {
    return (
      descendants(this).find(
        (element) => selector === "[role=alert]" && element.getAttribute("role") === "alert",
      ) ?? null
    );
  }
  scrollLeft = 0;
  scrollWidth = 0;
  clientWidth = 0;

  constructor(
    readonly tagName: string,
    readonly ownerDocument: FakeDocument,
  ) {}

  addEventListener(name: string, listener: (event?: unknown) => void): void {
    this.#listeners.set(name, listener);
  }

  removeEventListener(name: string): void {
    this.#listeners.delete(name);
  }

  append(...children: unknown[]): void {
    for (const child of children) if (child instanceof FakeElement) child.parent = this;
    this.children.push(...children);
  }

  get childElementCount(): number {
    return this.children.filter((child) => child instanceof FakeElement).length;
  }

  dispatch(name: string, event?: unknown): void {
    this.#listeners.get(name)?.(event);
  }

  focus(): void {
    this.focused = true;
  }

  getRootNode(): FakeDocument {
    return this.ownerDocument;
  }

  scrollBy(options: ScrollToOptions): void {
    this.scrollLeft += Number(options.left ?? 0);
    this.dispatch("scroll");
  }

  scrollIntoView(): void {}

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  replaceChildren(...children: unknown[]): void {
    this.children.splice(0, this.children.length, ...children);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

class FakeDocument {
  readonly clipboardWriteText = vi.fn(async () => undefined);
  readonly defaultView: Window;

  constructor(platform = "MacIntel") {
    this.defaultView = {
      navigator: {
        clipboard: { writeText: this.clipboardWriteText },
        platform,
        userAgent: platform === "Win32" ? "Windows" : "Macintosh",
      },
      setTimeout: vi.fn(() => 0),
      clearTimeout: vi.fn(),
      setInterval: vi.fn(() => 0),
      clearInterval: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window;
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }

  createElementNS(_namespace: string, tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }
}

function descendants(root: FakeElement): FakeElement[] {
  return [
    root,
    ...root.children.flatMap((child) => (child instanceof FakeElement ? descendants(child) : [])),
  ];
}

function visibleNotesText(root: FakeElement): string {
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      if (node) parts.push(node);
      return;
    }
    if (!(node instanceof FakeElement)) return;
    if (node.children.length === 0) {
      if (node.textContent) parts.push(node.textContent);
      return;
    }
    for (const child of node.children) walk(child);
  };
  walk(root);
  return parts.join(" ");
}

function elementWithClass(root: FakeElement, className: string): FakeElement {
  const element = descendants(root).find((candidate) =>
    candidate.className.split(" ").includes(className),
  );
  if (!element) throw new Error(`Missing .${className}`);
  return element;
}

function updateCheck(status: UpdateStatus | null = null): UpdateCheckResult {
  return {
    currentVersion: "1.2.2",
    installation: "npm",
    latestVersion: "1.2.3",
    updateAvailable: true,
    installationAvailable: true,
    releaseNotes: "Safer updates",
    releaseNotesUrl: "https://github.com/LiberSeek/BOFT-CLI/releases/tag/v1.2.3",
    status,
    error: null,
  };
}

function updateStatus(
  phase: UpdateStatus["phase"],
  installation: UpdateStatus["installation"] = "npm",
): UpdateStatus {
  return {
    version: "1.2.3",
    installation,
    phase,
    updatedAt: 1_700_000_000,
    error: null,
  };
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function visibleText(root: FakeElement): string {
  return descendants(root)
    .map(({ textContent }) => textContent)
    .filter(Boolean)
    .join(" ");
}

describe("Credential import controls", () => {
  const source = {
    id: "source-a",
    harnessId: "codex",
    label: "a@example.com",
    provider: "openai-codex" as const,
  };
  const wait = () => new Promise((resolve) => setTimeout(resolve, 0));
  const buttonNamed = (root: FakeElement, text: string): FakeElement => {
    const button = descendants(root).find(
      (element) => element.tagName === "button" && element.textContent === text,
    );
    if (!button) throw new Error(`Expected button ${text}`);
    return button;
  };
  const mount = (
    imports: () => unknown[],
    sources: unknown[] = [source],
    others: unknown[] = [],
  ) => {
    const doc = new FakeDocument();
    const root = new FakeElement("div", doc);
    const scope = new AbortController();
    const credentialImports = vi.fn(async (request: CredentialImportsRequest) => {
      if (request.action === "import") {
        imports().push({
          name: request.name,
          source,
          importedAt: "2026-01-01T00:00:00Z",
        });
      }
      if (request.action === "remove") {
        imports().splice(
          imports().findIndex((record) => (record as { name: string }).name === request.name),
          1,
        );
      }
      return {
        sources,
        targets: [
          { harnessId: "pi", providers: ["openai-codex" as const], imports: imports(), others },
        ],
      };
    });
    const controls = mountCredentialImports(
      root as unknown as HTMLElement,
      scope.signal,
      () => ({ credentialImports }) as never,
      credentialImportChinese,
      () => {},
    );
    return { root, scope, credentialImports, controls };
  };

  it("renders no target for an incompatible or unknown login", async () => {
    const { controls, scope } = mount(() => []);
    expect(controls.button("codex", source.label)).toBeNull();
    await controls.refresh();
    expect(controls.button("claude-code", "person@example.com")).toBeNull();
    expect(controls.button("codex", source.label)).not.toBeNull();
    scope.abort();
  });

  it("requires confirmation, then lists the copy in the Pi section and removes it", async () => {
    const imports: unknown[] = [];
    const { root, scope, credentialImports, controls } = mount(() => imports);
    const section = controls.section as unknown as FakeElement;
    expect(section.hidden).toBe(true);
    await controls.refresh();
    expect(section.hidden).toBe(false);
    expect(visibleText(section)).toContain(credentialImportChinese.sectionEmpty);
    const first = controls.button("codex", source.label) as unknown as FakeElement;
    expect(first.title).toBe(credentialImportChinese.add);
    expect(first.dataset.state).toBeUndefined();
    first.dispatch("click");
    expect(credentialImports).toHaveBeenCalledTimes(1);
    expect(visibleText(root)).toContain("保留全部已有 Provider 配置");
    buttonNamed(root, credentialImportChinese.confirm).dispatch("click");
    await wait();
    expect(credentialImports).toHaveBeenLastCalledWith(
      { action: "import", sourceId: source.id, name: "codex", confirmed: true },
      "pi",
    );
    expect(visibleText(root)).toContain(credentialImportChinese.doneTitle);
    expect(visibleText(root)).toContain("无需重启");
    buttonNamed(root, credentialImportChinese.close).dispatch("click");

    const imported = controls.button("codex", source.label) as unknown as FakeElement;
    expect(imported.dataset.state).toBe("imported");
    expect(imported.title).toContain("已复制");
    expect(visibleText(section)).toContain(source.label);
    expect(visibleText(section)).toContain("codex/…");
    expect(visibleText(section)).toContain(credentialImportChinese.copied);
    // The icon of an existing copy moves focus to its row instead of opening another dialog.
    imported.dispatch("click");
    expect(descendants(root).filter((element) => element.tagName === "dialog")).toHaveLength(0);

    buttonNamed(section, credentialImportChinese.rowRemove).dispatch("click");
    expect(credentialImports).toHaveBeenCalledTimes(2);
    expect(visibleText(root)).toContain("不影响来源登录");
    const dialog = descendants(root).find((element) => element.tagName === "dialog");
    if (!dialog) throw new Error("Expected remove dialog");
    buttonNamed(dialog, credentialImportChinese.remove).dispatch("click");
    await wait();
    expect(credentialImports).toHaveBeenLastCalledWith(
      { action: "remove", name: "codex", confirmed: true },
      "pi",
    );
    expect(visibleText(section)).toContain(credentialImportChinese.sectionEmpty);
    expect((controls.button("codex", source.label) as unknown as FakeElement).dataset.state).toBe(
      undefined,
    );
    scope.abort();
  });

  it("hides the whole Pi surface when Pi is not an import target", async () => {
    const doc = new FakeDocument();
    const root = new FakeElement("div", doc);
    const scope = new AbortController();
    // A missing or unconfigured Pi reports no target at all.
    const credentialImports = vi.fn(async () => ({ sources: [source], targets: [] }));
    const controls = mountCredentialImports(
      root as unknown as HTMLElement,
      scope.signal,
      () => ({ credentialImports }) as never,
      credentialImportChinese,
      () => {},
    );
    await controls.refresh();
    expect((controls.section as unknown as FakeElement).hidden).toBe(true);
    expect(controls.button("codex", source.label)).toBeNull();
    scope.abort();
  });

  it("lists every login in Pi in one list, with actions only on codexhost's own copies", async () => {
    const ours = {
      name: "codex",
      source,
      importedAt: "2026-01-01T00:00:00Z",
    };
    const { controls, scope } = mount(
      () => [ours],
      [source],
      [
        { provider: "anthropic", type: "oauth" },
        { provider: "codex1", type: "oauth", label: "me@example.com", vendor: "openai-codex" },
        { provider: "openai-codex", type: "api_key" },
      ],
    );
    const section = controls.section as unknown as FakeElement;
    await controls.refresh();
    const text = visibleText(section);
    // 1 codexhost copy + 3 logins Pi already had.
    expect(text).toContain("4");
    expect(text).toContain(source.label);
    expect(text).toContain("me@example.com");
    expect(text).toContain("codex1");
    expect(text).toContain("anthropic");
    expect(text).toContain("openai-codex");
    expect(text).toContain("API Key");
    // Pi's own logins start collapsed behind a disclosure and carry no actions.
    const group = elementWithClass(section, "settings-pi-accounts__others");
    expect(group.hidden).toBe(true);
    const toggle = elementWithClass(section, "settings-pi-accounts__toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(visibleText(toggle)).toContain(credentialImportChinese.othersTitle);
    expect(visibleText(toggle)).toContain("3");
    toggle.dispatch("click");
    expect(group.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const others = descendants(group).filter((element) =>
      element.className.split(" ").includes("settings-pi-accounts__row--other"),
    );
    expect(others).toHaveLength(3);
    // A recognized vendor gets the account table's own mark; the rest keep the neutral Pi mark.
    expect(others[1]?.getAttribute("aria-label")).toBe("me@example.com · Codex");
    expect(others[1]?.children.find((child) => child instanceof FakeElement)?.dataset.agent).toBe(
      "codex",
    );
    expect(
      others[0]?.children.find((child) => child instanceof FakeElement)?.dataset.agent,
    ).toBeUndefined();
    expect(others[0]?.getAttribute("aria-label")).toBe("anthropic");
    for (const row of others) {
      expect(descendants(row).some((element) => element.tagName === "button")).toBe(false);
    }
    expect(buttonNamed(section, credentialImportChinese.rowRemove).disabled).toBe(false);
    scope.abort();
  });

  it("shows the empty guidance only when Pi has no logins at all", async () => {
    const { controls, scope } = mount(() => []);
    await controls.refresh();
    expect(visibleText(controls.section as unknown as FakeElement)).toContain(
      credentialImportChinese.sectionEmpty,
    );
    scope.abort();
  });

  it("keeps a copy of a non-current login listed without warnings or a re-copy button", async () => {
    const other = {
      name: "codex",
      source: { ...source, id: "gone", label: "old@example.com" },
      importedAt: "2026-01-01T00:00:00Z",
    };
    const { controls, scope } = mount(() => [other]);
    const section = controls.section as unknown as FakeElement;
    await controls.refresh();
    expect(visibleText(section)).toContain("old@example.com");
    expect(visibleText(section)).not.toContain("退出");
    expect(
      descendants(section).some(
        (element) =>
          element.tagName === "button" &&
          element.textContent === credentialImportChinese.rowReimport,
      ),
    ).toBe(false);
    expect(buttonNamed(section, credentialImportChinese.rowRemove).disabled).toBe(false);
    scope.abort();
  });

  it("adds a second account beside the first under an account-specific default name", async () => {
    const first = {
      name: "codex",
      source: { ...source, id: "gone", label: "old@example.com" },
      importedAt: "2026-01-01T00:00:00Z",
    };
    const imports: unknown[] = [first];
    const { root, scope, credentialImports, controls } = mount(() => imports);
    await controls.refresh();
    (controls.button("codex", source.label) as unknown as FakeElement).dispatch("click");
    const input = descendants(root).find((element) => element.tagName === "input");
    expect(input?.value).toBe("codex-a");
    buttonNamed(root, credentialImportChinese.confirm).dispatch("click");
    await wait();
    expect(credentialImports).toHaveBeenLastCalledWith(
      { action: "import", sourceId: source.id, name: "codex-a", confirmed: true },
      "pi",
    );
    const section = controls.section as unknown as FakeElement;
    expect(visibleText(section)).toContain("old@example.com");
    expect(visibleText(section)).toContain("a@example.com");
    scope.abort();
  });
});

describe("Default import entry names", () => {
  const record = (name: string) => ({
    name,
    source: { id: name, harnessId: "codex", label: "x", provider: "openai-codex" as const },
    importedAt: "2026-01-01T00:00:00Z",
  });
  const codex = (label: string) => ({
    id: "s",
    harnessId: "codex",
    label,
    provider: "openai-codex" as const,
  });
  it("uses the plain name first, then the account, then a number", () => {
    expect(defaultImportName(codex("a@x.com"), [])).toBe("codex");
    expect(defaultImportName(codex("Ann.Lee+work@x.com"), [record("codex")])).toBe(
      "codex-ann-lee-work",
    );
    expect(defaultImportName(codex("a@x.com"), [record("codex"), record("codex-a")])).toBe(
      "codex2",
    );
    expect(defaultImportName(codex("Codex"), [record("codex")])).toBe("codex2");
    expect(defaultImportName(codex("___@x.com"), [record("codex")])).toBe("codex2");
    expect(
      defaultImportName({ ...codex("9s74@relay.com"), provider: "xai" }, [record("grok")]),
    ).toBe("grok-9s74");
    expect(
      defaultImportName(codex(`${"a".repeat(80)}@x.com`), [record("codex")]).length,
    ).toBeLessThanOrEqual(48);
  });
});

describe("Read-only Harness accounts", () => {
  const result: HarnessAccountListResult = {
    accounts: [
      {
        harnessId: harnessIdSchema.parse("grok"),
        harnessName: "Grok Build",
        email: "person@example.com",
        credits: { usedPercent: 25, periodType: "weekly" },
      },
    ],
  };
  it("loads native snapshots and discards stale accounts after empty or failed refreshes", async () => {
    const scope = new RendererSettingsPageScope();
    const listHarnessAccounts = vi.fn(async () => result);
    const mounted = createHarnessAccounts(scope.signal, () => ({ listHarnessAccounts }), vi.fn());
    expect(mounted.accounts).toEqual([]);
    await mounted.refresh();
    expect(mounted.accounts).toEqual(result.accounts);
    listHarnessAccounts.mockResolvedValueOnce({ accounts: [] });
    await mounted.refresh();
    expect(mounted.accounts).toEqual([]);
    await mounted.refresh();
    expect(mounted.accounts).toEqual(result.accounts);
    listHarnessAccounts.mockRejectedValueOnce(new Error("unavailable"));
    await mounted.refresh();
    expect(mounted.accounts).toEqual([]);
    expect(mounted.refreshing).toBe(false);
    scope.dispose();
  });

  it("coalesces refreshes and discards late results after page disposal", async () => {
    const scope = new RendererSettingsPageScope();
    const pending = deferred<HarnessAccountListResult>();
    const listHarnessAccounts = vi.fn(() => pending.promise);
    const changed = vi.fn();
    const mounted = createHarnessAccounts(scope.signal, () => ({ listHarnessAccounts }), changed);
    const refresh = mounted.refresh();
    await mounted.refresh();
    expect(listHarnessAccounts).toHaveBeenCalledOnce();
    scope.dispose();
    pending.resolve(result);
    await refresh;
    expect(mounted.accounts).toEqual([]);
    expect(changed).toHaveBeenCalledOnce();
  });

  it("keeps Antigravity after the other Harness account rows", async () => {
    const scope = new RendererSettingsPageScope();
    const mounted = createHarnessAccounts(
      scope.signal,
      () => ({
        listHarnessAccounts: async () => ({
          accounts: [
            {
              harnessId: harnessIdSchema.parse("antigravity"),
              harnessName: "Antigravity CLI",
              credits: { usedPercent: 10, periodType: "weekly" },
            },
            {
              harnessId: harnessIdSchema.parse("grok"),
              harnessName: "Grok",
              credits: { usedPercent: 20, periodType: "weekly" },
            },
            {
              harnessId: harnessIdSchema.parse("claude-code"),
              harnessName: "Claude Code",
              credits: { usedPercent: 30, periodType: "weekly" },
            },
          ],
        }),
      }),
      vi.fn(),
    );
    await mounted.refresh();
    expect(mounted.accounts.map(({ harnessId }) => harnessId)).toEqual([
      "claude-code",
      "grok",
      "antigravity",
    ]);
    scope.dispose();
  });

  it("falls back to the aggregate account request when progressive discovery is unavailable", async () => {
    const scope = new RendererSettingsPageScope();
    const listHarnessAccounts = vi.fn(async () => result);
    const mounted = createHarnessAccounts(
      scope.signal,
      () => ({
        listHarnessAccountSources: vi.fn(async () => {
          throw new Error("unsupported");
        }),
        inspectHarnessAccount: vi.fn(),
        listHarnessAccounts,
      }),
      vi.fn(),
    );
    await mounted.refresh();
    expect(listHarnessAccounts).toHaveBeenCalledOnce();
    expect(mounted.accounts).toEqual(result.accounts);
    scope.dispose();
  });

  it("forces progressive Harness inspection only for an explicit quota refresh", async () => {
    const scope = new RendererSettingsPageScope();
    const inspectHarnessAccount = vi.fn(async ({ harnessId }: { harnessId: HarnessId }) => ({
      harnessId,
      harnessName: "Sample Agent",
      account: {
        email: "person@example.com",
        credits: { usedPercent: 25, periodType: "weekly" as const },
      },
    }));
    const mounted = createHarnessAccounts(
      scope.signal,
      () => ({
        listHarnessAccountSources: async () => ({
          sources: [
            { harnessId: harnessIdSchema.parse("sample-agent"), harnessName: "Sample Agent" },
          ],
        }),
        inspectHarnessAccount,
      }),
      vi.fn(),
    );

    await mounted.refresh();
    expect(inspectHarnessAccount).toHaveBeenLastCalledWith({ harnessId: "sample-agent" });
    await mounted.refresh(true);
    expect(inspectHarnessAccount).toHaveBeenLastCalledWith({
      harnessId: "sample-agent",
      refresh: true,
    });
    scope.dispose();
  });

  it("renders each Harness account as soon as its independent inspection completes", async () => {
    const scope = new RendererSettingsPageScope();
    const sources = deferred<HarnessAccountSourceListResult>();
    const grok = deferred<HarnessAccountInspectResult>();
    const claude = deferred<HarnessAccountInspectResult>();
    const inspectHarnessAccount = vi.fn(({ harnessId }: { harnessId: string }) =>
      harnessId === "grok" ? grok.promise : claude.promise,
    );
    const changed = vi.fn();
    const mounted = createHarnessAccounts(
      scope.signal,
      () => ({
        listHarnessAccountSources: () => sources.promise,
        inspectHarnessAccount,
      }),
      changed,
    );

    const refresh = mounted.refresh();
    sources.resolve({
      sources: [
        { harnessId: harnessIdSchema.parse("grok"), harnessName: "Grok" },
        { harnessId: harnessIdSchema.parse("claude-code"), harnessName: "Claude Code" },
      ],
    });
    await vi.waitFor(() => expect(inspectHarnessAccount).toHaveBeenCalledTimes(2));

    grok.resolve({
      harnessId: harnessIdSchema.parse("grok"),
      harnessName: "Grok",
      account: { credits: { usedPercent: 25, periodType: "weekly" } },
    });
    await vi.waitFor(() =>
      expect(mounted.accounts).toEqual([
        {
          harnessId: "grok",
          harnessName: "Grok",
          credits: { usedPercent: 25, periodType: "weekly" },
        },
      ]),
    );
    expect(mounted.refreshing).toBe(true);

    claude.resolve({
      harnessId: harnessIdSchema.parse("claude-code"),
      harnessName: "Claude Code",
      account: { credits: { usedPercent: 50, periodType: "five_hour" } },
    });
    await refresh;
    expect(mounted.accounts.map(({ harnessId }) => harnessId)).toEqual(["claude-code", "grok"]);
    expect(mounted.refreshing).toBe(false);
    scope.dispose();
  });
});

describe("Renderer Connections page", () => {
  it.each([
    "pi",
    "claude-code",
    "deepseek-harness",
    "opencode",
    "grok",
    "omp",
    "antigravity",
    "kiro-cli",
    "codebuddy",
    "workbuddy",
    "cursor-cli",
    "hermes",
    "qoder",
    "qoder-cn",
  ] as const)("shows actionable installation instructions for %s", async (agent) => {
    const refresh = vi.fn(async () => undefined);
    const diagnostics: RendererConnectionDiagnostics = {
      snapshot: () => ({
        adapter: { state: "ready", reason: "ready", modelUpdates: 1, hook: "request-bridge" },
        hosts: [
          {
            hostId: "remote-test",
            active: true,
            agents: [{ agent, availability: "notInstalled", error: null }],
          },
        ],
      }),
      refresh,
      subscribe: () => () => undefined,
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("zh-CN"),
      () => null,
      () => diagnostics,
    ).find(({ id }) => id === "connections");
    if (!page) throw new Error("Expected connections page");
    const document = new FakeDocument("Win32");
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (op, handlers) => scope.runLatest(op, handlers),
    });
    const install = elementWithClass(content, "settings-connection-install-link");
    expect(install.tagName).toBe("button");
    install.dispatch("click", { stopPropagation() {} });
    const panel = elementWithClass(content, "settings-connection-inline-detail");
    const guide = harnessInstallGuide(agent, "windows");
    expect(visibleText(panel)).toContain(guide.command);
    expect(
      visibleText(content).includes("已在 DSH 0.1.2-rc.1、0.1.5-rc.1 和 0.1.5-rc.2 上测试。"),
    ).toBe(agent === "deepseek-harness");
    expect(refresh).not.toHaveBeenCalled();
    const copy = descendants(panel).find(
      ({ dataset }) => dataset.connectionAction === "install-command",
    );
    const command = descendants(panel).find(({ tagName }) => tagName === "code");
    if (!copy || !command) throw new Error("Expected install command and copy button");
    expect(command.textContent).toBe(guide.command);
    copy.dispatch("click");
    await vi.waitFor(() =>
      expect(document.clipboardWriteText).toHaveBeenLastCalledWith(guide.command),
    );
    expect(guide.command).not.toContain("sudo");
    document.clipboardWriteText.mockRejectedValueOnce(new Error("denied"));
    copy.dispatch("click");
    await vi.waitFor(() => expect(visibleNotesText(copy)).toContain("复制失败"));
    const official = descendants(panel).find(
      ({ dataset }) => dataset.connectionAction === "open-installation",
    );
    if (!official) throw new Error("Expected official installation link");
    expect(official.href).toBe(guide.url);
    expect(official).toMatchObject({ target: "_blank", rel: "noopener noreferrer" });
    cleanup?.();
    scope.dispose();
  });

  it.each(["workbuddy"] as const)(
    "edits %s launch settings in the local right-side inspector",
    async (agent) => {
      const messages = rendererSettingsMessages("zh-CN");
      let changed: () => void = () => undefined;
      const diagnostics: RendererConnectionDiagnostics = {
        snapshot: () => ({
          adapter: { state: "ready", reason: "ready", modelUpdates: 1, hook: "request-bridge" },
          hosts: ["local", "remote-test"].map((hostId) => ({
            hostId,
            active: hostId === "local",
            agents: [{ agent, availability: "notInstalled", error: null }],
          })),
        }),
        refresh: vi.fn(async () => undefined),
        getLaunchSettings: vi.fn(async () => ({ path: null, restartRequired: false })),
        setLaunchSettings: vi.fn(async (_hostId, _agent, path) => ({
          path,
          restartRequired: true,
        })),
        subscribe: (listener) => {
          changed = listener;
          return () => undefined;
        },
      };
      const page = createDefaultRendererSettingsPages(
        messages,
        () => null,
        () => diagnostics,
      ).find(({ id }) => id === "connections");
      if (!page) throw new Error("Expected connections page");
      const document = new FakeDocument("Win32");
      const content = document.createElement("main");
      const scope = new RendererSettingsPageScope();
      const cleanup = page.mount({
        content: content as unknown as HTMLElement,
        signal: scope.signal,
        runLatest: (op, handlers) => scope.runLatest(op, handlers),
      });
      const row = descendants(content).find(({ dataset }) => dataset.connectionItem === agent);
      if (!row) throw new Error("Expected Harness row");
      row.dispatch("click", { target: null });
      const panel = elementWithClass(content, "settings-connection-inline-detail");
      const input = descendants(panel).find(({ tagName }) => tagName === "input");
      if (!input) throw new Error("Expected launch path input");
      await vi.waitFor(() => expect(input.disabled).toBe(false));
      expect(diagnostics.getLaunchSettings).toHaveBeenCalledWith("local", agent);
      const save = descendants(panel).find(
        ({ textContent }) => textContent === messages.launchPathSave,
      );
      if (!save) throw new Error("Expected save button");
      expect(save.disabled).toBe(true);
      input.value = "D:\\Custom Apps";
      input.dispatch("input");
      changed();
      expect(descendants(content).find(({ tagName }) => tagName === "input")).toBe(input);
      expect(input.value).toBe("D:\\Custom Apps");
      save.dispatch("click");
      save.dispatch("click");
      await vi.waitFor(() => expect(visibleText(panel)).toContain(messages.launchPathRestart));
      expect(diagnostics.setLaunchSettings).toHaveBeenCalledExactlyOnceWith(
        "local",
        agent,
        input.value,
      );
      const reset = descendants(panel).find(
        ({ textContent }) => textContent === messages.launchPathReset,
      );
      if (!reset) throw new Error("Expected reset button");
      reset.dispatch("click");
      await vi.waitFor(() => expect(input.value).toBe(""));
      expect(diagnostics.setLaunchSettings).toHaveBeenLastCalledWith("local", agent, null);
      if (!diagnostics.setLaunchSettings) throw new Error("Expected settings writer");
      vi.mocked(diagnostics.setLaunchSettings).mockRejectedValueOnce(new Error("no access"));
      input.value = "missing";
      input.dispatch("input");
      save.dispatch("click");
      await vi.waitFor(() => expect(visibleText(panel)).toContain(messages.launchPathSaveError));
      expect(input.value).toBe("missing");
      const remote = descendants(content).find(
        ({ dataset }) => dataset.connectionHostTab === "remote-test",
      );
      if (!remote) throw new Error("Expected remote tab");
      remote.dispatch("click");
      expect(descendants(content).some(({ dataset }) => dataset.harnessLaunch)).toBe(false);
      cleanup?.();
      scope.dispose();
    },
  );
  it("opens managed DSH Web only for the local Host and coalesces repeated clicks", async () => {
    const opened = deferred<undefined>();
    const diagnostics: RendererConnectionDiagnostics = {
      snapshot: () => ({
        adapter: { state: "ready", reason: "ready", modelUpdates: 1, hook: "request-bridge" },
        hosts: [
          {
            hostId: "local",
            active: true,
            agents: [
              {
                agent: "deepseek-harness",
                availability: "ready",
                error: null,
                webUiAvailable: true,
              },
            ],
          },
          {
            hostId: "remote-ssh-codex-managed:fixture",
            active: false,
            agents: [
              {
                agent: "deepseek-harness",
                availability: "ready",
                error: null,
                webUiAvailable: true,
              },
            ],
          },
        ],
      }),
      refresh: vi.fn(() => Promise.resolve()),
      openWebUi: vi.fn(() => opened.promise),
      subscribe: vi.fn(() => () => undefined),
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("zh-CN"),
      () => null,
      () => diagnostics,
    ).find(({ id }) => id === "connections");
    if (!page) throw new Error("Connections page is not registered");
    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    const dshRow = descendants(content).find(
      ({ dataset }) => dataset.connectionItem === "deepseek-harness",
    );
    if (!dshRow) throw new Error("DeepSeek Harness row is not rendered");
    dshRow.dispatch("click", { target: null });
    expect(visibleText(content)).toContain("其他版本可以尝试连接，但尚未验证。");
    const open = descendants(content).find(
      ({ dataset }) => dataset.connectionAction === "open-web-ui",
    );
    if (!open) throw new Error("DeepSeek Harness Web action is not rendered");
    expect(visibleNotesText(open)).toContain("打开 DeepSeek Harness Web");
    expect(descendants(content).some(({ href }) => href.includes("token="))).toBe(false);

    open.dispatch("click");
    open.dispatch("click");
    expect(diagnostics.openWebUi).toHaveBeenCalledOnce();
    expect(diagnostics.openWebUi).toHaveBeenCalledWith("local", "deepseek-harness");
    expect(open.disabled).toBe(true);
    opened.resolve(undefined);
    await vi.waitFor(() => expect(open.disabled).toBe(false));

    const remoteTab = descendants(content).find(
      ({ dataset }) => dataset.connectionHostTab === "remote-ssh-codex-managed:fixture",
    );
    if (!remoteTab) throw new Error("Remote Host tab is not rendered");
    remoteTab.dispatch("click");
    expect(
      descendants(content).find(({ dataset }) => dataset.connectionAction === "open-web-ui"),
    ).toBeUndefined();

    cleanup?.();
    scope.dispose();
  });

  it("renders Host tabs, install actions, and error details", async () => {
    const refreshRequest = deferred<undefined>();
    const diagnostics: RendererConnectionDiagnostics = {
      snapshot: vi.fn((): RendererConnectionSnapshot => ({
        adapter: {
          state: "ready",
          reason: "ready",
          modelUpdates: 1,
          hook: "request-bridge",
        },
        hosts: [
          {
            hostId: "local",
            active: true,
            agents: [
              {
                agent: "pi",
                availability: "error",
                error: {
                  code: "processExited",
                  message: "pi exited with code 1",
                  retryable: true,
                  stage: "startup",
                  durationMs: 120,
                  stderrTail: "check ~/.pi/agent/settings.json",
                },
              },
              {
                agent: "deepseek-harness",
                availability: "notInstalled",
                error: {
                  code: "notInstalled",
                  message: "DSH is not installed",
                  retryable: false,
                },
              },
            ],
          },
          {
            hostId: "remote-ssh-codex-managed:%E5%85%AC%E5%8F%B8",
            active: false,
            agents: [{ agent: "pi", availability: "ready", error: null }],
          },
        ],
      })),
      refresh: vi.fn(() => refreshRequest.promise),
      subscribe: vi.fn(() => () => undefined),
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("zh-CN"),
      () => null,
      () => diagnostics,
    ).find(({ id }) => id === "connections");
    if (!page) throw new Error("Connections page is not registered");

    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    expect(visibleText(content)).toContain("本地");
    expect(visibleText(content)).toContain("Agents");
    expect(
      descendants(content).filter(
        (candidate) =>
          candidate.dataset.connectionItem !== undefined && candidate.dataset.connectionItem !== "",
      ),
    ).toHaveLength(2);
    expect(visibleText(content)).not.toContain("Renderer 适配器");
    expect(visibleText(content)).not.toContain("CH");
    expect(
      descendants(content).some(
        (candidate) => candidate.dataset.connectionItem === "renderer-adapter",
      ),
    ).toBe(false);
    expect(visibleText(content)).toContain("公司");
    expect(visibleText(content)).not.toContain("pi exited with code 1");
    expect(elementWithClass(content, "settings-segmented")).toBeDefined();
    expect(visibleText(content)).toContain("查看错误");

    const viewError = descendants(content).find(
      ({ tagName, className }) =>
        tagName === "button" && className.split(" ").includes("settings-connection-view-error"),
    );
    if (!viewError) throw new Error("View error button is not rendered");
    viewError.dispatch("click");
    expect(visibleText(content)).toContain("pi exited with code 1");
    expect(visibleText(content)).toContain("~/.pi/agent/settings.json");
    expect(visibleText(content)).toContain("startup");
    const issueLink = descendants(content).find(
      ({ tagName, href }) =>
        tagName === "a" && href === "https://github.com/LiberSeek/BOFT-CLI/issues/new",
    );
    expect(issueLink).toBeDefined();
    const copyButton = descendants(
      elementWithClass(content, "settings-connection-error-log-header"),
    ).find(({ tagName }) => tagName === "button");
    if (!copyButton) throw new Error("Copy error log button is not rendered");
    copyButton.dispatch("click");
    await vi.waitFor(() => expect(document.clipboardWriteText).toHaveBeenCalledOnce());
    expect(document.clipboardWriteText).toHaveBeenCalledWith(
      expect.stringContaining("host: local"),
    );
    await vi.waitFor(() => expect(visibleNotesText(content)).toContain("已复制"));
    const refresh = descendants(content).find(
      ({ tagName, dataset }) => tagName === "button" && dataset.connectionAction === "refresh",
    );
    if (!refresh) throw new Error("Connection refresh button is not rendered");
    refresh.dispatch("click");
    expect(refresh.disabled).toBe(true);
    expect(visibleNotesText(refresh)).toContain("正在扫描...");
    expect(diagnostics.refresh).toHaveBeenCalledWith();
    refreshRequest.resolve(undefined);
    await vi.waitFor(() => expect(refresh.disabled).toBe(false));
    expect(visibleNotesText(refresh)).toContain("扫描环境");

    const rowInstall = descendants(content).find(
      ({ tagName, dataset }) => tagName === "button" && dataset.connectionAction === "show-install",
    );
    if (!rowInstall) throw new Error("Persistent install button is not rendered");
    expect(rowInstall.className.split(" ").includes("settings-connection-install-link")).toBe(true);
    expect(rowInstall.getAttribute("aria-label")).toBe("安装: DeepSeek Harness");
    rowInstall.dispatch("click");

    const copyCommand = descendants(content).find(
      ({ dataset }) => dataset.connectionAction === "install-command",
    );
    const copyPrompt = descendants(content).find(
      ({ dataset }) => dataset.connectionAction === "copy-prompt",
    );
    const officialLink = descendants(content).find(
      ({ dataset }) => dataset.connectionAction === "open-installation",
    );
    if (!copyCommand || !copyPrompt || !officialLink) {
      throw new Error("Install actions are not rendered");
    }
    expect(visibleNotesText(copyCommand)).toContain("安装");
    expect(visibleNotesText(copyPrompt)).toContain("复制 Prompt");
    expect(visibleNotesText(officialLink)).toContain("前往官方安装页面");
    expect(officialLink).toMatchObject({
      href: "https://deepseek-harness.github.io/deepseek-harness/",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    const promptTooltip = descendants(content).find(({ className }) =>
      className.split(" ").includes("settings-connection-copy-prompt__tooltip"),
    );
    expect(promptTooltip?.textContent).toContain("npm install -g @deepseek-ai/dsh");
    expect(promptTooltip?.textContent).toContain("DeepSeek Harness");
    expect(promptTooltip?.getAttribute("role")).toBe("tooltip");
    expect(copyPrompt.getAttribute("aria-describedby")).toBe(promptTooltip?.id);

    copyCommand.dispatch("click");
    await vi.waitFor(() => expect(document.clipboardWriteText).toHaveBeenCalledTimes(2));
    expect(document.clipboardWriteText).toHaveBeenLastCalledWith("npm install -g @deepseek-ai/dsh");
    copyPrompt.dispatch("click");
    await vi.waitFor(() => expect(document.clipboardWriteText).toHaveBeenCalledTimes(3));
    expect(document.clipboardWriteText).toHaveBeenLastCalledWith(
      expect.stringContaining("请帮我在本机安装 DeepSeek Harness"),
    );

    const remoteTab = descendants(content).find(
      ({ tagName, dataset }) =>
        tagName === "button" &&
        dataset.connectionHostTab === "remote-ssh-codex-managed:%E5%85%AC%E5%8F%B8",
    );
    if (!remoteTab) throw new Error("Remote Host tab is not rendered");
    remoteTab.dispatch("click");
    const selectedPanel = descendants(content).find(
      ({ dataset }) => dataset.connectionHost === "remote-ssh-codex-managed:%E5%85%AC%E5%8F%B8",
    );
    expect(selectedPanel).toBeDefined();
    expect(visibleText(content)).not.toContain("pi exited with code 1");
    const selectedRemoteTab = descendants(content).find(
      ({ dataset, attributes }) =>
        dataset.connectionHostTab === "remote-ssh-codex-managed:%E5%85%AC%E5%8F%B8" &&
        attributes.get("aria-selected") === "true",
    );
    expect(selectedRemoteTab).toBeDefined();
    expect(
      selectedRemoteTab?.className.split(" ").includes("settings-segmented__item--selected"),
    ).toBe(true);

    cleanup?.();
  });

  it("lists installed Agents before uninstalled ones even when preference order mixes them", () => {
    const storage = {
      data: new Map<string, string>(),
      getItem(key: string) {
        return this.data.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.data.set(key, value);
      },
      removeItem(key: string) {
        this.data.delete(key);
      },
      clear() {
        this.data.clear();
      },
      key() {
        return null;
      },
      get length() {
        return this.data.size;
      },
    } satisfies Storage;
    const groupPreference = createAgentGroupPreferenceStore(storage);
    // Put the uninstalled Agent first in the raw preference order.
    groupPreference.moveAgent("deepseek-harness", "main", "pi");
    groupPreference.moveAgent("pi", "main", null);

    const diagnostics: RendererConnectionDiagnostics = {
      snapshot: vi.fn((): RendererConnectionSnapshot => ({
        adapter: {
          state: "ready",
          reason: "ready",
          modelUpdates: 1,
          hook: "request-bridge",
        },
        hosts: [
          {
            hostId: "local",
            active: true,
            agents: [
              { agent: "deepseek-harness", availability: "notInstalled", error: null },
              { agent: "pi", availability: "ready", error: null },
            ],
          },
        ],
      })),
      refresh: vi.fn(async () => undefined),
      subscribe: vi.fn(() => () => undefined),
    };
    const page = createConnectionsSettingsPage(
      rendererSettingsMessages("zh-CN"),
      () => diagnostics,
      groupPreference,
    );
    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    const agentRows = descendants(content).filter(
      (candidate) =>
        candidate.dataset.connectionItem === "pi" ||
        candidate.dataset.connectionItem === "deepseek-harness",
    );
    expect(agentRows.map((row) => row.dataset.connectionItem)).toEqual(["pi", "deepseek-harness"]);
    expect(
      groupPreference
        .list()
        .filter((entry) => entry.agent === "pi" || entry.agent === "deepseek-harness")
        .map((entry) => entry.agent),
    ).toEqual(["pi", "deepseek-harness"]);

    cleanup?.();
  });

  it("can move an Agent from More back to Main even when Main has no same-install peer", () => {
    const storage = {
      data: new Map<string, string>(),
      getItem(key: string) {
        return this.data.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.data.set(key, value);
      },
      removeItem(key: string) {
        this.data.delete(key);
      },
      clear() {
        this.data.clear();
      },
      key() {
        return null;
      },
      get length() {
        return this.data.size;
      },
    } satisfies Storage;
    const groupPreference = createAgentGroupPreferenceStore(storage);
    // Uninstalled Agent alone in More; Main only has an installed peer.
    groupPreference.moveAgent("pi", "main", null);
    groupPreference.moveAgent("deepseek-harness", "more", null);

    const diagnostics: RendererConnectionDiagnostics = {
      snapshot: vi.fn((): RendererConnectionSnapshot => ({
        adapter: {
          state: "ready",
          reason: "ready",
          modelUpdates: 0,
          hook: "request-bridge",
        },
        hosts: [
          {
            hostId: "local",
            active: true,
            agents: [
              { agent: "pi", availability: "ready", error: null },
              { agent: "deepseek-harness", availability: "notInstalled", error: null },
            ],
          },
        ],
      })),
      refresh: vi.fn(async () => undefined),
      subscribe: vi.fn(() => () => undefined),
    };
    const page = createConnectionsSettingsPage(
      rendererSettingsMessages("zh-CN"),
      () => diagnostics,
      groupPreference,
    );
    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    expect(groupPreference.sectionOf("deepseek-harness")).toBe("more");

    const divider = elementWithClass(content, "settings-connection-group-divider");
    const dragEvent = {
      preventDefault() {},
      stopPropagation() {},
      dataTransfer: { setData() {}, effectAllowed: "move" },
    };
    divider.dispatch("dragover", dragEvent);
    // Simulate the More→Main path exposed by dropping on the divider.
    groupPreference.moveAgent("deepseek-harness", "main", "pi");
    // After moving ahead of installed `pi`, reconcile on next render keeps buckets:
    // installed first, then uninstalled — but section must be main.
    expect(groupPreference.sectionOf("deepseek-harness")).toBe("main");

    cleanup?.();
  });

  it("expands the requested Agent row when another surface asks to focus it", () => {
    const groupPreference = createAgentGroupPreferenceStore({
      data: new Map<string, string>(),
      getItem(key: string) {
        return this.data.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.data.set(key, value);
      },
      removeItem(key: string) {
        this.data.delete(key);
      },
      clear() {
        this.data.clear();
      },
      key() {
        return null;
      },
      get length() {
        return this.data.size;
      },
    } satisfies Storage);
    const diagnostics: RendererConnectionDiagnostics = {
      snapshot: vi.fn((): RendererConnectionSnapshot => ({
        adapter: {
          state: "ready",
          reason: "ready",
          modelUpdates: 0,
          hook: "request-bridge",
        },
        hosts: [
          {
            hostId: "local",
            active: true,
            agents: [
              { agent: "pi", availability: "notInstalled", error: null },
              { agent: "deepseek-harness", availability: "notInstalled", error: null },
            ],
          },
        ],
      })),
      refresh: vi.fn(async () => undefined),
      subscribe: vi.fn(() => () => undefined),
    };
    requestConnectionsPageFocus("deepseek-harness");
    const page = createConnectionsSettingsPage(
      rendererSettingsMessages("zh-CN"),
      () => diagnostics,
      groupPreference,
    );
    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    const focused = descendants(content).find(
      (candidate) => candidate.dataset.connectionItem === "deepseek-harness",
    );
    const other = descendants(content).find(
      (candidate) => candidate.dataset.connectionItem === "pi",
    );
    expect(focused?.dataset.connectionExpanded).toBe("true");
    expect(other?.dataset.connectionExpanded).toBe("false");
    expect(
      descendants(content).some(
        (candidate) => candidate.dataset.connectionDetail === "deepseek-harness",
      ),
    ).toBe(true);

    cleanup?.();
  });
});

describe("Renderer Plugin page", () => {
  it("renders Renderer adapter status and refresh diagnostics", async () => {
    const refreshRequest = deferred<undefined>();
    const diagnostics: RendererConnectionDiagnostics = {
      snapshot: vi.fn((): RendererConnectionSnapshot => ({
        adapter: {
          state: "ready",
          reason: "ready",
          modelUpdates: 1,
          hook: "request-bridge",
        },
        hosts: [],
      })),
      refresh: vi.fn(() => refreshRequest.promise),
      subscribe: vi.fn(() => () => undefined),
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("zh-CN"),
      () => null,
      () => diagnostics,
    ).find(({ id }) => id === "plugins");
    if (!page) throw new Error("Plugin page is not registered");

    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    expect(visibleText(content)).toContain("插件");
    expect(visibleText(content)).toContain("Renderer 适配器");
    expect(visibleText(content)).not.toContain("CH");
    const adapterRow = descendants(content).find(
      (candidate) => candidate.dataset.connectionItem === "renderer-adapter",
    );
    if (!adapterRow) throw new Error("Renderer adapter row is not rendered");
    const brandMark = descendants(adapterRow).find((candidate) =>
      candidate.className.split(" ").includes("settings-connection-row__mark--logo"),
    );
    expect(brandMark).toBeDefined();
    expect(brandMark?.children).toContain("brand-icon");
    expect(visibleText(content)).toContain("正常");
    expect(visibleText(content)).toContain("组件");
    expect(visibleText(content)).toContain("状态");
    expect(visibleText(content)).toContain("操作");
    expect(diagnostics.subscribe).toHaveBeenCalledOnce();

    const refresh = descendants(content).find(
      ({ tagName, dataset }) => tagName === "button" && dataset.pluginAction === "refresh",
    );
    if (!refresh) throw new Error("Plugin refresh button is not rendered");
    refresh.dispatch("click");
    expect(refresh.disabled).toBe(true);
    expect(visibleNotesText(refresh)).toContain("正在扫描...");
    expect(diagnostics.refresh).toHaveBeenCalledWith();
    refreshRequest.resolve(undefined);
    await vi.waitFor(() => expect(refresh.disabled).toBe(false));
    expect(visibleNotesText(refresh)).toContain("扫描环境");

    cleanup?.();
  });
});

describe("Renderer Codex Accounts page", () => {
  const accountSnapshot = (
    accounts: {
      accountId: string;
      label: string;
      email?: string;
      authKind?: "api" | "chatgpt";
      authIdentity?: string;
    }[],
    currentAccountId: string | null = accounts[0]?.accountId ?? null,
    revision = 1,
  ) => ({
    version: 2 as const,
    currentAccountId,
    phase: "ready" as const,
    revision,
    instanceId: "settings-host",
    accounts: [...accounts],
  });

  it("renders cached Accounts before live metadata refresh completes", async () => {
    const refresh = Promise.withResolvers<CodexAccountListResult>();
    const cachedAccount = { accountId: "default", label: "Default" };
    const client = {
      listCodexAccounts: vi.fn(async () => accountSnapshot([cachedAccount])),
      refreshCodexAccounts: vi.fn(() => refresh.promise),
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("en"),
      () => null,
      () => null,
      () => client,
    ).find(({ id }) => id === "accounts");
    if (!page) throw new Error("Accounts page is not registered");
    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });
    await vi.waitFor(() => expect(visibleText(content)).toContain("Default"));
    expect(visibleText(content)).toContain(
      "View the current Codex identity and quotas, plus other Agent accounts.",
    );
    expect(client.refreshCodexAccounts).toHaveBeenCalledOnce();
    expect(
      descendants(content).some(
        ({ tagName, children }) => tagName === "button" && children.includes("Add Codex account"),
      ),
    ).toBe(false);
    refresh.resolve(
      accountSnapshot([{ ...cachedAccount, email: "cached@example.com" }], "default", 2),
    );
    await vi.waitFor(() =>
      expect(descendants(content).some((element) => element.title === "cached@example.com")).toBe(
        true,
      ),
    );
    expect(visibleText(content)).toContain("cached");
    expect(visibleText(content)).not.toContain("CODEX_HOME");
    scope.dispose();
  });

  it("renders current Account quota and reset-credit count without consume or login actions", async () => {
    const inspectCodexAccountUsage = vi.fn(async ({ accountId }: { accountId: string }) => ({
      accountId,
      usage: null,
      accountCredits: {
        usedPercent: 27,
        periodType: "weekly" as const,
        resetsAt: "2026-09-10T03:32:00.000Z",
        resetCredits: { availableCount: 2 },
      },
      freshness: "cached" as const,
      observedAt: "2026-09-10T03:32:00.000Z",
    }));
    const client = {
      listCodexAccounts: vi.fn(async () =>
        accountSnapshot([{ accountId: "work", label: "Work", email: "work@example.com" }], "work"),
      ),
      inspectCodexAccountUsage,
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("zh-CN"),
      () => null,
      () => null,
      () => client,
    ).find(({ id }) => id === "accounts");
    if (!page) throw new Error("Accounts page is not registered");
    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });
    await vi.waitFor(() =>
      expect(inspectCodexAccountUsage).toHaveBeenCalledWith({ accountId: "work" }),
    );
    expect(visibleText(content)).toContain("work@example.com");
    expect(visibleText(content)).toContain("2 张");
    expect(
      descendants(content)
        .filter((element) => element.tagName === "button")
        .map((element) => element.textContent),
    ).not.toContain("登录");
    expect(visibleText(content)).not.toContain("添加 Codex 账号");
    expect(descendants(content).some(({ textContent }) => textContent === "使用重置")).toBe(false);
    scope.dispose();
  });

  it("renders remaining API credits for API Accounts without requiring an email", async () => {
    const inspectCodexAccountUsage = vi.fn(async ({ accountId }: { accountId: string }) => ({
      accountId,
      usage: null,
      accountCredits: { remaining: 42.125, unit: "USD", periodType: "unknown" as const },
      freshness: "live" as const,
      observedAt: "2026-09-10T03:32:00.000Z",
    }));
    const client = {
      listCodexAccounts: vi.fn(async () =>
        accountSnapshot([
          {
            accountId: "bank",
            label: "BANK OF TOKEN",
            authKind: "api" as const,
            authIdentity: "BANK OF TOKEN",
          },
        ]),
      ),
      inspectCodexAccountUsage,
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("zh-CN"),
      () => null,
      () => null,
      () => client,
    ).find(({ id }) => id === "accounts");
    if (!page) throw new Error("Accounts page is not registered");
    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });
    await vi.waitFor(() =>
      expect(inspectCodexAccountUsage).toHaveBeenCalledWith({ accountId: "bank" }),
    );
    expect(visibleText(content)).toContain("API 接入");
    expect(visibleText(content)).toContain("API - BANK OF TOKEN");
    expect(visibleText(content)).toContain("$42.125");
    expect(
      descendants(content)
        .filter((element) => element.tagName === "button")
        .map((element) => element.textContent),
    ).not.toContain("登录");
    expect(
      descendants(content).filter((element) => element.getAttribute("role") === "meter"),
    ).toHaveLength(0);
    scope.dispose();
  });
});

describe("Renderer Updates page", () => {
  it.each(["succeeded", "failed"] as const)(
    "keeps polling after start/status timeouts until the Host reports %s",
    async (terminalPhase) => {
      vi.useFakeTimers();
      const request = deferred<{ status: UpdateStatus }>();
      const client = {
        checkUpdate: vi.fn(async () => updateCheck()),
        startUpdate: vi.fn(() => request.promise),
        readUpdateStatus: vi
          .fn<() => Promise<{ status: UpdateStatus | null }>>()
          .mockRejectedValueOnce(new RendererUpdateRequestTimeoutError())
          .mockResolvedValueOnce({ status: null })
          .mockResolvedValueOnce({ status: updateStatus("prepared") })
          .mockResolvedValueOnce({ status: updateStatus("downloading") })
          .mockResolvedValueOnce({ status: updateStatus(terminalPhase) }),
      };
      const page = createDefaultRendererSettingsPages(undefined, () => client).find(
        ({ id }) => id === "updates",
      );
      if (!page) throw new Error("Updates page is not registered");
      const document = new FakeDocument();
      const content = document.createElement("main");
      const scope = new RendererSettingsPageScope();
      const cleanup = page.mount({
        content: content as unknown as HTMLElement,
        signal: scope.signal,
        runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
      });
      try {
        await vi.advanceTimersByTimeAsync(0);
        const panel = elementWithClass(content, "settings-update-panel");
        const button = descendants(panel).find(({ tagName }) => tagName === "button");
        if (!button) throw new Error("Update button is not rendered");
        button.dispatch("click");
        await vi.advanceTimersByTimeAsync(RENDERER_UPDATE_REQUEST_TIMEOUT_MS);
        expect(panel.dataset.updateState).toBe("pending");
        for (const [index, phase] of [
          "pending",
          "pending",
          "prepared",
          "downloading",
          terminalPhase,
        ].entries()) {
          expect(document.defaultView.setTimeout).toHaveBeenCalledTimes(index + 1);
          const poll = vi.mocked(document.defaultView.setTimeout).mock.calls.at(-1)?.[0];
          if (typeof poll !== "function") throw new Error("Missing status poll callback");
          poll();
          await vi.advanceTimersByTimeAsync(0);
          expect(panel.dataset.updateState).toBe(phase);
        }
        expect(client.startUpdate).toHaveBeenCalledOnce();
        expect(client.readUpdateStatus).toHaveBeenCalledTimes(5);
        expect(document.defaultView.setTimeout).toHaveBeenCalledTimes(5);
        request.resolve({ status: updateStatus("prepared") });
        await vi.advanceTimersByTimeAsync(0);
        expect(panel.dataset.updateState).toBe(terminalPhase);
      } finally {
        cleanup?.();
        scope.dispose();
        vi.useRealTimers();
      }
    },
  );

  it.each([
    [updateStatus("prepared"), "正在准备更新..."],
    [updateStatus("waiting-for-exit"), "正在等待应用退出..."],
    [updateStatus("installing"), "正在通过 npm 安装..."],
    [updateStatus("installing", "windows-installer"), "正在安装更新..."],
    [updateStatus("restarting"), "正在重启以完成更新..."],
    [updateStatus("failed"), "更新失败。"],
  ])("renders a distinct localized update status for $0.phase", async (status, expected) => {
    const client = {
      checkUpdate: vi.fn(async () => updateCheck(status)),
      startUpdate: vi.fn(),
      readUpdateStatus: vi.fn(async () => ({ status })),
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("zh-CN"),
      () => client,
    ).find(({ id }) => id === "updates");
    if (!page) throw new Error("Updates page is not registered");

    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    await vi.waitFor(() => {
      expect(visibleText(elementWithClass(content, "settings-update-panel"))).toContain(expected);
    });

    cleanup?.();
    scope.dispose();
  });

  it("shows only the Update action before an update starts and ignores stale success state", async () => {
    const client = {
      checkUpdate: vi.fn(async () => updateCheck(updateStatus("succeeded"))),
      startUpdate: vi.fn(),
      readUpdateStatus: vi.fn(async () => ({ status: null })),
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("zh-CN"),
      () => client,
    ).find(({ id }) => id === "updates");
    if (!page) throw new Error("Updates page is not registered");

    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    await vi.waitFor(() => {
      const panel = elementWithClass(content, "settings-update-panel");
      expect(visibleText(panel)).toContain("更新");
      expect(visibleText(panel)).not.toContain("更新安装成功");
      expect(visibleText(panel)).not.toContain("有新版本可用");
    });
    expect(client.startUpdate).not.toHaveBeenCalled();

    cleanup?.();
    scope.dispose();
  });

  it("does not repeat a stale failed update error when already on the latest version", async () => {
    const error = "macOS DMG does not contain BOFT.app";
    const client = {
      checkUpdate: vi.fn(async () => ({
        ...updateCheck({ ...updateStatus("failed"), error }),
        currentVersion: "1.2.3",
        latestVersion: "1.2.3",
        updateAvailable: false,
      })),
      startUpdate: vi.fn(),
      readUpdateStatus: vi.fn(async () => ({ status: null })),
    };
    const page = createDefaultRendererSettingsPages(undefined, () => client).find(
      ({ id }) => id === "updates",
    );
    if (!page) throw new Error("Updates page is not registered");

    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    await vi.waitFor(() => {
      const panel = elementWithClass(content, "settings-update-panel");
      expect(visibleText(panel)).toContain("You are up to date.");
      expect(visibleText(panel)).not.toContain(error);
      expect(
        descendants(panel).filter(({ className }) => className === "settings-update-error"),
      ).toHaveLength(0);
    });
    expect(
      visibleText(elementWithClass(content, "settings-update-manual-description")),
    ).not.toContain("The automatic update did not complete");

    cleanup?.();
    scope.dispose();
  });

  it("shows a failed update error once while the latest version is still available", async () => {
    const error = "macOS DMG does not contain BOFT.app";
    const client = {
      checkUpdate: vi.fn(async () => updateCheck({ ...updateStatus("failed"), error })),
      startUpdate: vi.fn(),
      readUpdateStatus: vi.fn(async () => ({ status: null })),
    };
    const page = createDefaultRendererSettingsPages(undefined, () => client).find(
      ({ id }) => id === "updates",
    );
    if (!page) throw new Error("Updates page is not registered");

    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    await vi.waitFor(() => {
      const panel = elementWithClass(content, "settings-update-panel");
      const text = visibleText(panel);
      expect(text).toContain("Update failed.");
      expect(text.split(error).length - 1).toBe(1);
      expect(
        descendants(panel).filter(({ className }) => className === "settings-update-error"),
      ).toHaveLength(1);
    });

    cleanup?.();
    scope.dispose();
  });

  it("keeps a manual GitHub Releases download available before discovery and after update failure", async () => {
    const client = {
      checkUpdate: vi.fn(async () => updateCheck()),
      startUpdate: vi.fn(async () => {
        throw new Error("download failed");
      }),
      readUpdateStatus: vi.fn(async () => ({ status: null })),
    };
    const page = createDefaultRendererSettingsPages(undefined, () => client).find(
      ({ id }) => id === "updates",
    );
    if (!page) throw new Error("Updates page is not registered");

    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    const releaseLink = descendants(content).find(
      (candidate) =>
        candidate.tagName === "a" &&
        visibleNotesText(candidate).includes("Download from GitHub Releases"),
    );
    if (!releaseLink) throw new Error("GitHub Releases link is not rendered");
    expect(releaseLink.href).toBe(CODEXHOST_RELEASES_LATEST_URL);
    expect(releaseLink.target).toBe("_blank");
    expect(releaseLink.rel).toBe("noopener noreferrer");

    await vi.waitFor(() => {
      expect(releaseLink.href).toBe("https://github.com/LiberSeek/BOFT-CLI/releases/tag/v1.2.3");
    });

    const panel = elementWithClass(content, "settings-update-panel");
    const updateButton = descendants(panel).find(({ tagName }) => tagName === "button");
    if (!updateButton) throw new Error("Update command is not rendered");
    updateButton.dispatch("click");

    await vi.waitFor(() => {
      expect(panel.dataset.updateState).toBe("failed");
    });
    expect(descendants(content)).toContain(releaseLink);
    expect(releaseLink.href).toBe("https://github.com/LiberSeek/BOFT-CLI/releases/tag/v1.2.3");

    cleanup?.();
    scope.dispose();
  });

  it("points to GitHub Releases without a retry or internal detail when the update request fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = {
      checkUpdate: vi.fn(async () => {
        throw new Error("Renderer Model request manager is unavailable");
      }),
      startUpdate: vi.fn(),
      readUpdateStatus: vi.fn(async () => ({ status: null })),
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("zh-CN"),
      () => client,
    ).find(({ id }) => id === "updates");
    if (!page) throw new Error("Updates page is not registered");

    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    const panel = elementWithClass(content, "settings-update-panel");
    await vi.waitFor(() => expect(panel.dataset.updateState).toBe("failed"));
    expect(visibleText(panel)).toContain("暂时无法自动更新");
    expect(visibleText(content)).not.toContain("request manager");
    expect(descendants(panel).find(({ tagName }) => tagName === "button")).toBeUndefined();
    expect(
      descendants(content).find(
        (candidate) =>
          candidate.tagName === "a" && visibleNotesText(candidate).includes("GitHub Releases"),
      ),
    ).toBeDefined();
    expect(client.checkUpdate).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
    cleanup?.();
    scope.dispose();
  });

  it.each([
    ["npm" as const, "Windows 暂不支持自动更新。请退出 BOFT CLI，在终端运行以下命令完成更新。"],
    [
      "windows-installer" as const,
      "Windows 暂不支持自动更新。请下载并运行适用于当前系统的安装包。",
    ],
  ])("renders manual Windows updates for %s installations", async (installation, expected) => {
    const client = {
      checkUpdate: vi.fn(async () => ({ ...updateCheck(), installation })),
      startUpdate: vi.fn(),
      readUpdateStatus: vi.fn(async () => ({ status: null })),
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("zh-CN"),
      () => client,
    ).find(({ id }) => id === "updates");
    if (!page) throw new Error("Updates page is not registered");

    const document = new FakeDocument("Win32");
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    await vi.waitFor(() => {
      expect(visibleText(content)).toContain(expected);
      expect(visibleText(elementWithClass(content, "settings-update-panel"))).toContain(
        "Windows 暂不支持自动更新",
      );
    });
    expect(
      descendants(elementWithClass(content, "settings-update-panel")).find(
        ({ tagName }) => tagName === "button",
      ),
    ).toBeUndefined();
    expect(client.startUpdate).not.toHaveBeenCalled();
    if (installation === "npm") {
      expect(visibleText(content)).toContain("npm install -g @liberseek/boft-cli@latest");
    } else {
      const link = descendants(content).find(
        ({ tagName, href }) =>
          tagName === "a" &&
          href ===
            "https://github.com/LiberSeek/BOFT-CLI/releases/download/v1.2.3/boft-cli-1.2.3-windows-x64.exe",
      );
      expect(link).toMatchObject({ target: "_blank", rel: "noopener noreferrer" });
    }

    cleanup?.();
    scope.dispose();
  });

  it("renders the open-source project introduction on the About page", () => {
    const page = createDefaultRendererSettingsPages(rendererSettingsMessages("zh-CN")).find(
      ({ id }) => id === "about",
    );
    if (!page) throw new Error("About page is not registered");

    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    const text = visibleText(content);
    expect(text).toContain("在 Codex 中运行第三方 Agent Harness 的 Extension。");
    expect(text).toContain("Codex 提供了优秀的桌面开发交互体验。");
    expect(text).toContain("Pi Agent");
    expect(text).toContain("DeepSeek Harness");
    expect(text).toContain("轻量编程 Agent");
    expect(text).toContain("深度求索原生 Harness");
    expect(text).toContain("让你便捷地在 Codex 中尽情体验");
    expect(text).toContain("同时保留 Codex 的原生体验");
    expect(text).not.toContain("我们认为 Codex Desktop 提供了目前最好的桌面开发交互体验");
    expect(text).toMatch(/BOFT CLI\s+是开源项目。/);
    expect(text).not.toContain("开源地址");
    expect(text).not.toContain("开源仓库");
    expect(text).not.toContain("https://github.com/LiberSeek/BOFT-CLI");
    expect(text).toContain("请给我们一个 Star");
    expect(text).toContain("LIBERSEEK");
    expect(text).toContain("向未来探索");
    const aboutPage = elementWithClass(content, "settings-about-page");
    const panels = aboutPage.children.filter(
      (child) => child instanceof FakeElement && child.className.includes("settings-about-panel"),
    );
    expect(panels).toHaveLength(2);
    expect(visibleText(panels[0] as FakeElement)).toContain("BOFT CLI");
    expect(visibleText(panels[0] as FakeElement)).toContain(
      "在 Codex 中运行第三方 Agent Harness 的 Extension。",
    );
    expect(visibleText(panels[0] as FakeElement)).toContain("Pi Agent");
    expect(visibleText(panels[0] as FakeElement)).toContain("DeepSeek Harness");
    expect(visibleText(panels[1] as FakeElement)).toMatch(/BOFT CLI\s+是开源项目。/);
    expect(visibleText(panels[1] as FakeElement)).toContain("请给我们一个 Star");
    expect(visibleText(panels[0] as FakeElement)).not.toContain("LIBERSEEK");
    expect(visibleText(panels[1] as FakeElement)).not.toContain("LIBERSEEK");
    const repository = descendants(content).find(
      ({ tagName, href }) => tagName === "a" && href === "https://github.com/LiberSeek/BOFT-CLI",
    );
    expect(repository).toMatchObject({
      className: "settings-about-repository-link",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(visibleNotesText(repository as FakeElement)).toContain("BOFT CLI");
    expect(visibleNotesText(repository as FakeElement)).toContain("github-icon");
    const brand = descendants(content).find(
      ({ tagName, href }) => tagName === "a" && href === "https://supply.boft.ai",
    );
    expect(brand).toMatchObject({
      className: "settings-about-brand",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(aboutPage.children.at(-1)).toBe(brand);
    const brandVideo = descendants(content).find(({ tagName }) => tagName === "video") as
      (FakeElement & { src?: string }) | undefined;
    expect(brandVideo?.src).toMatch(/^data:video\/mp4/);
    expect(text.indexOf("是开源项目。")).toBeLessThan(text.indexOf("请给我们一个 Star"));
    expect(text.indexOf("请给我们一个 Star")).toBeLessThan(text.indexOf("LIBERSEEK"));

    cleanup?.();
    scope.dispose();
  });

  it("renders GitHub Release notes as structured Markdown", async () => {
    const client = {
      checkUpdate: vi.fn(async () => ({
        ...updateCheck(),
        releaseNotes: "## 本次发布\n\n- 新增 Grok CLI adapter\n- 集成 DeepSeek Harness",
      })),
      startUpdate: vi.fn(),
      readUpdateStatus: vi.fn(async () => ({ status: null })),
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("zh-CN"),
      () => client,
    ).find(({ id }) => id === "updates");
    if (!page) throw new Error("Updates page is not registered");

    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    const cleanup = page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    await vi.waitFor(() => {
      expect(elementWithClass(content, "settings-update-notes").children[0]).toMatchObject({
        tagName: "h2",
      });
    });
    const panel = elementWithClass(content, "settings-update-panel");
    const controls = elementWithClass(content, "settings-update-controls");
    const notes = elementWithClass(content, "settings-update-notes");
    const updateButton = descendants(panel).find(({ tagName }) => tagName === "button");
    if (!updateButton) throw new Error("Update command is not rendered");
    // Status and the update action come first; the manual fallback stays visible
    // right below it, and release notes render last.
    expect(content.children.indexOf(panel)).toBeLessThan(content.children.indexOf(controls));
    expect(content.children.indexOf(controls)).toBeLessThan(
      content.children.indexOf(elementWithClass(content, "settings-update-notes-section")),
    );
    expect(descendants(panel)).toContain(updateButton);
    expect(descendants(panel)).not.toContain(notes);
    expect(notes.children.map((child) => (child as FakeElement).tagName)).toEqual(["h2", "ul"]);
    expect(visibleNotesText(notes)).toContain("本次发布");
    expect(visibleNotesText(notes)).toContain("新增 Grok CLI adapter");
    expect(visibleNotesText(notes)).not.toContain("##");
    expect(visibleNotesText(notes)).not.toContain("- 新增");

    cleanup?.();
    scope.dispose();
  });
});

describe("Renderer Session Import page", () => {
  it("configures page size, searches all metadata, rejects stale searches and locks controls during import", async () => {
    const rows = Array.from({ length: 45 }, (_, index) => ({
      nativeSessionId: `session-${index}`,
      title: `Session ${index}`,
      cwd: "C:\\work",
      updatedAt: 1_000,
      running: null,
    }));
    const slow = deferred<{ candidates: typeof rows; total: number }>();
    const imported = deferred<{ threadId: ReturnType<typeof hostThreadIdSchema.parse> }>();
    const client = {
      listSessionImportSources: vi.fn(async () => ({
        harnesses: [{ harnessId: harnessIdSchema.parse("pi"), name: "Pi" }],
      })),
      listHarnessSessions: vi.fn(
        async ({ query = "", offset = 0, limit = 20 }: HarnessSessionListParams) => {
          if (query === "slow") return slow.promise;
          const matched = rows.filter((row) =>
            row.title.toLowerCase().includes(query.toLowerCase()),
          );
          return { candidates: matched.slice(offset, offset + limit), total: matched.length };
        },
      ),
      importHarnessSession: vi.fn(() => imported.promise),
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("en"),
      () => null,
      () => null,
      () => null,
      () => client,
      async () => undefined,
    ).find(({ id }) => id === "session-import");
    if (!page) throw new Error("Import page missing");
    const content = new FakeDocument().createElement("main");
    const scope = new RendererSettingsPageScope();
    page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });
    const action = (name: string): FakeElement => {
      const element = descendants(content).find(
        ({ dataset }) => dataset.sessionImportAction === name,
      );
      if (!element) throw new Error(`Missing control ${name}`);
      return element;
    };
    const visibleRows = () =>
      descendants(content).filter(({ dataset }) => dataset.sessionImportId !== undefined);
    const search = (query: string): void => {
      action("search-input").value = query;
      descendants(content)
        .find(({ tagName }) => tagName === "form")
        ?.dispatch("submit", { preventDefault: vi.fn() });
    };
    await vi.waitFor(() => expect(visibleRows()).toHaveLength(20));
    expect(visibleText(content)).not.toContain("Activity unknown");
    expect(action("previous").disabled).toBe(true);
    expect(action("page-summary").textContent).toBe("45 records / 1-20");
    action("next").dispatch("click");
    await vi.waitFor(() => expect(visibleRows()[0]?.dataset.sessionImportId).toBe("session-20"));
    action("next").dispatch("click");
    await vi.waitFor(() => expect(visibleRows()).toHaveLength(5));
    expect(action("next").disabled).toBe(true);
    action("previous").dispatch("click");
    await vi.waitFor(() => expect(action("page-summary").textContent).toBe("45 records / 21-40"));
    action("page-size").value = "50";
    action("page-size").dispatch("change");
    await vi.waitFor(() => expect(visibleRows()).toHaveLength(45));
    expect(client.listHarnessSessions).toHaveBeenLastCalledWith({
      harnessId: "pi",
      query: "",
      offset: 0,
      limit: 50,
    });
    search("slow");
    await vi.waitFor(() =>
      expect(client.listHarnessSessions).toHaveBeenLastCalledWith({
        harnessId: "pi",
        query: "slow",
        offset: 0,
        limit: 50,
      }),
    );
    search("SESSION 32");
    await vi.waitFor(() => expect(visibleRows()).toHaveLength(1));
    expect(visibleRows()[0]?.dataset.sessionImportId).toBe("session-32");
    slow.resolve({ candidates: rows, total: 45 });
    await slow.promise;
    await Promise.resolve();
    expect(visibleRows()).toHaveLength(1);
    expect(action("page-summary").textContent).toBe("1 records / 1-1");
    search("absent");
    await vi.waitFor(() => expect(visibleText(content)).toContain("No sessions match"));
    expect(action("previous").disabled).toBe(true);
    expect(action("next").disabled).toBe(true);
    search("Session 32");
    await vi.waitFor(() => expect(visibleRows()).toHaveLength(1));
    action("import").dispatch("click");
    expect(action("search-input").disabled).toBe(true);
    expect(action("page-size").disabled).toBe(true);
    search("absent"); // Synthetic submission must not invalidate a pending import.
    imported.resolve({ threadId: hostThreadIdSchema.parse("imported") });
    await vi.waitFor(() => expect(action("search-input").disabled).toBe(false));
    expect(client.listHarnessSessions).toHaveBeenLastCalledWith({
      harnessId: "pi",
      query: "Session 32",
      offset: 0,
      limit: 50,
    });
    scope.dispose();
  });

  it("returns to a valid page when refresh removes the current last page", async () => {
    const rows = Array.from({ length: 41 }, (_, index) => ({
      nativeSessionId: `row-${index}`,
      title: null,
      cwd: "C:\\work",
      updatedAt: 1,
      running: null,
    }));
    const client = {
      listSessionImportSources: vi.fn(async () => ({
        harnesses: [{ harnessId: harnessIdSchema.parse("pi"), name: "Pi" }],
      })),
      listHarnessSessions: vi.fn(async ({ offset = 0, limit = 20 }: HarnessSessionListParams) => ({
        candidates: rows.slice(offset, offset + limit),
        total: rows.length,
      })),
      importHarnessSession: vi.fn(),
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("en"),
      () => null,
      () => null,
      () => null,
      () => client,
    ).find(({ id }) => id === "session-import");
    if (!page) throw new Error("Import page missing");
    const content = new FakeDocument().createElement("main");
    const scope = new RendererSettingsPageScope();
    page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });
    const control = (name: string) =>
      descendants(content).find(({ dataset }) => dataset.sessionImportAction === name);
    await vi.waitFor(() => expect(control("page-summary")?.textContent).toBe("41 records / 1-20"));
    control("next")?.dispatch("click");
    await vi.waitFor(() => expect(control("page-summary")?.textContent).toBe("41 records / 21-40"));
    control("next")?.dispatch("click");
    await vi.waitFor(() => expect(control("page-summary")?.textContent).toBe("41 records / 41-41"));
    rows.splice(1);
    control("refresh")?.dispatch("click");
    await vi.waitFor(() => expect(control("page-summary")?.textContent).toBe("1 records / 1-1"));
    expect(client.listHarnessSessions).toHaveBeenLastCalledWith({
      harnessId: "pi",
      query: "",
      offset: 0,
      limit: 20,
    });
    expect(
      descendants(content).filter(({ dataset }) => dataset.sessionImportId !== undefined),
    ).toHaveLength(1);
    scope.dispose();
  });

  it("discovers Harness options, ignores stale Harness results, and imports Pi with an activity warning", async () => {
    const oldList = deferred<{ candidates: []; total: number }>();
    const client = {
      listSessionImportSources: vi.fn(async () => ({
        harnesses: [
          { harnessId: harnessIdSchema.parse("deepseek-harness"), name: "DeepSeek Harness" },
          { harnessId: harnessIdSchema.parse("pi"), name: "Pi" },
        ],
      })),
      listHarnessSessions: vi.fn(async ({ harnessId }: { harnessId: string }) =>
        harnessId === "deepseek-harness"
          ? oldList.promise
          : {
              total: 1,
              candidates: [
                {
                  nativeSessionId: "pi-session",
                  title: "Pi original",
                  cwd: "C:\\work",
                  running: null,
                  updatedAt: 1_000,
                },
              ],
            },
      ),
      importHarnessSession: vi.fn(async () => ({
        threadId: hostThreadIdSchema.parse("pi-imported"),
      })),
    };
    const open = vi.fn(async () => undefined);
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("en"),
      () => null,
      () => null,
      () => null,
      () => client,
      open,
    ).find(({ id }) => id === "session-import");
    if (!page) throw new Error("Session import page missing");
    const content = new FakeDocument().createElement("main");
    const scope = new RendererSettingsPageScope();
    page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });
    await vi.waitFor(() =>
      expect(client.listHarnessSessions).toHaveBeenCalledWith({
        harnessId: "deepseek-harness",
        query: "",
        offset: 0,
        limit: 20,
      }),
    );
    const options = descendants(content).filter(
      ({ dataset }) => dataset.sessionImportHarnessOption !== undefined,
    );
    expect(options.map(({ textContent }) => textContent)).toEqual(["DeepSeek Harness", "Pi"]);
    options[1]?.dispatch("click");
    await vi.waitFor(() => expect(visibleText(content)).toContain("Pi original"));
    oldList.resolve({ candidates: [], total: 0 });
    await oldList.promise;
    await Promise.resolve();
    expect(visibleText(content)).toContain("Pi original");
    expect(visibleText(content)).not.toContain("Activity unknown");
    expect(visibleText(content)).toContain("close the session in its native client");
    const button = descendants(content).find(
      ({ dataset }) => dataset.sessionImportAction === "import",
    );
    expect(button?.disabled).toBe(false);
    button?.dispatch("click");
    await vi.waitFor(() =>
      expect(client.importHarnessSession).toHaveBeenCalledWith({
        harnessId: "pi",
        nativeSessionId: "pi-session",
      }),
    );
    await vi.waitFor(() =>
      expect(open).toHaveBeenCalledWith("pi-imported", expect.any(AbortSignal), undefined),
    );
    scope.dispose();
  });

  it("renders loading and empty states, ignores an older list, and recovers through Refresh", async () => {
    const candidate = {
      nativeSessionId: "recovered-session",
      title: "Recovered session",
      updatedAt: 1_700_000_000_000,
      cwd: "C:\\work",
      running: false,
    };
    const first = deferred<{ candidates: (typeof candidate)[]; total: number }>();
    const second = deferred<{ candidates: (typeof candidate)[]; total: number }>();
    const client = {
      listSessionImportSources: vi.fn(async () => ({
        harnesses: [
          { harnessId: harnessIdSchema.parse("deepseek-harness"), name: "DeepSeek Harness" },
        ],
      })),
      listHarnessSessions: vi
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise)
        .mockRejectedValueOnce(new Error("private list detail"))
        .mockResolvedValueOnce({ candidates: [candidate], total: 1 }),
      importHarnessSession: vi.fn(),
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("en"),
      () => null,
      () => null,
      () => null,
      () => client,
    ).find(({ id }) => id === "session-import");
    if (!page) throw new Error("Session Import page is not registered");
    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });
    const refresh = descendants(content).find(
      ({ dataset }) => dataset.sessionImportAction === "refresh",
    );
    if (!refresh) throw new Error("Session Import Refresh is not rendered");

    expect(refresh.disabled).toBe(true);
    expect(visibleNotesText(refresh)).toContain("Loading sessions from the selected Host");
    expect(visibleText(content)).toContain("Loading sessions from the selected Host");

    await vi.waitFor(() => expect(client.listHarnessSessions).toHaveBeenCalledOnce());
    // A synthetic second activation proves runLatest still rejects stale results even if
    // browser-level disabled handling is bypassed.
    refresh.dispatch("click");
    second.resolve({ candidates: [], total: 0 });
    await vi.waitFor(() =>
      expect(visibleText(content)).toContain("No sessions are available to import"),
    );
    expect(refresh.disabled).toBe(false);

    first.resolve({
      total: 1,
      candidates: [{ ...candidate, nativeSessionId: "stale-session", title: "Ignored stale" }],
    });
    await first.promise;
    await Promise.resolve();
    expect(visibleText(content)).toContain("No sessions are available to import");
    expect(visibleText(content)).not.toContain("Ignored stale");

    refresh.dispatch("click");
    await vi.waitFor(() => expect(visibleText(content)).toContain("could not be loaded"));
    expect(visibleText(content)).not.toContain("private list detail");

    refresh.dispatch("click");
    await vi.waitFor(() => expect(visibleText(content)).toContain("Recovered session"));
    expect(client.listHarnessSessions).toHaveBeenCalledTimes(4);
    scope.dispose();
  });

  it("lists Host-scoped sessions and opens the imported Thread on the same Host", async () => {
    const client = {
      hostId: "remote-1",
      listSessionImportSources: vi.fn(async () => ({
        harnesses: [
          { harnessId: harnessIdSchema.parse("deepseek-harness"), name: "DeepSeek Harness" },
        ],
      })),
      listHarnessSessions: vi.fn(async () => ({
        total: 2,
        candidates: [
          {
            nativeSessionId: "idle-session-identifier-that-is-long",
            title: "既有会话",
            updatedAt: 1_700_000_000_000,
            cwd: "C:\\work\\idle",
            running: false,
          },
          {
            nativeSessionId: "running-session",
            title: null,
            updatedAt: 1_700_000_001_000,
            cwd: "C:\\work\\running",
            running: true,
          },
        ],
      })),
      importHarnessSession: vi.fn(async () => ({
        threadId: hostThreadIdSchema.parse("imported-thread"),
      })),
    };
    const openImportedThread = vi.fn(async () => undefined);
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("zh-CN"),
      () => null,
      () => null,
      () => null,
      () => client,
      openImportedThread,
    ).find(({ id }) => id === "session-import");
    if (!page) throw new Error("Session Import page is not registered");
    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    await vi.waitFor(() =>
      expect(client.listHarnessSessions).toHaveBeenCalledWith({
        harnessId: "deepseek-harness",
        query: "",
        offset: 0,
        limit: 20,
      }),
    );
    await vi.waitFor(() => expect(visibleText(content)).toContain("既有会话"));
    expect(visibleText(content)).toContain("未命名会话");
    expect(visibleText(content)).toContain("运行中");
    const visualIdentity = descendants(content).find(
      ({ attributes, textContent }) =>
        attributes.get("aria-hidden") === "true" && textContent.startsWith("会话 ID:"),
    );
    expect(visualIdentity?.textContent).not.toContain("idle-session-identifier-that-is-long");
    expect(visualIdentity?.title).toBe("idle-session-identifier-that-is-long");
    const header = elementWithClass(content, "settings-connection-page-header");
    expect(visibleText(header)).toContain("会话导入");
    expect(visibleText(header)).toContain(
      "会话将保留原始项目路径；若该文件夹尚未出现在 Codex 侧栏，请先将其添加为项目。原始历史仍由 Harness 管理。",
    );
    expect(visibleText(header)).not.toContain(
      "当前仅支持导入 DeepSeek Harness Modern 会话；其他 Harness 的会话导入能力敬请期待。",
    );
    expect(visibleText(header)).toContain(
      "可选 Harness 来自当前 Host。运行状态未知时，请先在原生客户端关闭该会话再导入，避免同时写入。",
    );
    expect(descendants(content).some(({ textContent }) => textContent === "Harness")).toBe(false);
    const harnessSelector = descendants(content).find(
      ({ dataset }) => dataset.sessionImportHarness === "selector",
    );
    if (!harnessSelector) throw new Error("Session Import Harness selector is not rendered");
    const harnessOptions = descendants(harnessSelector).filter(
      ({ dataset }) => dataset.sessionImportHarnessOption !== undefined,
    );
    expect(harnessOptions.map(({ textContent }) => textContent)).toEqual(["DeepSeek Harness"]);
    expect(
      harnessOptions.filter(({ disabled }) => !disabled).map(({ textContent }) => textContent),
    ).toEqual(["DeepSeek Harness"]);
    expect(
      harnessOptions.find(({ attributes }) => attributes.get("aria-pressed") === "true")
        ?.textContent,
    ).toBe("DeepSeek Harness");
    for (const option of harnessOptions) option.dispatch("click");
    expect(client.listHarnessSessions).toHaveBeenCalledOnce();
    expect(client.importHarnessSession).not.toHaveBeenCalled();
    expect(
      descendants(content).find(
        ({ className, textContent }) =>
          className === "settings-visually-hidden" &&
          textContent.includes("idle-session-identifier-that-is-long"),
      )?.textContent,
    ).toContain("idle-session-identifier-that-is-long");
    expect(
      descendants(content).find(
        ({ className, textContent }) =>
          className === "settings-visually-hidden" && textContent.startsWith("运行中:"),
      )?.textContent,
    ).toBe("运行中: 请先在原生客户端关闭该会话，再刷新并导入。");

    const actions = descendants(content).filter(
      ({ dataset }) => dataset.sessionImportAction === "import",
    );
    expect(actions).toHaveLength(2);
    expect(actions[0]?.disabled).toBe(false);
    expect(actions[1]?.disabled).toBe(true);
    actions[1]?.dispatch("click");
    expect(client.importHarnessSession).not.toHaveBeenCalled();
    actions[0]?.dispatch("click");
    expect(descendants(content)).toContain(actions[0]);
    expect(actions[0]?.getAttribute("aria-disabled")).toBe("true");
    expect(actions[0]?.getAttribute("aria-busy")).toBe("true");
    actions[0]?.dispatch("click");
    await vi.waitFor(() => expect(client.importHarnessSession).toHaveBeenCalledOnce());
    expect(client.importHarnessSession).toHaveBeenCalledWith({
      harnessId: "deepseek-harness",
      nativeSessionId: "idle-session-identifier-that-is-long",
    });
    await vi.waitFor(() =>
      expect(openImportedThread).toHaveBeenCalledWith(
        "imported-thread",
        expect.any(AbortSignal),
        "remote-1",
      ),
    );
    scope.dispose();
  });

  it("shows a localized focused error when import fails before commit", async () => {
    const client = {
      listSessionImportSources: vi.fn(async () => ({
        harnesses: [
          { harnessId: harnessIdSchema.parse("deepseek-harness"), name: "DeepSeek Harness" },
        ],
      })),
      listHarnessSessions: vi.fn(async () => ({
        total: 1,
        candidates: [
          {
            nativeSessionId: "idle-session",
            title: "Import candidate",
            updatedAt: 1_700_000_000_000,
            cwd: "C:\\work",
            running: false,
          },
        ],
      })),
      importHarnessSession: vi.fn(async () => Promise.reject(new Error("private import detail"))),
    };
    const openImportedThread = vi.fn();
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("en"),
      () => null,
      () => null,
      () => null,
      () => client,
      openImportedThread,
    ).find(({ id }) => id === "session-import");
    if (!page) throw new Error("Session Import page is not registered");
    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });
    await vi.waitFor(() => expect(visibleText(content)).toContain("Import candidate"));

    descendants(content)
      .find(({ dataset }) => dataset.sessionImportAction === "import")
      ?.dispatch("click");

    await vi.waitFor(() => expect(visibleText(content)).toContain("could not be imported"));
    expect(elementWithClass(content, "settings-session-import-status").focused).toBe(true);
    expect(visibleText(content)).not.toContain("private import detail");
    expect(openImportedThread).not.toHaveBeenCalled();
    expect(
      descendants(content).find(({ dataset }) => dataset.sessionImportAction === "refresh")
        ?.disabled,
    ).toBe(false);
    scope.dispose();
  });

  it("coalesces import across page remount and lets only the current scope navigate", async () => {
    const imported = deferred<unknown>();
    const candidate = {
      nativeSessionId: "remounted-session",
      title: "Remounted session",
      updatedAt: 1_700_000_000_000,
      cwd: "C:\\work",
      running: false,
    };
    const sendRequest = vi.fn((method: string): Promise<unknown> => {
      if (method === HARNESS_SESSION_LIST_METHOD) {
        return Promise.resolve({ candidates: [candidate], total: 1 });
      }
      if (method === HARNESS_SESSION_IMPORT_METHOD) return imported.promise;
      return Promise.reject(new Error(`Unexpected method: ${method}`));
    });
    const modelClient = createRendererModelClient([{ sendRequest }]);
    if (!modelClient?.listHarnessSessions || !modelClient.importHarnessSession) {
      throw new Error("DSH Modern Session client was not created");
    }
    const client = {
      listSessionImportSources: vi.fn(async () => ({
        harnesses: [
          { harnessId: harnessIdSchema.parse("deepseek-harness"), name: "DeepSeek Harness" },
        ],
      })),
      listHarnessSessions: modelClient.listHarnessSessions,
      importHarnessSession: modelClient.importHarnessSession,
    };
    const navigated: string[] = [];
    const openImportedThread = vi.fn(async (threadId: string, signal: AbortSignal) => {
      if (signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      navigated.push(threadId);
    });
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("en"),
      () => null,
      () => null,
      () => null,
      () => client,
      openImportedThread,
    ).find(({ id }) => id === "session-import");
    if (!page) throw new Error("Session Import page is not registered");

    const firstDocument = new FakeDocument();
    const firstContent = firstDocument.createElement("main");
    const firstScope = new RendererSettingsPageScope();
    page.mount({
      content: firstContent as unknown as HTMLElement,
      signal: firstScope.signal,
      runLatest: (operation, handlers) => firstScope.runLatest(operation, handlers),
    });
    await vi.waitFor(() => expect(visibleText(firstContent)).toContain("Remounted session"));
    descendants(firstContent)
      .find(({ dataset }) => dataset.sessionImportAction === "import")
      ?.dispatch("click");
    await vi.waitFor(() =>
      expect(
        sendRequest.mock.calls.filter(([method]) => method === HARNESS_SESSION_IMPORT_METHOD),
      ).toHaveLength(1),
    );
    const staleContent = visibleText(firstContent);
    firstScope.dispose();

    const currentDocument = new FakeDocument();
    const currentContent = currentDocument.createElement("main");
    const currentScope = new RendererSettingsPageScope();
    page.mount({
      content: currentContent as unknown as HTMLElement,
      signal: currentScope.signal,
      runLatest: (operation, handlers) => currentScope.runLatest(operation, handlers),
    });
    await vi.waitFor(() => expect(visibleText(currentContent)).toContain("Remounted session"));
    descendants(currentContent)
      .find(({ dataset }) => dataset.sessionImportAction === "import")
      ?.dispatch("click");
    expect(
      sendRequest.mock.calls.filter(([method]) => method === HARNESS_SESSION_IMPORT_METHOD),
    ).toHaveLength(1);

    imported.resolve({ threadId: "imported-thread" });
    await vi.waitFor(() => expect(navigated).toEqual(["imported-thread"]));
    expect(visibleText(firstContent)).toBe(staleContent);
    currentScope.dispose();
  });

  it("localizes unavailable and ordinary list failures without exposing their detail", async () => {
    const messages = rendererSettingsMessages("zh-CN");
    const document = new FakeDocument();
    for (const [error, expected] of [
      [new RendererSessionImportUnavailableError(), messages.sessionImportUnavailable],
      [new Error("private native failure detail"), messages.sessionImportLoadFailed],
    ] as const) {
      const client = {
        listSessionImportSources: vi.fn(async () => ({
          harnesses: [
            { harnessId: harnessIdSchema.parse("deepseek-harness"), name: "DeepSeek Harness" },
          ],
        })),
        listHarnessSessions: vi.fn(async () => Promise.reject(error)),
        importHarnessSession: vi.fn(),
      };
      const page = createDefaultRendererSettingsPages(
        messages,
        () => null,
        () => null,
        () => null,
        () => client,
      ).find(({ id }) => id === "session-import");
      if (!page) throw new Error("Session Import page is not registered");
      const content = document.createElement("main");
      const scope = new RendererSettingsPageScope();
      page.mount({
        content: content as unknown as HTMLElement,
        signal: scope.signal,
        runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
      });

      await vi.waitFor(() => expect(visibleText(content)).toContain(expected));
      expect(visibleText(content)).not.toContain(error.message);
      scope.dispose();
    }
  });

  it("keeps project recovery actions after committed import navigation fails", async () => {
    const client = {
      listSessionImportSources: vi.fn(async () => ({
        harnesses: [
          { harnessId: harnessIdSchema.parse("deepseek-harness"), name: "DeepSeek Harness" },
        ],
      })),
      listHarnessSessions: vi.fn(async () => ({
        total: 1,
        candidates: [
          {
            nativeSessionId: "idle-session",
            title: null,
            updatedAt: 1_700_000_000_000,
            cwd: "C:\\work",
            running: false,
          },
        ],
      })),
      importHarnessSession: vi.fn(async () => ({
        threadId: hostThreadIdSchema.parse("imported-thread"),
      })),
    };
    const openImportedThread = vi
      .fn()
      .mockRejectedValueOnce(new Error("private navigation detail"))
      .mockResolvedValueOnce(undefined);
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("en"),
      () => null,
      () => null,
      () => null,
      () => client,
      openImportedThread,
    ).find(({ id }) => id === "session-import");
    if (!page) throw new Error("Session Import page is not registered");
    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });
    await vi.waitFor(() => expect(visibleText(content)).toContain("Untitled session"));

    descendants(content)
      .find(({ dataset }) => dataset.sessionImportAction === "import")
      ?.dispatch("click");

    await vi.waitFor(() => expect(visibleText(content)).toContain("Session imported"));
    const recovery = elementWithClass(content, "settings-session-import-recovery");
    expect(recovery.focused).toBe(true);
    expect(visibleText(content)).toContain("C:\\work");
    expect(visibleText(content)).toContain("added as a project");
    expect(visibleText(content)).not.toContain("private navigation detail");

    const copyPath = descendants(content).find(
      ({ dataset }) => dataset.sessionImportAction === "copy-project-path",
    );
    if (!copyPath) throw new Error("Copy project path action is not rendered");
    copyPath.dispatch("click");
    await vi.waitFor(() => expect(document.clipboardWriteText).toHaveBeenCalledWith("C:\\work"));
    expect(visibleNotesText(copyPath)).toContain("Copied");

    const retry = descendants(content).find(
      ({ dataset }) => dataset.sessionImportAction === "retry-open",
    );
    if (!retry) throw new Error("Retry open action is not rendered");
    retry.dispatch("click");
    expect(retry.disabled).toBe(true);
    expect(retry.getAttribute("aria-busy")).toBe("true");
    expect(
      descendants(content).find(({ dataset }) => dataset.sessionImportAction === "refresh")
        ?.disabled,
    ).toBe(true);
    await vi.waitFor(() => expect(openImportedThread).toHaveBeenCalledTimes(2));
    expect(client.importHarnessSession).toHaveBeenCalledOnce();
    scope.dispose();
  });

  it("shows an honest unavailable state without a local import client", () => {
    const page = createDefaultRendererSettingsPages(rendererSettingsMessages("en")).find(
      ({ id }) => id === "session-import",
    );
    if (!page) throw new Error("Session Import page is not registered");
    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });

    expect(visibleText(content)).toContain("Session import is unavailable for this Harness");
    expect(
      descendants(content).filter(({ dataset }) => dataset.sessionImportAction === "import"),
    ).toHaveLength(0);
    scope.dispose();
  });

  it("ignores a Session list that resolves after the settings page is disposed", async () => {
    const listed = deferred<{ candidates: never[]; total: number }>();
    const client = {
      listSessionImportSources: vi.fn(async () => ({
        harnesses: [
          { harnessId: harnessIdSchema.parse("deepseek-harness"), name: "DeepSeek Harness" },
        ],
      })),
      listHarnessSessions: vi.fn(() => listed.promise),
      importHarnessSession: vi.fn(),
    };
    const page = createDefaultRendererSettingsPages(
      rendererSettingsMessages("en"),
      () => null,
      () => null,
      () => null,
      () => client,
    ).find(({ id }) => id === "session-import");
    if (!page) throw new Error("Session Import page is not registered");
    const document = new FakeDocument();
    const content = document.createElement("main");
    const scope = new RendererSettingsPageScope();
    page.mount({
      content: content as unknown as HTMLElement,
      signal: scope.signal,
      runLatest: (operation, handlers) => scope.runLatest(operation, handlers),
    });
    const before = visibleText(content);

    scope.dispose();
    listed.resolve({ candidates: [], total: 0 });
    await Promise.resolve();
    await Promise.resolve();

    expect(visibleText(content)).toBe(before);
  });
});
