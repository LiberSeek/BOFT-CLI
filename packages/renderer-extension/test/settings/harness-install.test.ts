import { describe, expect, it } from "vitest";

import { KNOWN_RENDERER_AGENTS, type ExternalRendererAgent } from "../../src/agent-selection-state.js";
import {
  fillHarnessInstallPrompt,
  harnessInstallGuide,
  harnessInstallPlatform,
} from "../../src/settings/harness-install.js";

const EXTERNAL_AGENTS = KNOWN_RENDERER_AGENTS.filter(
  (agent): agent is ExternalRendererAgent => agent !== "codex",
);

describe("Harness install guides", () => {
  it("covers every external Agent with a command, binary, and official URL", () => {
    for (const agent of EXTERNAL_AGENTS) {
      const guide = harnessInstallGuide(agent, "posix");
      expect(guide.binary.length).toBeGreaterThan(0);
      expect(guide.command.length).toBeGreaterThan(0);
      expect(guide.url.startsWith("https://")).toBe(true);
    }
  });

  it("uses platform-specific official commands", () => {
    expect(harnessInstallGuide("claude-code", "posix").command).toContain("install.sh");
    expect(harnessInstallGuide("claude-code", "windows").command).toContain("install.ps1");
    expect(harnessInstallGuide("deepseek-harness", "posix").command).toBe(
      "npm install -g @deepseek-ai/dsh",
    );
  });

  it("detects Windows from the renderer navigator", () => {
    expect(
      harnessInstallPlatform({
        navigator: { platform: "Win32", userAgent: "Windows" },
      } as Window),
    ).toBe("windows");
    expect(
      harnessInstallPlatform({
        navigator: { platform: "MacIntel", userAgent: "Macintosh" },
      } as Window),
    ).toBe("posix");
  });

  it("fills the install prompt without leftover placeholders", () => {
    const prompt = fillHarnessInstallPrompt(
      "Install {name} ({binary})\n{command}\n{url}",
      {
        name: "DeepSeek Harness",
        binary: "dsh",
        command: "npm install -g @deepseek-ai/dsh",
        url: "https://deepseek-harness.github.io/deepseek-harness/",
      },
    );
    expect(prompt).toBe(
      "Install DeepSeek Harness (dsh)\nnpm install -g @deepseek-ai/dsh\nhttps://deepseek-harness.github.io/deepseek-harness/",
    );
    expect(prompt).not.toMatch(/\{name|binary|command|url\}/);
  });
});
