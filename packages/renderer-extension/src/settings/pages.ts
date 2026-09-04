import type {
  UpdateCheckResult,
  UpdateInstallation,
  UpdateStartResult,
  UpdateStatus,
  UpdateStatusResult,
} from "@codexhost/shared-contracts";

import {
  createRendererSettingsPageRegistry,
  type RendererSettingsPageDefinition,
  type RendererSettingsPageMountContext,
  type RendererSettingsPageRegistry,
} from "./core.js";
import {
  createRendererSettingsGitHubIcon,
  createRendererSettingsIcon,
  type RendererSettingsIconName,
} from "./icons.js";
import {
  DEFAULT_RENDERER_SETTINGS_MESSAGES,
  type RendererSettingsMessages,
} from "./localization.js";
import {
  createConnectionsSettingsPage,
  type RendererConnectionDiagnostics,
} from "./connections-page.js";
import {
  createDeepSeekSessionImportSettingsPage,
  type RendererDeepSeekSessionImportClient,
  type RendererImportedThreadOpener,
} from "./deepseek-session-import-page.js";
import { createPluginsSettingsPage } from "./plugins-page.js";
import { createReleaseNotesElement } from "./release-notes.js";

export type {
  RendererConnectionAgentSnapshot,
  RendererConnectionDiagnostics,
  RendererConnectionHostSnapshot,
  RendererConnectionSnapshot,
} from "./connections-page.js";
import {
  RendererUpdateRequestTimeoutError,
  runBoundedRendererUpdateRequest,
} from "./update-request.js";
import liberseekLogoVideoUrl from "../assets/logo-animated.mp4";

export const CODEXHOST_GITHUB_REPOSITORY_URL = "https://github.com/LiberSeek/BOFT-CLI";
export const CODEXHOST_RELEASES_LATEST_URL = `${CODEXHOST_GITHUB_REPOSITORY_URL}/releases/latest`;
export const CODEXHOST_NPM_MANUAL_UPDATE_COMMAND = "npm install --global @liberseek/boft-cli@latest";
export const LIBERSEEK_WEBSITE_URL = "https://supply.boft.ai";
// Codex Desktop CSP allows media-src data: but not arbitrary https hosts.
export const LIBERSEEK_LOGO_VIDEO_URL = liberseekLogoVideoUrl;

interface RendererUserAgentData {
  readonly platform?: string;
  readonly architecture?: string;
  readonly bitness?: string;
}

function rendererUserAgentData(navigator: Navigator): RendererUserAgentData | undefined {
  return (navigator as Navigator & { userAgentData?: RendererUserAgentData }).userAgentData;
}

function isWindowsRenderer(window: Window | null | undefined): boolean {
  const navigator = window?.navigator;
  if (!navigator) return false;
  const identity = `${rendererUserAgentData(navigator)?.platform ?? ""} ${navigator.platform ?? ""} ${navigator.userAgent}`;
  return /windows|win32|win64/iu.test(identity);
}

function windowsInstallerDownloadUrl(window: Window | null | undefined, version: string): string {
  const navigator = window?.navigator;
  const hints = navigator ? rendererUserAgentData(navigator) : undefined;
  const identity = `${hints?.architecture ?? ""} ${hints?.platform ?? ""} ${navigator?.platform ?? ""} ${navigator?.userAgent ?? ""}`;
  const architecture = /arm64|aarch64|\barm\b/iu.test(identity) ? "arm64" : "x64";
  return `https://github.com/LiberSeek/BOFT-CLI/releases/download/v${version}/boft-cli-${version}-windows-${architecture}.exe`;
}

export const DEFAULT_RENDERER_SETTINGS_PAGE_IDS = [
  "connections",
  "plugins",
  "session-import",
  "updates",
  "about",
] as const;

export type DefaultRendererSettingsPageId = (typeof DEFAULT_RENDERER_SETTINGS_PAGE_IDS)[number];

export interface RendererUpdateClient {
  checkUpdate(): Promise<UpdateCheckResult>;
  startUpdate(): Promise<UpdateStartResult>;
  readUpdateStatus(): Promise<UpdateStatusResult>;
}

function panelIconName(view: string): RendererSettingsIconName {
  if (view === "failed" || view === "error") return "alert";
  if (view === "unavailable") return "unavailable";
  if (view === "current") return "check";
  return "updates";
}

