import type { DefaultRendererSettingsPageId } from "./pages.js";

export const RENDERER_SETTINGS_LOCALES = ["en", "zh-CN"] as const;
export type RendererSettingsLocale = (typeof RENDERER_SETTINGS_LOCALES)[number];

export const RENDERER_SETTINGS_LANGUAGE_SELECTIONS = ["automatic", "en", "zh-CN", "other"] as const;
export type RendererSettingsLanguageSelection =
  (typeof RENDERER_SETTINGS_LANGUAGE_SELECTIONS)[number];
export type RendererSettingsWritableLanguageSelection = Exclude<
  RendererSettingsLanguageSelection,
  "other"
>;

export interface RendererSettingsLanguageControl {
  readonly available: boolean;
  readonly selection: RendererSettingsLanguageSelection;
  setSelection(selection: RendererSettingsWritableLanguageSelection): Promise<void>;
}

export interface RendererSettingsMessages {
  readonly locale: RendererSettingsLocale;
  readonly title: string;
  readonly close: string;
  readonly sectionsLabel: string;
  readonly generalSection: string;
  readonly otherSection: string;
  readonly pageUnavailable: string;
  readonly inDevelopment: string;
  readonly notAvailable: string;
  readonly runtimeCapabilityNotInstalled: string;
  readonly sessionImportHarness: string;
  readonly sessionImportDescription: string;
  readonly sessionImportAvailabilityNote: string;
  readonly sessionImportRefresh: string;
  readonly sessionImportRefreshing: string;
  readonly sessionImportUnavailable: string;
  readonly sessionImportEmpty: string;
  readonly sessionImportLoadFailed: string;
  readonly sessionImportFailed: string;
  readonly sessionImportUntitled: string;
  readonly sessionImportUpdatedAt: string;
  readonly sessionImportSessionId: string;
  readonly sessionImportRunning: string;
  readonly sessionImportRunningHint: string;
  readonly sessionImportAction: string;
  readonly sessionImportImporting: string;
  readonly sessionImportImported: string;
  readonly sessionImportOpenFailed: string;
  readonly sessionImportCopyProjectPath: string;
  readonly sessionImportPathCopied: string;
  readonly sessionImportPathCopyFailed: string;
  readonly sessionImportRetryOpen: string;
  readonly sessionImportRetrying: string;
  readonly connectionsDescription: string;
  readonly pluginsDescription: string;
  readonly pluginsRefresh: string;
  readonly pluginsRefreshing: string;
  readonly connectionAdapter: string;
  readonly connectionHosts: string;
  readonly connectionLocalHost: string;
  readonly connectionRemoteHost: string;
  readonly connectionActiveHost: string;
  readonly connectionReason: string;
  readonly connectionRefresh: string;
  readonly connectionRefreshing: string;
  readonly connectionViewError: string;
  readonly connectionCopyDetails: string;
  readonly connectionCopied: string;
  readonly connectionCopyFailed: string;
  readonly connectionErrorCode: string;
  readonly connectionErrorMessage: string;
  readonly connectionRetryable: string;
  readonly connectionFailureStage: string;
  readonly connectionDuration: string;
  readonly connectionDiagnostic: string;
  readonly connectionNoRuntime: string;
  readonly connectionStatusReady: string;
  readonly connectionStatusChecking: string;
  readonly connectionStatusNotInstalled: string;
  readonly connectionStatusUnavailable: string;
  readonly connectionStatusError: string;
  readonly connectionStatusInstalling: string;
  readonly connectionStatusUnsupported: string;
  readonly connectionComponent: string;
  readonly connectionStatus: string;
  readonly connectionAction: string;
  readonly connectionHostsScrollLeft: string;
  readonly connectionHostsScrollRight: string;
  readonly connectionOpenInstallation: string;
  readonly connectionOpenHarnessWeb: string;
  readonly connectionInstall: string;
  readonly connectionInstallDescription: string;
  readonly connectionErrorTitle: string;
  readonly connectionErrorLog: string;
  readonly connectionOpenIssue: string;
  readonly connectionIssueDescription: string;
  readonly connectionReadyDescription: string;
  readonly connectionUnavailableDescription: string;
  readonly connectionGroupMoreLabel: string;
  readonly connectionGroupMoreHintTitle: string;
  readonly connectionGroupMoreHintBody: string;
  readonly connectionGroupMoveToMore: string;
  readonly connectionGroupMoveToMain: string;
  readonly connectionGroupDragHandle: string;
  readonly connectionGroupReset: string;
  readonly pickerMoreAgentsLabel: string;
  readonly pickerManageLink: string;
  readonly pickerHideUnusedAgentsCta: string;
  readonly enabled: string;
  readonly disabled: string;
  readonly openSettings: string;
  readonly settingsButtonTitle: string;
  readonly settingsUnavailableTitle: string;
  readonly updateCurrentVersion: string;
  readonly updateInstallation: string;
  readonly updateInstallationNpm: string;
  readonly updateInstallationWindowsInstaller: string;
  readonly updateInstallationMacOsDmg: string;
  readonly updateInstallationUnknown: string;
  readonly updateLatestVersion: string;
  readonly updateUpToDate: string;
  readonly updateAvailable: string;
  readonly updateWindowsManualRequired: string;
  readonly updateAndRestart: string;
  readonly updateChecking: string;
  readonly updateDownloading: string;
  readonly updatePreparing: string;
  readonly updateWaitingForExit: string;
  readonly updateInstalling: string;
  readonly updateInstallingNpm: string;
  readonly updateRequestTimeout: string;
  readonly updateRestarting: string;
  readonly updateSucceeded: string;
  readonly updateFailed: string;
  readonly updateRetry: string;
  readonly updateManualNpmDescription: string;
  readonly updateWindowsNpmDescription: string;
  readonly updateWindowsInstallerDescription: string;
  readonly updateManualTitle: string;
  readonly updateManualFallbackDescription: string;
  readonly updateCopyCommand: string;
  readonly updateCommandCopied: string;
  readonly updateCopyFailed: string;
  readonly updateDownloadFromReleases: string;
  readonly updateDownloadWindowsInstaller: string;
  readonly aboutTagline: string;
  readonly aboutLead: string;
  readonly aboutExtensionIntro: string;
  readonly aboutAgents: readonly Readonly<{ name: string; description: string }>[];
  readonly aboutClosingParagraphs: readonly string[];
  readonly aboutOpenSourceAfter: string;
  readonly aboutStarCallout: string;
  readonly aboutBrand: string;
  readonly aboutBrandTagline: string;
  readonly pageLabels: Readonly<Record<DefaultRendererSettingsPageId, string>>;
}

