import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const browserExecutable = process.env.CODEXHOST_PLAYWRIGHT_EXECUTABLE_PATH;
if (browserExecutable) test.use({ launchOptions: { executablePath: browserExecutable } });

const { outputFiles } = await build({
  stdin: {
    contents: `
      import { createAgentGroupPreferenceStore } from "./packages/renderer-extension/src/agent-group-preference.ts";
      import {
        mountRendererAgentPicker,
        renderRendererAgentPicker,
      } from "./packages/renderer-extension/src/renderer-agent-picker.ts";

      const mountShell = () => {
        document.documentElement.style.setProperty("--codex-window-zoom", "1.6");

        const shell = document.createElement("div");
        shell.style.position = "fixed";
        shell.style.inset = "0";
        shell.style.display = "flex";
        shell.style.alignItems = "flex-end";
        shell.style.justifyContent = "center";
        shell.style.boxSizing = "border-box";
        shell.style.paddingBottom = "60px";
        shell.style.width = "calc(100vw / var(--codex-window-zoom))";
        shell.style.height = "calc(100vh / var(--codex-window-zoom))";
        shell.style.zoom = "var(--codex-window-zoom)";
        document.body.append(shell);
        return shell;
      };

      globalThis.setupRendererAgentPicker = () => {
        const control = mountRendererAgentPicker(
          "test-composer",
          ["codex", "pi"],
          () => {},
          () => {},
          () => {},
        );
        mountShell().append(control.root);
        renderRendererAgentPicker(
          control,
          { agent: "codex", phase: "draft" },
          "ready",
          false,
          { pi: "ready" },
        );
      };

      globalThis.setupRendererAgentPickerWithMore = () => {
        const groups = createAgentGroupPreferenceStore(null);
        groups.moveAgent("pi", "more");
        groups.moveAgent("grok", "more");
        const control = mountRendererAgentPicker(
          "test-composer",
          ["codex", "pi", "claude-code", "grok"],
          () => {},
          () => {},
          () => {},
          undefined,
          groups,
        );
        mountShell().append(control.root);
        renderRendererAgentPicker(
          control,
          { agent: "codex", phase: "draft" },
          "ready",
          false,
          { pi: "ready", "claude-code": "ready", grok: "notInstalled" },
        );
      };
    `,
    resolveDir: repositoryRoot,
    sourcefile: "renderer-agent-picker-e2e-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  loader: { ".png": "dataurl", ".svg": "dataurl" },
  platform: "browser",
  target: "es2024",
  write: false,
});

const browserBundle = outputFiles[0]?.text;
if (!browserBundle) throw new Error("Renderer Agent picker E2E bundle was not generated");

test("keeps the Agent menu anchored inside the Codex window zoom", async ({ page }) => {
  await page.setViewportSize({ width: 1_920, height: 1_440 });
  await page.setContent('<!doctype html><body style="margin:0"></body>');
  await page.addScriptTag({ content: browserBundle });
  await page.evaluate(() => {
    const setup = Reflect.get(globalThis, "setupRendererAgentPicker");
    if (typeof setup !== "function") throw new Error("Agent picker setup is unavailable");
    setup();
  });

  const trigger = page.locator(
    '[data-codexhost-agent-control="test-composer"] > button[aria-haspopup="menu"]',
  );
  const menu = page.locator("#test-composer-agent-menu");
  await trigger.click();
  await expect(menu).toBeVisible();

  const [triggerBox, menuBox] = await Promise.all([trigger.boundingBox(), menu.boundingBox()]);
  if (!triggerBox || !menuBox) throw new Error("Agent picker geometry is unavailable");

  expect(menuBox.x + menuBox.width).toBeCloseTo(triggerBox.x + triggerBox.width, 0);
  expect(menuBox.width).toBeCloseTo(224 * 1.6, 0);
  expect(triggerBox.y - (menuBox.y + menuBox.height)).toBeCloseTo(6 * 1.6, 0);
});

test("expands More Agents upward with a trailing Settings icon", async ({ page }) => {
  await page.setViewportSize({ width: 1_920, height: 1_440 });
  await page.setContent('<!doctype html><body style="margin:0"></body>');
  await page.addScriptTag({ content: browserBundle });
  await page.evaluate(() => {
    const setup = Reflect.get(globalThis, "setupRendererAgentPickerWithMore");
    if (typeof setup !== "function") throw new Error("Agent picker setup is unavailable");
    setup();
  });

  const trigger = page.locator(
    '[data-codexhost-agent-control="test-composer"] > button[aria-haspopup="menu"]',
  );
  const menu = page.locator("#test-composer-agent-menu");
  const moreRow = page.locator('[data-codexhost-agent-more="row"]');
  const moreToggle = page.locator('[data-codexhost-agent-more="toggle"]');
  const moreSettings = page.locator('[data-codexhost-agent-more="settings"]');
  const morePanel = page.locator('[data-codexhost-agent-more="panel"]');

  await trigger.click();
  await expect(menu).toBeVisible();
  await expect(moreRow).toBeVisible();
  await expect(moreSettings).toBeVisible();
  await expect(morePanel).toBeHidden();
  await expect(moreToggle).toHaveAttribute("aria-expanded", "false");

  await moreToggle.click();
  await expect(morePanel).toBeVisible();
  await expect(moreToggle).toHaveAttribute("aria-expanded", "true");
  const settingsButtons = menu.getByRole("button", { name: /^(Settings|设置)$/ });
  await expect(settingsButtons).toHaveCount(1);
  await expect(settingsButtons).toHaveAttribute("data-codexhost-agent-more", "settings");

  const grokAdd = menu.getByRole("button", { name: "Install Grok" });
  const selectedCheck = menu.locator('[data-codexhost-agent-trailing="check"]').first();
  const moreArrow = page.locator('[data-codexhost-agent-more="arrow"]');
  const [rowBox, settingsBox, panelBox, piBox, addBox, checkBox, arrowBox] = await Promise.all([
    moreRow.boundingBox(),
    moreSettings.boundingBox(),
    morePanel.boundingBox(),
    menu.locator('button[data-agent="pi"]').boundingBox(),
    grokAdd.boundingBox(),
    selectedCheck.boundingBox(),
    moreArrow.boundingBox(),
  ]);
  if (!rowBox || !settingsBox || !panelBox || !piBox || !addBox || !checkBox || !arrowBox) {
    throw new Error("More Agents geometry is unavailable");
  }

  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(rowBox.y + 1);
  expect(piBox.y + piBox.height).toBeLessThanOrEqual(rowBox.y + 1);
  expect(settingsBox.x).toBeCloseTo(addBox.x, 0);
  expect(settingsBox.width).toBeCloseTo(addBox.width, 0);
  expect(checkBox.x).toBeCloseTo(addBox.x, 0);
  expect(checkBox.width).toBeCloseTo(addBox.width, 0);
  expect(arrowBox.width).toBeCloseTo(settingsBox.width, 0);
  expect(arrowBox.height).toBeCloseTo(settingsBox.height, 0);
  expect(arrowBox.y + arrowBox.height / 2).toBeCloseTo(settingsBox.y + settingsBox.height / 2, 0);
});