function createPanelHead(document: Document, view: string, title: string): HTMLElement {
  const head = document.createElement("div");
  head.className = "settings-update-panel__head";
  const label = document.createElement("strong");
  label.className = "settings-update-panel__title";
  label.textContent = title;
  head.append(createRendererSettingsIcon(panelIconName(view), 16), label);
  return head;
}

function createPanelActions(document: Document, ...buttons: readonly HTMLElement[]): HTMLElement {
  const actions = document.createElement("div");
  actions.className = "settings-update-actions";
  actions.append(...buttons);
  return actions;
}

function createPanelStatusRow(
  document: Document,
  head: HTMLElement,
  ...buttons: readonly HTMLElement[]
): HTMLElement {
  const row = document.createElement("div");
  row.className = "settings-update-panel__status-row";
  row.append(createPanelActions(document, ...buttons), head);
  return row;
}

function installationLabel(
  installation: UpdateInstallation | null,
  messages: RendererSettingsMessages,
): string {
  if (installation === "npm") return messages.updateInstallationNpm;
  if (installation === "windows-installer") {
    return messages.updateInstallationWindowsInstaller;
  }
  if (installation === "macos-dmg") return messages.updateInstallationMacOsDmg;
  return messages.updateInstallationUnknown;
}

function isPendingStatus(status: UpdateStatus | null): boolean {
  return status !== null && status.phase !== "succeeded" && status.phase !== "failed";
}

function statusMessage(
  status: UpdateStatus | null,
  messages: RendererSettingsMessages,
): string | null {
  if (!status) return null;
  if (status.phase === "succeeded") return messages.updateSucceeded;
  if (status.phase === "failed") return status.error ?? messages.updateFailed;
  if (status.phase === "waiting-for-exit") return messages.updateWaitingForExit;
  if (status.phase === "installing") {
    return status.installation === "npm" ? messages.updateInstallingNpm : messages.updateInstalling;
  }
  if (status.phase === "restarting") return messages.updateRestarting;
  if (status.phase === "downloading") return messages.updateDownloading;
  return messages.updatePreparing;
}

function formatUpdateBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB"];
  let scaled = value;
  let unit = "B";
  for (const nextUnit of units) {
    scaled /= 1024;
    unit = nextUnit;
    if (scaled < 1024 || nextUnit === units.at(-1)) break;
  }
  return `${scaled.toFixed(scaled >= 10 ? 0 : 1)} ${unit}`;
}