const ENGLISH_MESSAGES: RendererSettingsMessages = Object.freeze({
  locale: "en",
  title: "Settings",
  close: "Close settings",
  sectionsLabel: "Settings sections",
  generalSection: "General",
  otherSection: "Other",
  pageUnavailable: "Page unavailable",
  inDevelopment: "In development",
  notAvailable: "Not available",
  runtimeCapabilityNotInstalled: "This runtime capability is not installed yet.",
  sessionImportHarness: "Harness",
  sessionImportDescription:
    "Sessions keep their original project path. If a folder is not in the Codex sidebar, add it as a project first. Original history remains managed by the Harness.",
  sessionImportAvailabilityNote:
    "Currently, only DeepSeek Harness Modern sessions can be imported. Support for other Harnesses is coming later.",
  sessionImportRefresh: "Refresh",
  sessionImportRefreshing: "Loading local sessions...",
  sessionImportUnavailable:
    "Session import requires a local, codexhost-managed DeepSeek Harness 0.1.2-rc.1 Modern runtime.",
  sessionImportEmpty: "No local DeepSeek Harness sessions are available to import.",
  sessionImportLoadFailed: "Local sessions could not be loaded.",
  sessionImportFailed: "The session could not be imported.",
  sessionImportUntitled: "Untitled session",
  sessionImportUpdatedAt: "Updated",
  sessionImportSessionId: "Session ID",
  sessionImportRunning: "Running",
  sessionImportRunningHint: "Stop this session in DSH, then refresh.",
  sessionImportAction: "Import and open",
  sessionImportImporting: "Importing...",
  sessionImportImported: "Session imported",
  sessionImportOpenFailed:
    "The Codex sidebar has not shown it yet. Make sure the folder below is added as a project, then try opening it again.",
  sessionImportCopyProjectPath: "Copy project path",
  sessionImportPathCopied: "Copied",
  sessionImportPathCopyFailed: "Copy failed",
  sessionImportRetryOpen: "Try opening again",
  sessionImportRetrying: "Opening...",
  connectionsDescription: "Add and configure Agent Harnesses supported by the system.",
  pluginsDescription: "Extend and manage Codex plugins.",
  pluginsRefresh: "Scan environment",
  pluginsRefreshing: "Scanning...",
  connectionAdapter: "Renderer adapter",
  connectionHosts: "Hosts",
  connectionLocalHost: "Local",
  connectionRemoteHost: "Remote Host",
  connectionActiveHost: "Current",
  connectionReason: "Reason",
  connectionRefresh: "Scan environment",
  connectionRefreshing: "Scanning...",
  connectionViewError: "View error",
  connectionCopyDetails: "Copy diagnostics",
  connectionCopied: "Copied",
  connectionCopyFailed: "Copy failed",
  connectionErrorCode: "Error code",
  connectionErrorMessage: "Error message",
  connectionRetryable: "Retryable",
  connectionFailureStage: "Failure stage",
  connectionDuration: "Duration",
  connectionDiagnostic: "Diagnostic",
  connectionNoRuntime: "The renderer request bridge is not available yet.",
  connectionStatusReady: "Ready",
  connectionStatusChecking: "Checking",
  connectionStatusNotInstalled: "Not installed",
  connectionStatusUnavailable: "Unavailable",
  connectionStatusError: "Error",
  connectionStatusInstalling: "Installing",
  connectionStatusUnsupported: "Unsupported",
  connectionComponent: "Component",
  connectionStatus: "Status",
  connectionAction: "Actions",
  connectionHostsScrollLeft: "Show previous Hosts",
  connectionHostsScrollRight: "Show more Hosts",
  connectionOpenInstallation: "Open official installation page",
  connectionOpenHarnessWeb: "Open DeepSeek Harness Web",
  connectionInstall: "Install",
  connectionInstallDescription:
    "This Harness was not detected. Follow its official installation guide, then return here and run the check again.",
  connectionErrorTitle: "Connection check failed",
  connectionErrorLog: "Error log",
  connectionOpenIssue: "Open GitHub Issue",
  connectionIssueDescription:
    "Copy the error log and include the Host and reproduction steps when reporting the issue.",
  connectionReadyDescription: "This component is available on the selected Host.",
  connectionUnavailableDescription:
    "This component is not currently available on the selected Host.",
  connectionGroupMoreLabel: "More",
  connectionGroupMoreHintTitle: "Drag Agents here to collapse the ones you rarely use",
  connectionGroupMoreHintBody: "They fold into the picker's “More Agents” group",
  connectionGroupMoveToMore: "Move to More",
  connectionGroupMoveToMain: "Move back to Main",
  connectionGroupDragHandle: "Drag to reorder",
  connectionGroupReset: "Reset order",
  pickerMoreAgentsLabel: "More agents",
  pickerManageLink: "Settings",
  pickerHideUnusedAgentsCta: "Customize agents",
  enabled: "Enabled",
  disabled: "Disabled",
  openSettings: "Open BOFT CLI settings",
  settingsButtonTitle: "BOFT CLI settings",
  settingsUnavailableTitle: "BOFT CLI settings unavailable",
  updateCurrentVersion: "Current version",
  updateInstallation: "Installation method",
  updateInstallationNpm: "npm",
  updateInstallationWindowsInstaller: "Windows installer",
  updateInstallationMacOsDmg: "macOS DMG",
  updateInstallationUnknown: "Unknown",
  updateLatestVersion: "Latest version",
  updateUpToDate: "You are up to date.",
  updateAvailable: "A new version is available.",
  updateWindowsManualRequired:
    "Automatic updates are unavailable on Windows. Update manually below.",
  updateAndRestart: "Update",
  updateChecking: "Checking for updates...",
  updateDownloading: "Downloading update...",
  updatePreparing: "Preparing update...",
  updateWaitingForExit: "Waiting for the application to close...",
  updateInstalling: "Installing update...",
  updateInstallingNpm: "Installing update through npm...",
  updateRequestTimeout: "The update service did not respond. Try again.",
  updateRestarting: "Restarting to finish the update...",
  updateSucceeded: "Update installed successfully.",
  updateFailed: "Update failed.",
  updateRetry: "Retry",
  updateManualNpmDescription: "To update manually, quit BOFT CLI and run this command:",
  updateWindowsNpmDescription:
    "Automatic updates are unavailable on Windows. Quit BOFT CLI and run this command in a terminal:",
  updateWindowsInstallerDescription:
    "Automatic updates are unavailable on Windows. Download and run the installer for this system.",
  updateManualTitle: "Manual update",
  updateManualFallbackDescription:
    "The automatic update did not complete. Run this command in a terminal instead, then quit Codex and relaunch it with boft.",
  updateCopyCommand: "Copy",
  updateCommandCopied: "Copied",
  updateCopyFailed: "Copy failed",
  updateDownloadFromReleases: "Download from GitHub Releases",
  updateDownloadWindowsInstaller: "Download Windows installer",
  aboutTagline: "An Extension for running third-party Agent Harnesses in Codex.",
  aboutLead: "Codex provides an excellent desktop development experience.",
  aboutExtensionIntro:
    "BOFT CLI builds on that, bringing in more compelling Agents through an Extension.",
  aboutAgents: Object.freeze([
    Object.freeze({
      name: "Pi Agent",
      description: "A lightweight coding Agent, integrated through its official RPC.",
    }),
    Object.freeze({
      name: "DeepSeek Harness",
      description: "DeepSeek's native Harness, with full streaming and tool fidelity.",
    }),
  ]),
  aboutClosingParagraphs: Object.freeze([
    "Experience the strengths of third-party Agent Harnesses conveniently inside Codex.",
    "Keep the native Codex experience, and organize them to get outstanding work done.",
  ]),
  aboutOpenSourceAfter: "is an open-source project.",
  aboutStarCallout: "⭐ If this project helps you, please give us a Star! ⭐",
  aboutBrand: "LIBERSEEK",
  aboutBrandTagline: "Explore toward the future",
  pageLabels: Object.freeze({
    connections: "Agents",
    plugins: "Plugin",
    "session-import": "Session Import",
    updates: "Updates",
    about: "About",
  }),
});

