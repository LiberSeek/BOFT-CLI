import { describe, expect, it } from "vitest";

import {
  DEFAULT_RENDERER_SETTINGS_PAGE_IDS,
  RENDERER_SETTINGS_NAV_SECTIONS,
  createDefaultRendererSettingsPages,
  createDefaultRendererSettingsRegistry,
  rendererSettingsNavSectionLabel,
} from "../../src/settings/pages.js";
import { rendererSettingsMessages } from "../../src/settings/localization.js";
import {
  RENDERER_SETTINGS_COLOR_SCHEME,
  isRendererSettingsDialogSupported,
  resolveRendererSettingsTheme,
} from "../../src/settings/shell.js";

describe("Renderer settings foundation", () => {
  it("inherits the Codex theme instead of forcing a dark settings surface", () => {
    expect(RENDERER_SETTINGS_COLOR_SCHEME).toBe("inherit");
  });

  it("publishes deterministic product sections with Agents as the default", () => {
    const pages = createDefaultRendererSettingsPages();
    const registry = createDefaultRendererSettingsRegistry();

    expect(pages.map(({ id }) => id)).toEqual(DEFAULT_RENDERER_SETTINGS_PAGE_IDS);
    expect(pages.map(({ label }) => label)).toEqual([
      "Agents",
      "Accounts",
      "Sessions",
      "Plugins",
      "Updates",
      "About",
    ]);
    expect(pages.map(({ icon }) => icon)).toEqual([
      "connections",
      "accounts",
      "session-import",
      "plugins",
      "updates",
      "about",
    ]);
    expect(registry.defaultPageId).toBe("connections");
    expect(RENDERER_SETTINGS_NAV_SECTIONS.map(({ id, pageIds }) => [id, [...pageIds]])).toEqual([
      ["connection", ["connections", "accounts", "session-import"]],
      ["general", ["plugins", "updates"]],
      ["other", ["about"]],
    ]);
    const chinese = rendererSettingsMessages("zh-CN");
    expect(rendererSettingsNavSectionLabel("connection", chinese)).toBe("连接");
    expect(rendererSettingsNavSectionLabel("general", chinese)).toBe("通用");
    expect(rendererSettingsNavSectionLabel("other", chinese)).toBe("其他");
    expect(Object.isFrozen(pages)).toBe(true);
    expect(pages.every((page) => Object.isFrozen(page))).toBe(true);
  });

  it("enables the settings trigger only for a native modal dialog surface", () => {
    expect(
      isRendererSettingsDialogSupported({ showModal() {}, close() {} } as HTMLDialogElement),
    ).toBe(true);
    expect(
      isRendererSettingsDialogSupported({
        showModal: undefined,
        close() {},
      } as unknown as HTMLDialogElement),
    ).toBe(false);
    expect(
      isRendererSettingsDialogSupported({
        showModal() {},
        close: undefined,
      } as unknown as HTMLDialogElement),
    ).toBe(false);
  });

  it("publishes only available settings pages", () => {
    const pages = createDefaultRendererSettingsPages();

    expect(pages.map(({ id }) => id)).toEqual([
      "connections",
      "accounts",
      "session-import",
      "plugins",
      "updates",
      "about",
    ]);
    expect(pages.find(({ id }) => id === "connections")?.mount.toString()).toContain(
      "connectionRefresh",
    );
    expect(pages.find(({ id }) => id === "plugins")?.mount.toString()).toContain("pluginsRefresh");
    expect(pages.find(({ id }) => id === "accounts")?.mount.toString()).toContain("accountAdd");
    expect(pages.find(({ id }) => id === "session-import")?.mount.toString()).toContain(
      "sessionImportRefresh",
    );
  });

  it("resolves settings theme from the host document color-scheme", () => {
    const createDocument = (scheme: string): Document =>
      ({
        documentElement: {},
        defaultView: {
          getComputedStyle: () => ({ colorScheme: scheme }),
        },
      }) as unknown as Document;

    expect(resolveRendererSettingsTheme(createDocument("light"))).toBe("light");
    expect(resolveRendererSettingsTheme(createDocument("dark"))).toBe("dark");
    expect(resolveRendererSettingsTheme(createDocument("light dark"))).toBe("dark");
  });
});
