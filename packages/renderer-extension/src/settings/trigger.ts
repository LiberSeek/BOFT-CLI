import { createRendererSettingsBrandIcon } from "./icons.js";
import {
  DEFAULT_RENDERER_SETTINGS_MESSAGES,
  type RendererSettingsMessages,
} from "./localization.js";

export const SETTINGS_TRIGGER_ATTRIBUTE = "data-codexhost-settings-trigger";
export const SETTINGS_HEADER_SURFACE_SELECTOR =
  '[data-testid="app-shell-header-context-menu-surface"]';
const SETTINGS_APPLICATION_HEADER_SELECTOR = 'header[data-pip-obstacle="app-shell-header"]';
const SETTINGS_HEADER_SLOT_SELECTOR = ':scope > [data-test-id="header-shell-slot"]';

export interface RendererSettingsTriggerControl {
  root: HTMLElement;
  button: HTMLButtonElement;
  updateButton: HTMLButtonElement;
  setUpdateAvailable(available: boolean): void;
  dispose(): void;
}

export interface RendererSettingsBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export interface RendererSettingsHeaderSlotCandidate<T> {
  value: T;
  bounds: RendererSettingsBounds;
  visibleButtonCount: number;
  structuralActionGroup?: boolean;
}

export interface RendererSettingsHeaderTriggerControl {
  readonly root: HTMLElement | null;
  refresh(): boolean;
  setUpdateAvailable(available: boolean): void;
  dispose(): void;
}

interface RendererSettingsHeaderInsertionPoint {
  parent: HTMLElement;
  before: ChildNode | null;
}

export interface RendererSettingsContractInspection {
  headerCount: number;
  visibleHeaderCount: number;
  insertionPointCount: number;
}

function measuredBounds(element: Element): RendererSettingsBounds {
  const bounds = element.getBoundingClientRect();
  return {
    left: bounds.left,
    right: bounds.right,
    top: bounds.top,
    bottom: bounds.bottom,
    width: bounds.width,
    height: bounds.height,
  };
}

export function selectRendererSettingsHeaderSlot<T>(
  header: RendererSettingsBounds,
  candidates: readonly RendererSettingsHeaderSlotCandidate<T>[],
): T | null {
  const midpoint = header.left + header.width / 2;
  const maximumWidth = Math.min(320, header.width / 2);
  const eligible = candidates.filter(
    ({ bounds, visibleButtonCount, structuralActionGroup }) =>
      (visibleButtonCount > 1 || structuralActionGroup === true) &&
      bounds.width >= 0 &&
      bounds.height >= 0 &&
      bounds.width <= maximumWidth &&
      bounds.left >= midpoint &&
      bounds.right <= header.right + 1 &&
      bounds.top >= header.top - 1 &&
      bounds.bottom <= header.bottom + 1,
  );
  eligible.sort(
    (left, right) =>
      Math.abs(header.right - left.bounds.right) - Math.abs(header.right - right.bounds.right) ||
      right.visibleButtonCount - left.visibleButtonCount ||
      left.bounds.left - right.bounds.left,
  );
  return eligible[0]?.value ?? null;
}

export function inspectRendererSettingsContract(
  ownerDocument: Document = document,
): RendererSettingsContractInspection {
  const headers = [
    ...ownerDocument.querySelectorAll<HTMLElement>(SETTINGS_APPLICATION_HEADER_SELECTOR),
  ];
  const visibleHeaders = headers.filter((header) => {
    const bounds = measuredBounds(header);
    return bounds.width > 0 && bounds.height > 0;
  });
  const insertionPointCount = visibleHeaders.filter((header) =>
    [...header.querySelectorAll<HTMLElement>(SETTINGS_HEADER_SLOT_SELECTOR)].some((slot) => {
      const bounds = measuredBounds(slot);
      return bounds.width > 0 && bounds.height > 0;
    }),
  ).length;
  return {
    headerCount: headers.length,
    visibleHeaderCount: visibleHeaders.length,
    insertionPointCount,
  };
}