const CHINESE_MESSAGES: RendererSettingsMessages = Object.freeze({
  locale: "zh-CN",
  title: "设置",
  close: "关闭设置",
  sectionsLabel: "设置分类",
  generalSection: "通用",
  otherSection: "其他",
  pageUnavailable: "页面不可用",
  inDevelopment: "开发中",
  notAvailable: "暂不可用",
  runtimeCapabilityNotInstalled: "运行时尚未安装该项能力，因此暂不可用。",
  sessionImportHarness: "Harness",
  sessionImportDescription:
    "会话将保留原始项目路径；若该文件夹尚未出现在 Codex 侧栏，请先将其添加为项目。原始历史仍由 Harness 管理。",
  sessionImportAvailabilityNote:
    "当前仅支持导入 DeepSeek Harness Modern 会话；其他 Harness 的会话导入能力敬请期待。",
  sessionImportRefresh: "刷新",
  sessionImportRefreshing: "正在读取本地会话……",
  sessionImportUnavailable:
    "会话导入仅支持本地、由 codexhost 管理的 DeepSeek Harness 0.1.2-rc.1 Modern 运行时。",
  sessionImportEmpty: "没有可导入的本地 DeepSeek Harness 会话。",
  sessionImportLoadFailed: "无法读取本地会话。",
  sessionImportFailed: "无法导入该会话。",
  sessionImportUntitled: "未命名会话",
  sessionImportUpdatedAt: "更新时间",
  sessionImportSessionId: "会话 ID",
  sessionImportRunning: "运行中",
  sessionImportRunningHint: "请先在 DSH 中停止该会话，然后刷新。",
  sessionImportAction: "导入并打开",
  sessionImportImporting: "正在导入……",
  sessionImportImported: "会话已导入",
  sessionImportOpenFailed: "Codex 侧栏尚未显示该会话。请确认以下文件夹已添加为项目，然后重试打开。",
  sessionImportCopyProjectPath: "复制项目路径",
  sessionImportPathCopied: "已复制",
  sessionImportPathCopyFailed: "复制失败",
  sessionImportRetryOpen: "重试打开",
  sessionImportRetrying: "正在打开……",
  connectionsDescription: "添加和配置系统中支持的 Agent Harness。",
  pluginsDescription: "扩展和管理 Codex 的插件。",
  pluginsRefresh: "扫描环境",
  pluginsRefreshing: "正在扫描...",
  connectionAdapter: "Renderer 适配器",
  connectionHosts: "Host 列表",
  connectionLocalHost: "本地",
  connectionRemoteHost: "远程 Host",
  connectionActiveHost: "当前",
  connectionReason: "原因",
  connectionRefresh: "扫描环境",
  connectionRefreshing: "正在扫描...",
  connectionViewError: "查看错误",
  connectionCopyDetails: "复制诊断信息",
  connectionCopied: "已复制",
  connectionCopyFailed: "复制失败",
  connectionErrorCode: "错误码",
  connectionErrorMessage: "错误信息",
  connectionRetryable: "可重试",
  connectionFailureStage: "失败阶段",
  connectionDuration: "检查耗时",
  connectionDiagnostic: "诊断信息",
  connectionNoRuntime: "Renderer 请求桥尚未可用。",
  connectionStatusReady: "正常",
  connectionStatusChecking: "检查中",
  connectionStatusNotInstalled: "未安装",
  connectionStatusUnavailable: "不可用",
  connectionStatusError: "错误",
  connectionStatusInstalling: "安装中",
  connectionStatusUnsupported: "不支持",
  connectionComponent: "组件",
  connectionStatus: "状态",
  connectionAction: "操作",
  connectionHostsScrollLeft: "查看前面的 Host",
  connectionHostsScrollRight: "查看更多 Host",
  connectionOpenInstallation: "前往官方安装页面",
  connectionOpenHarnessWeb: "打开 DeepSeek Harness Web",
  connectionInstall: "安装",
  connectionInstallDescription:
    "尚未检测到该 Harness。请按照官方安装指南完成安装，然后返回此页面重新检查。",
  connectionErrorTitle: "连接检查失败",
  connectionErrorLog: "错误日志",
  connectionOpenIssue: "提交 GitHub Issue",
  connectionIssueDescription: "提交前请复制错误日志，并在 Issue 中说明当前 Host 与复现步骤。",
  connectionReadyDescription: "该组件在当前 Host 上可用。",
  connectionUnavailableDescription: "该组件当前无法在所选 Host 上使用。",
  connectionGroupMoreLabel: "更多",
  connectionGroupMoreHintTitle: "拖到这里可以收起不常用的 Agent",
  connectionGroupMoreHintBody: "它们会折叠进选择器的「更多」分组",
  connectionGroupMoveToMore: "移到更多",
  connectionGroupMoveToMain: "移回常用",
  connectionGroupDragHandle: "拖动排序",
  connectionGroupReset: "恢复默认排列",
  pickerMoreAgentsLabel: "更多 Agent",
  pickerManageLink: "设置",
  pickerHideUnusedAgentsCta: "设置 Agent 显示",
  enabled: "已开启",
  disabled: "已关闭",
  openSettings: "打开 BOFT CLI 设置",
  settingsButtonTitle: "BOFT CLI 设置",
  settingsUnavailableTitle: "BOFT CLI 设置不可用",
  updateCurrentVersion: "当前版本",
  updateInstallation: "安装方式",
  updateInstallationNpm: "npm",
  updateInstallationWindowsInstaller: "Windows 安装程序",
  updateInstallationMacOsDmg: "macOS DMG",
  updateInstallationUnknown: "未知",
  updateLatestVersion: "最新版本",
  updateUpToDate: "当前已是最新版本。",
  updateAvailable: "有新版本可用。",
  updateWindowsManualRequired: "Windows 暂不支持自动更新，请在下方手动更新。",
  updateAndRestart: "更新",
  updateChecking: "正在检查更新...",
  updateDownloading: "正在下载更新...",
  updatePreparing: "正在准备更新...",
  updateWaitingForExit: "正在等待应用退出...",
  updateInstalling: "正在安装更新...",
  updateInstallingNpm: "正在通过 npm 安装...",
  updateRequestTimeout: "更新服务未响应，请重试。",
  updateRestarting: "正在重启以完成更新...",
  updateSucceeded: "更新安装成功。",
  updateFailed: "更新失败。",
  updateRetry: "重试",
  updateManualNpmDescription:
    "如需手动更新，请在终端运行以下命令。更新完成后，请退出 Codex 并通过 boft 重新启动。",
  updateWindowsNpmDescription:
    "Windows 暂不支持自动更新。请退出 BOFT CLI，在终端运行以下命令完成更新。",
  updateWindowsInstallerDescription:
    "Windows 暂不支持自动更新。请下载并运行适用于当前系统的安装包。",
  updateManualTitle: "手动更新",
  updateManualFallbackDescription:
    "自动更新未能完成，请改用下列命令在终端手动更新。完成后请退出 Codex 并通过 boft 重新启动。",
  updateCopyCommand: "复制",
  updateCommandCopied: "已复制",
  updateCopyFailed: "复制失败",
  updateDownloadFromReleases: "前往 GitHub Releases 下载",
  updateDownloadWindowsInstaller: "下载 Windows 安装包",
  aboutTagline: "在 Codex 中运行第三方 Agent Harness 的 Extension。",
  aboutLead: "Codex 提供了优秀的桌面开发交互体验。",
  aboutExtensionIntro: "BOFT CLI 在基础上，通过 Extension 加入了更多引人入胜的 Agent。",
  aboutAgents: Object.freeze([
    Object.freeze({
      name: "Pi Agent",
      description: "轻量编程 Agent，通过官方 RPC 接入。",
    }),
    Object.freeze({
      name: "DeepSeek Harness",
      description: "深度求索原生 Harness，保留完整流式与工具能力。",
    }),
  ]),
  aboutClosingParagraphs: Object.freeze([
    "让你便捷地在 Codex 中尽情体验第三方 Agent Harness 带来的优质能力。",
    "同时保留 Codex 的原生体验，并组织它们出色地完成任务。",
  ]),
  aboutOpenSourceAfter: "是开源项目。",
  aboutStarCallout: "⭐ 如果这个项目对你有帮助，请给我们一个 Star！⭐",
  aboutBrand: "LIBERSEEK",
  aboutBrandTagline: "向未来探索",
  pageLabels: Object.freeze({
    connections: "Agents",
    plugins: "Plugin",
    "session-import": "会话导入",
    updates: "更新",
    about: "关于",
  }),
});

