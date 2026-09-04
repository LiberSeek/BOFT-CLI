import { describe, expect, it } from "vitest";

import {
  DEFAULT_RENDERER_SETTINGS_PAGE_IDS,
  createDefaultRendererSettingsPages,
  createDefaultRendererSettingsRegistry,
} from "../../src/settings/pages.js";
import {
  isRendererSettingsDialogSupported,
  resolveRendererSettingsTheme,
} from "../../src/settings/shell.js";

describe("Renderer settings foundation", () => {
  it("publishes deterministic product sections with Agents as the default", () => {
    const pages = createDefaultRendererSettingsPages();
    const registry = createDefaultRendererSettingsRegistry();

    expect(pages.map(({ id }) => id)).toEqual(DEFAULT_RENDERER_SETTINGS_PAGE_IDS);
    expect(pages.map(({ label }) => label)).toEqual(["Agents", "Plugin", "Updates", "About"]);
    expect(pages.map(({ icon }) => icon)).toEqual(["connections", "plugins", "updates", "about"]);
    expect(registry.defaultPageId).toBe("connections");
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

    expect(pages.map(({ id }) => id)).toEqual(["connections", "plugins", "updates", "about"]);
    expect(pages.find(({ id }) => id === "connections")?.mount.toString()).toContain(
      "connectionRefresh",
    );
    expect(pages.find(({ id }) => id === "plugins")?.mount.toString()).toContain("pluginsRefresh");
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