function findRendererSettingsHeaderInsertionPoint(
  ownerDocument: Document,
): RendererSettingsHeaderInsertionPoint | null {
  const header = ownerDocument.querySelector<HTMLElement>(SETTINGS_APPLICATION_HEADER_SELECTOR);
  if (!header) return null;

  const headerBounds = measuredBounds(header);
  if (headerBounds.width <= 0 || headerBounds.height <= 0) return null;

  const endSlot = [...header.querySelectorAll<HTMLElement>(SETTINGS_HEADER_SLOT_SELECTOR)]
    .filter((slot) => {
      const bounds = measuredBounds(slot);
      return bounds.width > 0 && bounds.height > 0;
    })
    .toSorted((left, right) => measuredBounds(right).left - measuredBounds(left).left)[0];
  return endSlot ? { parent: header, before: endSlot } : null;
}

export function mountRendererSettingsTrigger(
  triggerId: string,
  available: boolean,
  onOpen: (opener: HTMLButtonElement, pageId?: "updates") => void,
  ownerDocument: Document = document,
  messages: RendererSettingsMessages = DEFAULT_RENDERER_SETTINGS_MESSAGES,
): RendererSettingsTriggerControl {
  const updateLabelText = messages.pageLabels.updates;
  let updateAvailable = false;
  let brandExpanded = false;

  const root = ownerDocument.createElement("div");
  root.setAttribute(SETTINGS_TRIGGER_ATTRIBUTE, triggerId);
  root.style.display = "inline-flex";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.alignSelf = "center";
  root.style.flex = "0 0 auto";
  root.style.gap = "0";
  root.style.marginRight = "0";
  root.style.color = "inherit";
  root.style.pointerEvents = "auto";
  root.style.borderRadius = "8px";
  root.style.transition = "background 120ms ease, gap 160ms ease";
  root.style.setProperty("-webkit-app-region", "no-drag");

  const labelFontSize = "13px";
  const labelFontWeight = "600";
  const labelLineHeight = "20px";

  const button = ownerDocument.createElement("button");
  button.type = "button";
  button.disabled = !available;
  button.setAttribute("aria-label", messages.openSettings);
  button.setAttribute("aria-haspopup", "dialog");
  button.title = available ? messages.settingsButtonTitle : messages.settingsUnavailableTitle;
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.height = "28px";
  button.style.padding = "0 6px";
  button.style.gap = "0";
  button.style.border = "0";
  button.style.borderRadius = "8px";
  button.style.background = "transparent";
  button.style.color = "inherit";
  button.style.cursor = available ? "pointer" : "not-allowed";
  button.style.opacity = available ? "1" : "0.5";
  button.style.outlineOffset = "2px";
  button.style.font = "inherit";
  button.style.transition = "padding 160ms ease, gap 160ms ease";
  button.style.setProperty("-webkit-app-region", "no-drag");

  const iconWrap = ownerDocument.createElement("span");
  iconWrap.style.position = "relative";
  iconWrap.style.display = "inline-flex";
  iconWrap.style.alignItems = "center";
  iconWrap.style.justifyContent = "center";
  iconWrap.style.flex = "0 0 auto";
  iconWrap.style.width = "24px";
  iconWrap.style.height = "24px";
  iconWrap.append(createRendererSettingsBrandIcon(24));

  const updateDot = ownerDocument.createElement("span");
  updateDot.setAttribute("aria-hidden", "true");
  updateDot.style.position = "absolute";
  updateDot.style.top = "-1px";
  updateDot.style.right = "-1px";
  updateDot.style.width = "8px";
  updateDot.style.height = "8px";
  updateDot.style.borderRadius = "999px";
  updateDot.style.background = "#ef4444";
  updateDot.style.boxShadow = "0 0 0 1.5px var(--color-background, #ffffff)";
  updateDot.style.display = "none";
  iconWrap.append(updateDot);
  button.append(iconWrap);

  const brandLabel = ownerDocument.createElement("span");
  brandLabel.textContent = "BOFT CLI";
  brandLabel.style.display = "inline-flex";
  brandLabel.style.alignItems = "center";
  brandLabel.style.maxWidth = "0";
  brandLabel.style.height = labelLineHeight;
  brandLabel.style.overflow = "hidden";
  brandLabel.style.opacity = "0";
  brandLabel.style.fontFamily = "inherit";
  brandLabel.style.fontSize = labelFontSize;
  brandLabel.style.fontWeight = labelFontWeight;
  brandLabel.style.lineHeight = labelLineHeight;
  brandLabel.style.letterSpacing = "normal";
  brandLabel.style.whiteSpace = "nowrap";
  brandLabel.style.transition = "max-width 160ms ease, opacity 120ms ease";
  button.append(brandLabel);

  const updateButton = ownerDocument.createElement("button");
  updateButton.type = "button";
  updateButton.disabled = !available;
  updateButton.setAttribute("aria-label", messages.updateAvailable);
  updateButton.setAttribute("aria-haspopup", "dialog");
  updateButton.title = messages.updateAvailable;
  updateButton.textContent = updateLabelText;
  updateButton.style.display = "inline-flex";
  updateButton.style.alignItems = "center";
  updateButton.style.justifyContent = "center";
  updateButton.style.height = "28px";
  updateButton.style.maxWidth = "0";
  updateButton.style.padding = "0";
  updateButton.style.margin = "0";
  updateButton.style.overflow = "hidden";
  updateButton.style.opacity = "0";
  updateButton.style.border = "0";
  updateButton.style.borderRadius = "6px";
  updateButton.style.background = "transparent";
  updateButton.style.color = "#2563eb";
  updateButton.style.cursor = available ? "pointer" : "not-allowed";
  updateButton.style.font = "inherit";
  updateButton.style.fontFamily = "inherit";
  updateButton.style.fontSize = labelFontSize;
  updateButton.style.fontWeight = labelFontWeight;
  updateButton.style.lineHeight = labelLineHeight;
  updateButton.style.letterSpacing = "normal";
  updateButton.style.whiteSpace = "nowrap";
  updateButton.style.outlineOffset = "2px";
  updateButton.style.pointerEvents = "none";
  updateButton.style.transition =
    "max-width 160ms ease, opacity 120ms ease, padding 160ms ease, color 120ms ease, background 120ms ease";
  updateButton.style.setProperty("-webkit-app-region", "no-drag");

  const syncBrandExpansion = (): void => {
    const showUpdateAction = brandExpanded && updateAvailable && !button.disabled;
    if (brandExpanded && !button.disabled) {
      root.style.gap = "2px";
      root.style.background = "rgba(127, 127, 127, 0.16)";
      button.style.padding = "0 8px 0 6px";
      button.style.gap = "6px";
      brandLabel.style.maxWidth = "96px";
      brandLabel.style.opacity = "1";
    } else {
      root.style.gap = "0";
      root.style.background = "transparent";
      button.style.padding = "0 6px";
      button.style.gap = "0";
      brandLabel.style.maxWidth = "0";
      brandLabel.style.opacity = "0";
    }

    if (showUpdateAction) {
      updateButton.style.maxWidth = "64px";
      updateButton.style.padding = "0 8px 0 4px";
      updateButton.style.opacity = "1";
      updateButton.style.pointerEvents = "auto";
    } else {
      updateButton.style.maxWidth = "0";
      updateButton.style.padding = "0";
      updateButton.style.opacity = "0";
      updateButton.style.pointerEvents = "none";
      updateButton.style.color = "#2563eb";
      updateButton.style.background = "transparent";
    }
  };

  const applyUpdateAvailable = (nextAvailable: boolean): void => {
    updateAvailable = nextAvailable;
    root.toggleAttribute("data-update-available", updateAvailable);
    updateDot.style.display = updateAvailable ? "block" : "none";
    syncBrandExpansion();
  };

  const onRootPointerEnter = (): void => {
    brandExpanded = true;
    syncBrandExpansion();
  };
  const onRootPointerLeave = (): void => {
    brandExpanded = false;
    syncBrandExpansion();
  };
  const onBrandFocus = (): void => {
    brandExpanded = true;
    syncBrandExpansion();
  };
  const onBrandBlur = (): void => {
    if (root.matches(":hover") || updateButton.matches(":focus-visible")) return;
    brandExpanded = false;
    syncBrandExpansion();
  };
  const onClick = (event: MouseEvent): void => {
    event.stopPropagation();
    if (!button.disabled) onOpen(button);
  };
  const onUpdatePointerEnter = (): void => {
    if (updateButton.disabled || updateButton.style.pointerEvents === "none") return;
    updateButton.style.color = "#1d4ed8";
    updateButton.style.background = "rgba(37, 99, 235, 0.14)";
  };
  const onUpdatePointerLeave = (): void => {
    updateButton.style.color = "#2563eb";
    updateButton.style.background = "transparent";
  };
  const onUpdateFocus = (): void => {
    brandExpanded = true;
    syncBrandExpansion();
    if (!updateButton.disabled) {
      updateButton.style.color = "#1d4ed8";
      updateButton.style.background = "rgba(37, 99, 235, 0.14)";
    }
  };
  const onUpdateBlur = (): void => {
    updateButton.style.color = "#2563eb";
    updateButton.style.background = "transparent";
    if (root.matches(":hover") || button.matches(":focus-visible")) return;
    brandExpanded = false;
    syncBrandExpansion();
  };
  const onUpdateClick = (event: MouseEvent): void => {
    event.stopPropagation();
    if (!updateButton.disabled && updateAvailable) onOpen(updateButton, "updates");
  };
  root.addEventListener("pointerenter", onRootPointerEnter);
  root.addEventListener("pointerleave", onRootPointerLeave);
  button.addEventListener("focus", onBrandFocus);
  button.addEventListener("blur", onBrandBlur);
  button.addEventListener("click", onClick);
  updateButton.addEventListener("pointerenter", onUpdatePointerEnter);
  updateButton.addEventListener("pointerleave", onUpdatePointerLeave);
  updateButton.addEventListener("focus", onUpdateFocus);
  updateButton.addEventListener("blur", onUpdateBlur);
  updateButton.addEventListener("click", onUpdateClick);
  root.append(button, updateButton);
  applyUpdateAvailable(updateAvailable);

  return {
    root,
    button,
    updateButton,
    setUpdateAvailable(nextAvailable) {
      applyUpdateAvailable(nextAvailable);
    },
    dispose() {
      root.removeEventListener("pointerenter", onRootPointerEnter);
      root.removeEventListener("pointerleave", onRootPointerLeave);
      button.removeEventListener("focus", onBrandFocus);
      button.removeEventListener("blur", onBrandBlur);
      button.removeEventListener("click", onClick);
      updateButton.removeEventListener("pointerenter", onUpdatePointerEnter);
      updateButton.removeEventListener("pointerleave", onUpdatePointerLeave);
      updateButton.removeEventListener("focus", onUpdateFocus);
      updateButton.removeEventListener("blur", onUpdateBlur);
      updateButton.removeEventListener("click", onUpdateClick);
      root.remove();
    },
  };
}