function aboutPage(messages: RendererSettingsMessages): RendererSettingsPageDefinition {
  return Object.freeze({
    id: "about",
    label: messages.pageLabels.about,
    icon: "about",
    mount(context: RendererSettingsPageMountContext) {
      const document = context.content.ownerDocument;
      const page = document.createElement("div");
      page.className = "settings-about-page";

      const heading = document.createElement("div");
      heading.className = "settings-section-label";
      heading.textContent = messages.pageLabels.about;

      const introPanel = document.createElement("section");
      introPanel.className = "settings-about-panel";
      const product = document.createElement("strong");
      product.className = "settings-about-product";
      product.textContent = "BOFT CLI";
      const tagline = document.createElement("strong");
      tagline.className = "settings-about-tagline";
      tagline.textContent = messages.aboutTagline;
      const story = document.createElement("div");
      story.className = "settings-about-copy";
      const lead = document.createElement("p");
      lead.className = "settings-about-lead";
      lead.textContent = messages.aboutLead;
      const extensionIntro = document.createElement("p");
      extensionIntro.className = "settings-about-extension";
      extensionIntro.textContent = messages.aboutExtensionIntro;
      const agents = document.createElement("ul");
      agents.className = "settings-about-agents";
      for (const agent of messages.aboutAgents) {
        const item = document.createElement("li");
        item.className = "settings-about-agent";
        const name = document.createElement("strong");
        name.className = "settings-about-agent-name";
        name.textContent = agent.name;
        const description = document.createElement("span");
        description.className = "settings-about-agent-description";
        description.textContent = agent.description;
        item.append(name, description);
        agents.append(item);
      }
      const closing = document.createElement("div");
      closing.className = "settings-about-closing";
      for (const paragraphText of messages.aboutClosingParagraphs) {
        const paragraph = document.createElement("p");
        paragraph.textContent = paragraphText;
        closing.append(paragraph);
      }
      story.append(lead, extensionIntro, agents, closing);
      introPanel.append(product, tagline, story);

      const repositoryPanel = document.createElement("section");
      repositoryPanel.className = "settings-about-panel settings-about-repository";
      const openSource = document.createElement("p");
      openSource.className = "settings-about-open-source";
      const repository = document.createElement("a");
      repository.className = "settings-about-repository-link";
      repository.href = CODEXHOST_GITHUB_REPOSITORY_URL;
      repository.target = "_blank";
      repository.rel = "noopener noreferrer";
      const repositoryLabel = document.createElement("span");
      repositoryLabel.textContent = "BOFT CLI";
      repository.append(createRendererSettingsGitHubIcon(14), repositoryLabel);
      const openSourceAfter = document.createElement("span");
      openSourceAfter.textContent = messages.aboutOpenSourceAfter;
      openSource.append(repository, openSourceAfter);
      const starCallout = document.createElement("p");
      starCallout.className = "settings-about-star-callout";
      starCallout.textContent = messages.aboutStarCallout;
      repositoryPanel.append(openSource, starCallout);

      const brand = document.createElement("a");
      brand.className = "settings-about-brand";
      brand.href = LIBERSEEK_WEBSITE_URL;
      brand.target = "_blank";
      brand.rel = "noopener noreferrer";
      brand.setAttribute("aria-label", messages.aboutBrand);
      const brandVideo = document.createElement("video");
      brandVideo.className = "settings-about-brand-video";
      brandVideo.src = LIBERSEEK_LOGO_VIDEO_URL;
      brandVideo.autoplay = true;
      brandVideo.loop = true;
      brandVideo.muted = true;
      brandVideo.playsInline = true;
      brandVideo.preload = "metadata";
      brandVideo.setAttribute("aria-hidden", "true");
      const brandCopy = document.createElement("div");
      brandCopy.className = "settings-about-brand-copy";
      const brandName = document.createElement("span");
      brandName.className = "settings-about-brand-name";
      brandName.textContent = messages.aboutBrand;
      const brandTagline = document.createElement("span");
      brandTagline.className = "settings-about-brand-tagline";
      brandTagline.textContent = messages.aboutBrandTagline;
      brandCopy.append(brandName, brandTagline);
      brand.append(brandVideo, brandCopy);

      page.append(heading, introPanel, repositoryPanel, brand);
      context.content.append(page);
      return undefined;
    },
  });
}

