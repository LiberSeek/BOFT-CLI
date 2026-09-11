import type { ExternalRendererAgent } from "../agent-selection-state.js";

export type HarnessInstallPlatform = "posix" | "windows";

export interface HarnessInstallGuide {
  readonly url: string;
  readonly binary: string;
  readonly command: string;
}

interface HarnessInstallSpec {
  readonly url: string;
  readonly binary: string;
  readonly posix: string;
  readonly windows: string;
}

const HARNESS_INSTALL_SPECS: Readonly<Record<ExternalRendererAgent, HarnessInstallSpec>> =
  Object.freeze({
    pi: {
      url: "https://pi.dev/",
      binary: "pi",
      posix: "curl -fsSL https://pi.dev/install.sh | sh",
      windows: "npm install -g --ignore-scripts @earendil-works/pi-coding-agent",
    },
    "claude-code": {
      url: "https://code.claude.com/docs/en/quickstart",
      binary: "claude",
      posix: "curl -fsSL https://claude.ai/install.sh | bash",
      windows: "irm https://claude.ai/install.ps1 | iex",
    },
    "deepseek-harness": {
      url: "https://deepseek-harness.github.io/deepseek-harness/",
      binary: "dsh",
      posix: "npm install -g @deepseek-ai/dsh",
      windows: "npm install -g @deepseek-ai/dsh",
    },
    opencode: {
      url: "https://opencode.ai/docs/",
      binary: "opencode",
      posix: "curl -fsSL https://opencode.ai/install | bash",
      windows: "npm install -g opencode-ai",
    },
    grok: {
      url: "https://grok.com/",
      binary: "grok",
      posix: "curl -fsSL https://x.ai/cli/install.sh | bash",
      windows: "irm https://x.ai/cli/install.ps1 | iex",
    },
    omp: {
      url: "https://github.com/can1357/oh-my-pi",
      binary: "omp",
      posix: "curl -fsSL https://omp.sh/install | sh",
      windows: "irm https://omp.sh/install.ps1 | iex",
    },
    antigravity: {
      url: "https://antigravity.google/product/antigravity-cli",
      binary: "agy",
      posix: "curl -fsSL https://antigravity.google/cli/install.sh | bash",
      windows: "irm https://antigravity.google/cli/install.ps1 | iex",
    },
    hermes: {
      url: "https://hermes-agent.nousresearch.com/docs/getting-started/installation",
      binary: "hermes",
      posix: "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash",
      windows: "iex (irm https://hermes-agent.nousresearch.com/install.ps1)",
    },
    muse: {
      url: "https://developer.meta.com/ai/products/muse-code/",
      binary: "muse",
      posix: "curl -fsSL https://dev.meta.ai/install.sh | bash",
      windows: "curl -fsSL https://dev.meta.ai/install.sh | bash",
    },
    "kiro-cli": {
      url: "https://kiro.dev/docs/cli/",
      binary: "kiro-cli",
      posix: "curl -fsSL https://cli.kiro.dev/install | bash",
      windows: "irm 'https://cli.kiro.dev/install.ps1' | iex",
    },
    codebuddy: {
      url: "https://www.codebuddy.ai/docs/zh/cli/overview",
      binary: "codebuddy",
      posix: "npm install -g @tencent-ai/codebuddy-code",
      windows: "npm install -g @tencent-ai/codebuddy-code",
    },
  });

export function harnessInstallPlatform(window: Window | null | undefined): HarnessInstallPlatform {
  const navigator = window?.navigator;
  if (!navigator) return "posix";
  const identity = `${navigator.platform ?? ""} ${navigator.userAgent}`;
  return /windows|win32|win64/iu.test(identity) ? "windows" : "posix";
}

export function harnessInstallGuide(
  agent: ExternalRendererAgent,
  platform: HarnessInstallPlatform,
): HarnessInstallGuide {
  const spec = HARNESS_INSTALL_SPECS[agent];
  return {
    url: spec.url,
    binary: spec.binary,
    command: platform === "windows" ? spec.windows : spec.posix,
  };
}

export function fillHarnessInstallPrompt(
  template: string,
  values: {
    readonly name: string;
    readonly binary: string;
    readonly command: string;
    readonly url: string;
  },
): string {
  return template.replaceAll(/\{(name|binary|command|url)\}/g, (_, key: string) => {
    if (key === "name") return values.name;
    if (key === "binary") return values.binary;
    if (key === "command") return values.command;
    return values.url;
  });
}