export function installRendererSettingsHeaderTrigger(options: {
  available: boolean;
  onOpen(opener: HTMLButtonElement, pageId?: "updates"): void;
  messages?: RendererSettingsMessages;
  ownerDocument?: Document;
}): RendererSettingsHeaderTriggerControl {
  const ownerDocument = options.ownerDocument ?? document;
  let trigger: RendererSettingsTriggerControl | null = null;
  let updateAvailable = false;
  let disposed = false;

  const refresh = (): boolean => {
    if (disposed) return false;
    const insertionPoint = findRendererSettingsHeaderInsertionPoint(ownerDocument);
    if (!insertionPoint) {
      trigger?.root.remove();
      return false;
    }
    if (!trigger) {
      for (const duplicate of ownerDocument.querySelectorAll(`[${SETTINGS_TRIGGER_ATTRIBUTE}]`)) {
        duplicate.remove();
      }
      trigger = mountRendererSettingsTrigger(
        "application-header",
        options.available,
        options.onOpen,
        ownerDocument,
        options.messages,
      );
      trigger.setUpdateAvailable(updateAvailable);
    }
    if (
      trigger.root.parentElement !== insertionPoint.parent ||
      trigger.root.nextSibling !== insertionPoint.before
    ) {
      insertionPoint.parent.insertBefore(trigger.root, insertionPoint.before);
    }
    return true;
  };

  refresh();
  return {
    get root() {
      return trigger?.root ?? null;
    },
    refresh,
    setUpdateAvailable(available) {
      updateAvailable = available;
      trigger?.setUpdateAvailable(available);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      trigger?.dispose();
      trigger = null;
    },
  };
}