export const DEFAULT_RENDERER_SETTINGS_MESSAGES = ENGLISH_MESSAGES;

function languageFromTag(tag: string): string | undefined {
  try {
    return new Intl.Locale(tag).language.toLowerCase();
  } catch {
    return undefined;
  }
}

export function resolveRendererSettingsLocale(
  languageTags: readonly string[],
): RendererSettingsLocale {
  for (const tag of languageTags) {
    const language = languageFromTag(tag);
    if (language === "zh") return "zh-CN";
    if (language === "en") return "en";
  }
  return "en";
}

export function rendererSettingsMessages(locale: RendererSettingsLocale): RendererSettingsMessages {
  return locale === "zh-CN" ? CHINESE_MESSAGES : ENGLISH_MESSAGES;
}

export function rendererSettingsLanguageSelection(
  localeOverride: string | null | undefined,
): RendererSettingsLanguageSelection {
  if (localeOverride == null) return "automatic";
  const language = languageFromTag(localeOverride);
  if (language === "zh") return "zh-CN";
  if (language === "en") return "en";
  return "other";
}

export function codexLocaleOverrideForSettingsSelection(
  selection: RendererSettingsWritableLanguageSelection,
): "en-US" | "zh-CN" | null {
  if (selection === "automatic") return null;
  return selection === "en" ? "en-US" : "zh-CN";
}