function updatesPage(
  messages: RendererSettingsMessages,
  getClient: () => RendererUpdateClient | null,
): RendererSettingsPageDefinition {
  return Object.freeze({
    id: "updates",
    label: messages.pageLabels.updates,
    icon: "updates",
    mount(context: RendererSettingsPageMountContext) {
      const document = context.content.ownerDocument;
      const windows = isWindowsRenderer(document.defaultView);
      const heading = document.createElement("div");
      heading.className = "settings-section-label";
      heading.textContent = messages.pageLabels.updates;

      // Version summary: current, latest, and installation sit side by side so the
      // comparison is readable without scrolling.
      const metadata = document.createElement("div");
      metadata.className = "settings-update-metadata";
      const createMetadataItem = (label: string): HTMLElement => {
        const item = document.createElement("div");
        item.className = "settings-update-metadata__item";
        const name = document.createElement("span");
        name.textContent = label;
        const value = document.createElement("strong");
        value.textContent = "-";
        item.append(name, value);
        metadata.append(item);
        return value;
      };
      const currentVersionValue = createMetadataItem(messages.updateCurrentVersion);
      const latestVersionValue = createMetadataItem(messages.updateLatestVersion);
      const installationValue = createMetadataItem(messages.updateInstallation);

      const panel = document.createElement("section");
      panel.className = "settings-update-panel";
      panel.setAttribute("aria-live", "polite");

      // Manual update stays visible directly under the status panel: automatic
      // updates can fail for reasons local to the machine, and the fallback path
      // should never be more than a glance away.
      const controls = document.createElement("div");
      controls.className = "settings-update-controls";
      const manualTitle = document.createElement("div");
      manualTitle.className = "settings-update-manual-title";
      manualTitle.textContent = messages.updateManualTitle;
      const manualNpm = document.createElement("div");
      manualNpm.className = "settings-update-manual";
      manualNpm.hidden = true;
      const manualNpmDescription = document.createElement("p");
      manualNpmDescription.className = "settings-update-manual-description";
      manualNpmDescription.textContent = messages.updateManualNpmDescription;
      const manualNpmCommandRow = document.createElement("div");
      manualNpmCommandRow.className = "settings-update-command";
      const manualNpmCommand = document.createElement("code");
      manualNpmCommand.textContent = CODEXHOST_NPM_MANUAL_UPDATE_COMMAND;
      const copyCommand = document.createElement("button");
      copyCommand.type = "button";
      copyCommand.className = "settings-update-command__copy";
      const setCopyLabel = (label: string): void => {
        copyCommand.replaceChildren(createRendererSettingsIcon("copy", 14), label);
      };
      setCopyLabel(messages.updateCopyCommand);
      copyCommand.addEventListener("click", () => {
        const clipboard = document.defaultView?.navigator.clipboard;
        const restore = (label: string): void => {
          setCopyLabel(label);
          document.defaultView?.setTimeout(() => setCopyLabel(messages.updateCopyCommand), 2_000);
        };
        if (!clipboard) {
          restore(messages.updateCopyFailed);
          return;
        }
        void clipboard.writeText(CODEXHOST_NPM_MANUAL_UPDATE_COMMAND).then(
          () => restore(messages.updateCommandCopied),
          () => restore(messages.updateCopyFailed),
        );
      });
      manualNpmCommandRow.append(manualNpmCommand, copyCommand);
      manualNpm.append(manualNpmDescription, manualNpmCommandRow);
      const manualWindowsInstaller = document.createElement("div");
      manualWindowsInstaller.className = "settings-update-manual";
      manualWindowsInstaller.hidden = true;
      const manualWindowsInstallerDescription = document.createElement("p");
      manualWindowsInstallerDescription.className = "settings-update-manual-description";
      manualWindowsInstallerDescription.textContent = messages.updateWindowsInstallerDescription;
      const manualWindowsInstallerActions = document.createElement("div");
      manualWindowsInstallerActions.className = "settings-update-actions";
      const manualWindowsInstallerLink = document.createElement("a");
      manualWindowsInstallerLink.className = "settings-update-link";
      manualWindowsInstallerLink.href = CODEXHOST_RELEASES_LATEST_URL;
      manualWindowsInstallerLink.target = "_blank";
      manualWindowsInstallerLink.rel = "noopener noreferrer";
      manualWindowsInstallerLink.append(
        messages.updateDownloadWindowsInstaller,
        createRendererSettingsIcon("external-link", 14),
      );
      manualWindowsInstallerActions.append(manualWindowsInstallerLink);
      manualWindowsInstaller.append(
        manualWindowsInstallerDescription,
        manualWindowsInstallerActions,
      );
      const actions = document.createElement("div");
      actions.className = "settings-update-actions";
      const releaseLink = document.createElement("a");
      releaseLink.className = "settings-update-link";
      releaseLink.href = CODEXHOST_RELEASES_LATEST_URL;
      releaseLink.target = "_blank";
      releaseLink.rel = "noopener noreferrer";
      releaseLink.append(
        messages.updateDownloadFromReleases,
        createRendererSettingsIcon("external-link", 14),
      );
      actions.append(releaseLink);
      controls.append(manualTitle, manualNpm, manualWindowsInstaller, actions);

      // Release notes render below the fold, in the page scroller rather than a
      // nested one.
      const notes = document.createElement("div");
      notes.className = "settings-update-notes-section";

      context.content.append(heading, metadata, panel, controls, notes);

      // Presentation-only: emphasise the manual path once the automatic one has
      // visibly failed.
      const setManualFallback = (fallback: boolean): void => {
        manualNpmDescription.textContent = windows
          ? messages.updateWindowsNpmDescription
          : fallback
            ? messages.updateManualFallbackDescription
            : messages.updateManualNpmDescription;
        manualNpmDescription.className = fallback
          ? "settings-update-manual-description is-fallback"
          : "settings-update-manual-description";
      };
      let pollTimer: number | undefined;
      let pollAttempts = 0;
      let pending = false;

      const clearPoll = (): void => {
        if (pollTimer !== undefined) {
          document.defaultView?.clearTimeout(pollTimer);
          pollTimer = undefined;
        }
      };

      const renderUnavailable = (detail: string): void => {
        panel.dataset.updateState = "unavailable";
        panel.replaceChildren();
        const copy = document.createElement("p");
        copy.className = "settings-update-summary";
        copy.textContent = detail;
        panel.append(createPanelHead(document, "unavailable", messages.notAvailable), copy);
        notes.replaceChildren();
      };

      const renderRequestFailure = (error: unknown): void => {
        renderPendingStatus(
          null,
          error instanceof RendererUpdateRequestTimeoutError
            ? messages.updateRequestTimeout
            : error instanceof Error
              ? error.message
              : messages.updateFailed,
          "failed",
        );
      };

      const scheduleStatusPoll = (client: RendererUpdateClient, resetAttempts = false): void => {
        clearPoll();
        if (resetAttempts) pollAttempts = 0;
        if (pollAttempts >= 320) {
          renderPendingStatus(null, messages.updateRequestTimeout, "failed");
          return;
        }
        pollAttempts += 1;
        pollTimer = document.defaultView?.setTimeout(() => {
          void context.runLatest(
            (signal) => runBoundedRendererUpdateRequest(() => client.readUpdateStatus(), signal),
            {
              success(result) {
                const message = statusMessage(result.status, messages);
                if (isPendingStatus(result.status)) scheduleStatusPoll(client);
                if (message) renderPendingStatus(result.status, message);
              },
              failure(error) {
                renderRequestFailure(error);
              },
            },
          );
        }, 750);
      };

      const renderPendingStatus = (
        status: UpdateStatus | null,
        message: string,
        viewPhase: UpdateStatus["phase"] | "pending" = status?.phase ?? "pending",
      ): void => {
        panel.dataset.updateState = viewPhase;
        panel.replaceChildren();
        const head = createPanelHead(document, viewPhase, message);
        setManualFallback(viewPhase === "failed");
        if (viewPhase === "failed") {
          const retry = document.createElement("button");
          retry.type = "button";
          retry.className = "settings-command-button settings-command-button--secondary";
          retry.append(createRendererSettingsIcon("refresh", 16), messages.updateRetry);
          retry.addEventListener("click", () => void load());
          panel.append(createPanelStatusRow(document, head, retry));
        } else {
          panel.append(head);
        }
        if (
          status?.phase === "downloading" &&
          status.totalBytes !== undefined &&
          status.downloadedBytes !== undefined
        ) {
          const progress = document.createElement("progress");
          progress.className = "settings-update-progress";
          progress.max = status.totalBytes;
          progress.value = Math.min(status.downloadedBytes, status.totalBytes);
          progress.setAttribute("aria-label", messages.updateDownloading);
          const detail = document.createElement("span");
          detail.className = "settings-update-progress-detail";
          const percent = Math.min(
            100,
            Math.round((status.downloadedBytes / status.totalBytes) * 1000) / 10,
          );
          detail.textContent = `${percent}% · ${formatUpdateBytes(status.downloadedBytes)} / ${formatUpdateBytes(status.totalBytes)}`;
          panel.append(progress, detail);
        }
      };

      const start = (client: RendererUpdateClient): void => {
        if (pending) return;
        pending = true;
        renderPendingStatus(null, messages.updatePreparing);
        void context.runLatest(
          (signal) => runBoundedRendererUpdateRequest(() => client.startUpdate(), signal),
          {
            success(result) {
              pending = false;
              renderPendingStatus(
                result.status,
                statusMessage(result.status, messages) ?? messages.updatePreparing,
              );
              if (isPendingStatus(result.status)) scheduleStatusPoll(client, true);
            },
            failure(error) {
              pending = false;
              renderRequestFailure(error);
            },
          },
        );
      };

      const renderCheck = (result: UpdateCheckResult, client: RendererUpdateClient): void => {
        currentVersionValue.textContent = `v${result.currentVersion}`;
        latestVersionValue.textContent = result.latestVersion ? `v${result.latestVersion}` : "-";
        latestVersionValue.className = result.updateAvailable
          ? "settings-update-metadata__value--newer"
          : "";
        installationValue.textContent = installationLabel(result.installation, messages);
        manualNpm.hidden = result.installation !== "npm";
        manualWindowsInstaller.hidden = !windows || result.installation !== "windows-installer";
        releaseLink.hidden = windows;
        manualTitle.hidden =
          windows && !["npm", "windows-installer"].includes(result.installation ?? "");
        if (windows && result.installation === "windows-installer" && result.latestVersion) {
          manualWindowsInstallerLink.href = windowsInstallerDownloadUrl(
            document.defaultView,
            result.latestVersion,
          );
        }
        if (result.releaseNotesUrl) releaseLink.href = result.releaseNotesUrl;
        const operationMessage = statusMessage(result.status, messages);
        if (isPendingStatus(result.status)) {
          renderPendingStatus(result.status, operationMessage ?? messages.updatePreparing);
          scheduleStatusPoll(client, true);
          return;
        }
        const actionableStatus =
          result.status?.phase === "failed" && result.status.version === result.latestVersion
            ? result.status
            : null;
        const view = result.error ? "error" : result.updateAvailable ? "available" : "current";
        panel.dataset.updateState = view;
        panel.replaceChildren();
        setManualFallback(Boolean(result.error) || actionableStatus !== null);
        const head =
          result.error || !result.updateAvailable || windows || actionableStatus
            ? createPanelHead(
                document,
                view,
                actionableStatus
                  ? (statusMessage(actionableStatus, messages) ?? messages.updateFailed)
                  : result.error
                    ? messages.updateFailed
                    : result.updateAvailable
                      ? messages.updateWindowsManualRequired
                      : messages.updateUpToDate,
              )
            : null;
        const buttons: HTMLElement[] = [];
        if (!windows && result.updateAvailable && result.installationAvailable) {
          const update = document.createElement("button");
          update.type = "button";
          update.className = "settings-command-button";
          update.append(createRendererSettingsIcon("updates", 16), messages.updateAndRestart);
          update.addEventListener("click", () => start(client));
          buttons.push(update);
        }
        if (result.error) {
          const retry = document.createElement("button");
          retry.type = "button";
          retry.className = "settings-command-button settings-command-button--secondary";
          retry.append(createRendererSettingsIcon("refresh", 16), messages.updateRetry);
          retry.addEventListener("click", () => void load());
          buttons.push(retry);
        }
        if (head && buttons.length > 0) {
          panel.append(createPanelStatusRow(document, head, ...buttons));
        } else if (head) {
          panel.append(head);
        } else if (buttons.length > 0) {
          panel.append(createPanelActions(document, ...buttons));
        }
        if (actionableStatus?.error) {
          const error = document.createElement("p");
          error.className = "settings-update-error";
          error.textContent = actionableStatus.error;
          panel.append(error);
        }
        if (result.error) {
          const error = document.createElement("p");
          error.className = "settings-update-error";
          error.textContent = result.error;
          panel.append(error);
        }
        notes.replaceChildren();
        if (result.releaseNotes) {
          notes.append(createReleaseNotesElement(document, result.releaseNotes));
        }
      };

      const load = (): Promise<void> => {
        const client = getClient();
        if (!client) {
          renderUnavailable(messages.runtimeCapabilityNotInstalled);
          return Promise.resolve();
        }
        pending = true;
        renderPendingStatus(null, messages.updateChecking);
        return context.runLatest(
          (signal) => runBoundedRendererUpdateRequest(() => client.checkUpdate(), signal),
          {
            success(result) {
              pending = false;
              renderCheck(result, client);
            },
            failure(error) {
              pending = false;
              renderRequestFailure(error);
            },
          },
        );
      };

      void load();
      return clearPoll;
    },
  });
}

export function createDefaultRendererSettingsPages(
  messages: RendererSettingsMessages = DEFAULT_RENDERER_SETTINGS_MESSAGES,
  getUpdateClient: () => RendererUpdateClient | null = () => null,
  getDiagnostics: () => RendererConnectionDiagnostics | null = () => null,
  getSessionImportClient: () => RendererDeepSeekSessionImportClient | null = () => null,
  openImportedThread: RendererImportedThreadOpener = () =>
    Promise.reject(new Error("Imported Thread navigation is unavailable")),
): readonly RendererSettingsPageDefinition[] {
  return Object.freeze([
    createConnectionsSettingsPage(messages, getDiagnostics),
    createPluginsSettingsPage(messages, getDiagnostics),
    createDeepSeekSessionImportSettingsPage(messages, getSessionImportClient, openImportedThread),
    updatesPage(messages, getUpdateClient),
    aboutPage(messages),
  ]);
}

export function createDefaultRendererSettingsRegistry(
  messages: RendererSettingsMessages = DEFAULT_RENDERER_SETTINGS_MESSAGES,
  getUpdateClient: () => RendererUpdateClient | null = () => null,
  getDiagnostics: () => RendererConnectionDiagnostics | null = () => null,
  getSessionImportClient: () => RendererDeepSeekSessionImportClient | null = () => null,
  openImportedThread?: RendererImportedThreadOpener,
): RendererSettingsPageRegistry {
  return createRendererSettingsPageRegistry(
    createDefaultRendererSettingsPages(
      messages,
      getUpdateClient,
      getDiagnostics,
      getSessionImportClient,
      openImportedThread,
    ),
  );
}
