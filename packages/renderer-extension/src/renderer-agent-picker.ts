import {
  getSharedAgentGroupPreferenceStore,
  partitionAgentsByInstallStatus,
  type AgentGroupPreferenceStore,
} from "./agent-group-preference.js";
import type {
  ComposerAgentPhase,
  ExternalRendererAgent,
  RendererAgent,
  RendererAgentAvailability,
} from "./agent-selection-state.js";
import { createRendererAgentIcon, RENDERER_AGENT_LABELS } from "./renderer-agent-icon.js";
import { applyRendererPickerPopoverSurface } from "./renderer-picker-popover-style.js";
import { requestConnectionsPageFocus } from "./settings/connections-page.js";
import { createRendererSettingsIcon } from "./settings/icons.js";
import {
  rendererSettingsMessages,
  resolveRendererSettingsLocale,
} from "./settings/localization.js";
import type { RendererAdapterStatus } from "./versioned-renderer-adapter.js";

// The picker's own strings (labels, tooltips, "Install ...") stay hardcoded
// English by longstanding convention in this file — only the newer
// Main/More grouping copy below is localized, since it mirrors text the
// user already sees (translated) on the Connections settings page.
function pickerGroupMessages(): Pick<
  ReturnType<typeof rendererSettingsMessages>,
  "pickerMoreAgentsLabel" | "pickerManageLink" | "pickerHideUnusedAgentsCta"
> {
  const languages = typeof navigator !== "undefined" ? navigator.languages : [];
  return rendererSettingsMessages(resolveRendererSettingsLocale(languages));
}

// Opens the Connections settings page from the picker's "More Agents" group.
// The shell installs this handle globally (see settings/shell.ts) as
// `window.__codexhostSettingsShellV1`; it is a no-op before the settings
// surface has mounted. Read through a local structural type instead of
// augmenting the global `Window` interface, so this stays a no-op import
// away from the settings module.
interface MinimalSettingsShellHandle {
  openSettings(opener?: HTMLElement, pageId?: string): boolean;
}

function openConnectionsSettings(opener?: HTMLElement): void {
  const shell = (window as unknown as { __codexhostSettingsShellV1?: MinimalSettingsShellHandle })
    .__codexhostSettingsShellV1;
  shell?.openSettings(opener, "connections");
}

export const RENDERER_AGENT_INSTALL_URLS: Readonly<Record<ExternalRendererAgent, string>> = {
  pi: "https://pi.dev/",
  "claude-code": "https://code.claude.com/docs/en/quickstart",
  "deepseek-harness": "https://github.com/deepseek-ai/deepseek-harness",
  opencode: "https://opencode.ai/docs/",
  grok: "https://grok.com/",
  omp: "https://github.com/can1357/oh-my-pi",
  antigravity: "https://antigravity.google/product/antigravity-cli",
};

type AgentAvailability = Partial<Record<ExternalRendererAgent, RendererAgentAvailability>>;

export const CONTROL_ATTRIBUTE = "data-codexhost-agent-control";
const AGENT_MENU_WIDTH = 200;
// Below this many enabled Agents, the picker stays a flat list — grouping
// only earns its keep once there are enough Harnesses to make scanning slow.
const AGENT_GROUP_CTA_THRESHOLD = 5;
// Shared size for Lucide chrome icons (More chevron + Settings gear).
const PICKER_CHROME_ICON_SIZE_PX = 18;

interface AgentOptionControl {
  button: HTMLButtonElement;
  /** Trailing ✓ inside the option button (same row as icon + label). */
  check: HTMLElement;
  // Overlays the trailing check slot as Install ("+") when not installed, or
  // a red error ("!") once it has failed — mutually exclusive with a selected
  // ✓ since `RendererAgentAvailability` is a single enum value. Error mode
  // has no inline details (picker only gets the coarse enum), so it links
  // out to Settings → Connections instead.
  action: HTMLButtonElement | null;
}

export interface RendererAgentPickerControl {
  root: HTMLElement;
  trigger: HTMLButtonElement;
  iconSlot: HTMLElement;
  spinner: HTMLElement;
  menu: HTMLElement;
  agents: readonly RendererAgent[];
  options: Partial<Record<RendererAgent, AgentOptionControl>>;
  /** Re-apply Main/More order using the latest install availability. */
  syncAvailability(availability: AgentAvailability): void;
  close(): void;
  dispose(): void;
}

export interface RendererAgentPickerView {
  label: string;
  triggerDisabled: boolean;
  nativeModelHidden: boolean;
  optionDisabled: Partial<Record<RendererAgent, boolean>>;
  downloadVisible: Partial<Record<ExternalRendererAgent, boolean>>;
  /** True while availability is `error`. In-flight retries must keep that status, not flash back to `checking`. */
  errorVisible: Partial<Record<ExternalRendererAgent, boolean>>;
}

export function rendererAgentMenuPlacement(
  triggerRect: Pick<DOMRectReadOnly, "right" | "top">,
  viewport: { width: number; height: number },
  windowZoom: number,
): { left: number; bottom: number } {
  const zoom = Number.isFinite(windowZoom) && windowZoom > 0 ? windowZoom : 1;
  const viewportWidth = viewport.width / zoom;
  const viewportHeight = viewport.height / zoom;
  const left = Math.max(
    8,
    Math.min(triggerRect.right / zoom - AGENT_MENU_WIDTH, viewportWidth - AGENT_MENU_WIDTH - 8),
  );
  return {
    left,
    bottom: Math.max(8, viewportHeight - triggerRect.top / zoom + 6),
  };
}

/**
 * Trailing status slot is shared: selected ✓ vs install/error action.
 * Action wins when both would apply (common during startup while a selected
 * external Agent is still `error` / `notInstalled`).
 */
export function rendererAgentTrailingSlot(input: {
  selected: boolean;
  showInstall: boolean;
  showError: boolean;
}): { checkVisible: boolean; actionVisible: boolean } {
  const actionVisible = input.showInstall || input.showError;
  return {
    actionVisible,
    checkVisible: input.selected && !actionVisible,
  };
}

export function rendererAgentPickerView(
  state: { agent: RendererAgent; phase: ComposerAgentPhase },
  adapterState: RendererAdapterStatus["state"],
  switching: boolean,
  agents: readonly RendererAgent[],
  availability: AgentAvailability = {},
): RendererAgentPickerView {
  const optionDisabled = Object.fromEntries(
    agents.map((agent) => [
      agent,
      switching ||
        state.phase === "locked" ||
        (agent !== "codex" && (adapterState !== "ready" || availability[agent] !== "ready")),
    ]),
  ) as Partial<Record<RendererAgent, boolean>>;
  const downloadVisible = Object.fromEntries(
    agents
      .filter((agent): agent is ExternalRendererAgent => agent !== "codex")
      .map((agent) => [agent, availability[agent] === "notInstalled"]),
  ) as Partial<Record<ExternalRendererAgent, boolean>>;
  const errorVisible = Object.fromEntries(
    agents
      .filter((agent): agent is ExternalRendererAgent => agent !== "codex")
      .map((agent) => [agent, availability[agent] === "error"]),
  ) as Partial<Record<ExternalRendererAgent, boolean>>;
  return {
    label: RENDERER_AGENT_LABELS[state.agent],
    triggerDisabled: switching || state.phase === "locked" || agents.length < 2,
    nativeModelHidden: switching || state.agent !== "codex",
    optionDisabled,
    downloadVisible,
    errorVisible,
  };
}

function setMenuPosition(control: RendererAgentPickerControl): void {
  const rect = control.trigger.getBoundingClientRect();
  const rawWindowZoom = getComputedStyle(document.documentElement)
    .getPropertyValue("--codex-window-zoom")
    .trim();
  const placement = rendererAgentMenuPlacement(
    rect,
    { width: window.innerWidth, height: window.innerHeight },
    Number.parseFloat(rawWindowZoom),
  );
  control.menu.style.left = `${placement.left}px`;
  control.menu.style.bottom = `${placement.bottom}px`;
}

function popoverOpen(menu: HTMLElement): boolean {
  try {
    return menu.matches(":popover-open");
  } catch {
    return !menu.hidden;
  }
}

export function mountRendererAgentPicker(
  composerId: string,
  enabledAgents: readonly RendererAgent[],
  onSelect: (agent: RendererAgent) => void,
  onDownload: (agent: ExternalRendererAgent) => void,
  groupPreference: AgentGroupPreferenceStore = getSharedAgentGroupPreferenceStore(),
): RendererAgentPickerControl {
  const root = document.createElement("div");
  root.setAttribute(CONTROL_ATTRIBUTE, composerId);
  root.style.display = "inline-flex";
  root.style.alignItems = "center";
  root.style.alignSelf = "center";
  root.style.verticalAlign = "middle";
  root.style.width = "30px";
  root.style.height = "28px";
  // Trailing-cluster spacing (Model / Agent / Send) is owned by
  // `refreshTrailingClusterPlacement` so left/right gaps stay equal.
  root.style.margin = "0";
  root.style.color = "inherit";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  trigger.style.position = "relative";
  trigger.style.display = "inline-flex";
  trigger.style.alignItems = "center";
  trigger.style.justifyContent = "center";
  trigger.style.width = "30px";
  trigger.style.height = "28px";
  trigger.style.padding = "0";
  trigger.style.border = "0";
  trigger.style.borderRadius = "6px";
  trigger.style.background = "transparent";
  trigger.style.color = "inherit";
  trigger.style.cursor = "pointer";
  trigger.addEventListener("pointerenter", () => {
    if (!trigger.disabled) trigger.style.background = "rgba(127, 127, 127, 0.16)";
  });
  trigger.addEventListener("pointerleave", () => {
    trigger.style.background = "transparent";
  });

  const iconSlot = document.createElement("span");
  iconSlot.style.display = "inline-flex";
  iconSlot.style.alignItems = "center";
  iconSlot.style.justifyContent = "center";
  iconSlot.style.width = "20px";
  iconSlot.style.height = "20px";

  const spinner = document.createElement("span");
  spinner.setAttribute("aria-hidden", "true");
  spinner.style.display = "none";
  spinner.style.width = "16px";
  spinner.style.height = "16px";
  spinner.style.border = "2px solid currentColor";
  spinner.style.borderTopColor = "transparent";
  spinner.style.borderRadius = "50%";
  spinner.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], {
    duration: 800,
    iterations: Infinity,
  });
  trigger.append(iconSlot, spinner);

  const menu = document.createElement("div");
  menu.id = `${composerId}-agent-menu`;
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Agent");
  menu.setAttribute("popover", "auto");
  menu.hidden = typeof menu.showPopover !== "function";
  menu.style.position = "fixed";
  menu.style.inset = "auto";
  menu.style.width = `${AGENT_MENU_WIDTH}px`;
  menu.style.padding = "4px";
  menu.style.boxSizing = "border-box";
  menu.style.overflowX = "hidden";
  menu.style.overflowY = "auto";
  menu.style.zIndex = "2147483647";
  applyRendererPickerPopoverSurface(menu);
  trigger.setAttribute("aria-controls", menu.id);

  const options: Partial<Record<RendererAgent, AgentOptionControl>> = {};
  const rowsByAgent = new Map<RendererAgent, HTMLDivElement>();
  const groupMessages = pickerGroupMessages();

  const close = (): void => {
    if (!popoverOpen(menu)) return;
    if (typeof menu.hidePopover === "function") menu.hidePopover();
    else menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };
  const visibleAgentOrder = (): readonly RendererAgent[] =>
    moreOpen ? [...mainAgents, ...moreAgents] : mainAgents;
  const focusOption = (position: "first" | "last" | "selected"): void => {
    const available = visibleAgentOrder()
      .map((agent) => options[agent]?.button)
      .filter((button): button is HTMLButtonElement => button !== undefined && !button.disabled);
    const selected = available.find((button) => button.getAttribute("aria-checked") === "true");
    const target =
      position === "last" ? available.at(-1) : position === "selected" ? selected : available[0];
    target?.focus();
  };
  const open = (focus: "first" | "last" | "selected" = "selected"): void => {
    if (trigger.disabled || popoverOpen(menu)) return;
    setMenuPosition(control);
    if (typeof menu.showPopover === "function") menu.showPopover();
    else menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    queueMicrotask(() => focusOption(focus));
  };

  for (const agent of enabledAgents) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.agent = agent;
    button.setAttribute("role", "menuitemradio");
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.gap = "8px";
    button.style.minWidth = "0";
    button.style.width = "100%";
    button.style.flex = "1 1 auto";
    button.style.height = "36px";
    button.style.padding = "0 8px";
    button.style.border = "0";
    button.style.borderRadius = "4px";
    button.style.background = "transparent";
    button.style.color = "inherit";
    button.style.font = "500 13px/1 system-ui, sans-serif";
    button.style.letterSpacing = "0";
    button.style.textAlign = "left";
    button.style.cursor = "pointer";
    const updateHighlight = (active: boolean): void => {
      const selected = button.getAttribute("aria-checked") === "true";
      button.style.background =
        selected || (active && !button.disabled)
          ? `rgba(127, 127, 127, ${selected ? "0.16" : "0.1"})`
          : "transparent";
    };
    button.addEventListener("pointerenter", () => updateHighlight(true));
    button.addEventListener("pointerleave", () => updateHighlight(false));
    button.addEventListener("focus", () => updateHighlight(true));
    button.addEventListener("blur", () => updateHighlight(false));

    const check = document.createElement("span");
    check.textContent = "\u2713";
    check.setAttribute("aria-hidden", "true");
    check.style.display = "inline-flex";
    check.style.alignItems = "center";
    check.style.justifyContent = "center";
    check.style.width = "24px";
    check.style.height = "24px";
    check.style.flex = "none";
    check.style.visibility = "hidden";

    const label = document.createElement("span");
    label.textContent = RENDERER_AGENT_LABELS[agent];
    label.style.minWidth = "0";
    label.style.flex = "1 1 auto";
    label.style.overflow = "hidden";
    label.style.textOverflow = "ellipsis";
    label.style.whiteSpace = "nowrap";
    // Icon + label + ✓ share one button so selection reads as a single row
    // (same pattern as the model / permission pickers).
    button.append(createRendererAgentIcon(agent), label, check);
    button.addEventListener("click", () => {
      const selected = button.getAttribute("aria-pressed") === "true";
      close();
      trigger.focus();
      if (!selected) onSelect(agent);
    });

    const action =
      agent === "codex"
        ? null
        : (() => {
            const control = document.createElement("button");
            control.type = "button";
            // Overlay the trailing check slot — install/error never share a
            // selected row with ✓, and nesting a button inside the option
            // button is invalid HTML.
            control.style.position = "absolute";
            control.style.top = "50%";
            control.style.right = "8px";
            control.style.transform = "translateY(-50%)";
            control.style.display = "inline-flex";
            control.style.alignItems = "center";
            control.style.justifyContent = "center";
            control.style.width = "24px";
            control.style.height = "24px";
            control.style.flex = "none";
            control.style.padding = "0";
            control.style.border = "0";
            control.style.borderRadius = "4px";
            control.style.background = "transparent";
            control.style.cursor = "pointer";
            // Hidden until the first render pass decides install/error — otherwise
            // an empty absolute button sits on top of the ✓ during mount.
            control.style.visibility = "hidden";
            control.style.pointerEvents = "none";
            control.disabled = true;
            control.setAttribute("aria-hidden", "true");
            control.addEventListener("pointerenter", () => {
              if (!control.disabled) control.style.background = "rgba(127, 127, 127, 0.16)";
            });
            control.addEventListener("pointerleave", () => {
              control.style.background = "transparent";
            });
            control.addEventListener("click", (event) => {
              event.stopPropagation();
              // "error" mode has nothing more to show inline — the picker
              // only knows the coarse availability enum, not the full
              // `CodexhostError` — so it hands off to Settings, which does.
              // `requestConnectionsPageFocus` makes sure Settings opens
              // straight to *this* Agent's row, not just the page.
              if (control.dataset.mode === "error") {
                requestConnectionsPageFocus(agent);
                openConnectionsSettings(trigger);
              } else {
                onDownload(agent);
              }
            });
            return control;
          })();
    options[agent] = { button, check, action };
    const row = document.createElement("div");
    row.style.position = "relative";
    row.style.display = "block";
    row.append(button);
    if (action) row.append(action);
    rowsByAgent.set(agent, row);
  }

  // "Main" holds every enabled Agent by default; a user can fold the ones
  // they never switch to into "More" from the Connections settings page.
  // Codex always stays pinned to Main — it is the always-on default and is
  // not offered in Connections' grouping list.
  const mainGroup = document.createElement("div");
  mainGroup.style.display = "flex";
  mainGroup.style.flexDirection = "column";
  mainGroup.style.gap = "2px";

  let moreOpen = false;
  const applyMutedChromeHover = (button: HTMLButtonElement): void => {
    button.addEventListener("pointerenter", () => {
      button.style.background = "rgba(127, 127, 127, 0.1)";
    });
    button.addEventListener("pointerleave", () => {
      button.style.background = "transparent";
    });
  };
  const moreRow = document.createElement("div");
  moreRow.dataset.codexhostAgentMore = "row";
  moreRow.style.position = "relative";
  moreRow.style.display = "none";
  moreRow.style.width = "100%";
  moreRow.style.marginTop = "2px";
  moreRow.style.minWidth = "0";
  const moreToggle = document.createElement("button");
  moreToggle.type = "button";
  moreToggle.dataset.codexhostAgentMore = "toggle";
  moreToggle.setAttribute("aria-expanded", "false");
  moreToggle.style.display = "flex";
  moreToggle.style.alignItems = "center";
  moreToggle.style.gap = "8px";
  moreToggle.style.width = "100%";
  moreToggle.style.height = "36px";
  // Trailing 40px matches the Agent row's 8px padding + 24px action slot + 8px.
  moreToggle.style.padding = "0 40px 0 8px";
  moreToggle.style.border = "0";
  moreToggle.style.borderRadius = "4px";
  moreToggle.style.background = "transparent";
  moreToggle.style.color = "inherit";
  moreToggle.style.font = "500 13px/1 system-ui, sans-serif";
  moreToggle.style.opacity = "0.72";
  moreToggle.style.cursor = "pointer";
  applyMutedChromeHover(moreToggle);
  const moreArrow = document.createElement("span");
  moreArrow.setAttribute("aria-hidden", "true");
  moreArrow.style.display = "inline-flex";
  moreArrow.style.alignItems = "center";
  moreArrow.style.justifyContent = "center";
  moreArrow.style.width = `${PICKER_CHROME_ICON_SIZE_PX}px`;
  moreArrow.style.height = `${PICKER_CHROME_ICON_SIZE_PX}px`;
  moreArrow.style.flex = "none";
  moreArrow.style.color = "currentColor";
  const setMoreArrow = (open: boolean): void => {
    moreArrow.replaceChildren(
      createRendererSettingsIcon(open ? "chevron-up" : "chevron-right", PICKER_CHROME_ICON_SIZE_PX),
    );
  };
  setMoreArrow(false);
  const moreLabel = document.createElement("span");
  moreLabel.style.display = "inline-flex";
  moreLabel.style.alignItems = "center";
  moreLabel.style.minWidth = "0";
  moreLabel.style.flex = "1 1 auto";
  moreLabel.style.overflow = "hidden";
  moreLabel.style.textOverflow = "ellipsis";
  moreLabel.style.whiteSpace = "nowrap";
  moreLabel.style.lineHeight = `${PICKER_CHROME_ICON_SIZE_PX}px`;
  moreToggle.append(moreArrow, moreLabel);
  const moreSettings = document.createElement("button");
  moreSettings.type = "button";
  moreSettings.dataset.codexhostAgentMore = "settings";
  moreSettings.setAttribute("aria-label", groupMessages.pickerManageLink);
  moreSettings.title = groupMessages.pickerManageLink;
  // Same trailing slot as the Agent install "+" action (24×24, 8px from the right).
  moreSettings.style.position = "absolute";
  moreSettings.style.top = "50%";
  moreSettings.style.right = "8px";
  moreSettings.style.transform = "translateY(-50%)";
  moreSettings.style.display = "inline-flex";
  moreSettings.style.alignItems = "center";
  moreSettings.style.justifyContent = "center";
  moreSettings.style.width = "24px";
  moreSettings.style.height = "24px";
  moreSettings.style.flex = "none";
  moreSettings.style.padding = "0";
  moreSettings.style.border = "0";
  moreSettings.style.borderRadius = "4px";
  moreSettings.style.background = "transparent";
  moreSettings.style.color = "inherit";
  moreSettings.style.opacity = "0.72";
  moreSettings.style.cursor = "pointer";
  const moreSettingsIcon = document.createElement("span");
  moreSettingsIcon.setAttribute("aria-hidden", "true");
  moreSettingsIcon.style.display = "inline-flex";
  moreSettingsIcon.style.alignItems = "center";
  moreSettingsIcon.style.justifyContent = "center";
  moreSettingsIcon.style.width = `${PICKER_CHROME_ICON_SIZE_PX}px`;
  moreSettingsIcon.style.height = `${PICKER_CHROME_ICON_SIZE_PX}px`;
  moreSettingsIcon.style.color = "currentColor";
  moreSettingsIcon.append(createRendererSettingsIcon("settings", PICKER_CHROME_ICON_SIZE_PX));
  moreSettings.append(moreSettingsIcon);
  applyMutedChromeHover(moreSettings);
  moreSettings.addEventListener("click", (event) => {
    event.stopPropagation();
    openConnectionsSettings(trigger);
  });
  moreRow.append(moreToggle, moreSettings);

  const morePanel = document.createElement("div");
  morePanel.id = `${composerId}-agent-more`;
  morePanel.dataset.codexhostAgentMore = "panel";
  moreToggle.setAttribute("aria-controls", morePanel.id);
  morePanel.style.display = "none";
  morePanel.style.flexDirection = "column";
  morePanel.style.gap = "2px";
  // Keep More rows flush with Main — no nested indent once expanded.
  const moreRows = document.createElement("div");
  moreRows.style.display = "flex";
  moreRows.style.flexDirection = "column";
  moreRows.style.gap = "2px";
  morePanel.append(moreRows);
  const createSettingsAction = (
    labelText: string,
    options: { initiallyHidden?: boolean; bordered?: boolean } = {},
  ): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.style.display = options.initiallyHidden ? "none" : "flex";
    button.style.alignItems = "center";
    button.style.gap = "8px";
    button.style.width = "100%";
    button.style.height = "36px";
    button.style.marginTop = "2px";
    button.style.padding = "0 8px";
    button.style.border = "0";
    if (options.bordered) {
      button.style.borderWidth = "1px 0 0 0";
      button.style.borderStyle = "solid";
      button.style.borderColor = "rgba(127, 127, 127, 0.16)";
      button.style.borderRadius = "0";
    } else {
      button.style.borderRadius = "4px";
    }
    button.style.background = "transparent";
    button.style.color = "inherit";
    button.style.font = "500 13px/1 system-ui, sans-serif";
    button.style.opacity = "0.72";
    button.style.cursor = "pointer";
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.style.display = "inline-flex";
    icon.style.alignItems = "center";
    icon.style.justifyContent = "center";
    icon.style.width = `${PICKER_CHROME_ICON_SIZE_PX}px`;
    icon.style.height = `${PICKER_CHROME_ICON_SIZE_PX}px`;
    icon.style.flex = "none";
    icon.style.color = "currentColor";
    icon.append(createRendererSettingsIcon("settings", PICKER_CHROME_ICON_SIZE_PX));
    const label = document.createElement("span");
    label.textContent = labelText;
    label.style.display = "inline-flex";
    label.style.alignItems = "center";
    label.style.lineHeight = `${PICKER_CHROME_ICON_SIZE_PX}px`;
    button.append(icon, label);
    applyMutedChromeHover(button);
    button.addEventListener("click", () => openConnectionsSettings(trigger));
    return button;
  };

  const cta = createSettingsAction(groupMessages.pickerHideUnusedAgentsCta, {
    initiallyHidden: true,
    bordered: true,
  });

  let latestAvailability: AgentAvailability = {};
  let mainAgents: RendererAgent[] = [...enabledAgents];
  let moreAgents: RendererAgent[] = [];
  const isInstalled = (agent: ExternalRendererAgent): boolean =>
    latestAvailability[agent] !== "notInstalled";
  const partitionExternal = (agents: readonly RendererAgent[]): RendererAgent[] =>
    partitionAgentsByInstallStatus(
      agents
        .filter((agent): agent is ExternalRendererAgent => agent !== "codex")
        .map((agent) => ({ agent })),
      isInstalled,
    ).map((entry) => entry.agent);
  const regroup = (): void => {
    const enabledSet = new Set(enabledAgents);
    const seen = new Set<RendererAgent>();
    const nextMain: RendererAgent[] = [];
    const nextMore: RendererAgent[] = [];

    // Codex is always pinned to Main and isn't tracked by the preference
    // store (it's the always-on default, not offered in Connections'
    // grouping list).
    if (enabledSet.has("codex")) {
      nextMain.push("codex");
      seen.add("codex");
    }

    // Order follows `groupPreference.list()` — the same order the user just
    // dragged into on the Connections page — not `enabledAgents`'s fixed
    // (host-configured) order, so reordering actually shows up here too.
    for (const entry of groupPreference.list()) {
      const agent = entry.agent as RendererAgent;
      if (!enabledSet.has(agent) || seen.has(agent)) continue;
      seen.add(agent);
      (entry.section === "more" ? nextMore : nextMain).push(agent);
    }

    // Defensive: an enabled Agent the preference store hasn't recorded yet
    // (should not normally happen) still needs to render somewhere.
    for (const agent of enabledAgents) {
      if (seen.has(agent)) continue;
      seen.add(agent);
      nextMain.push(agent);
    }

    // Within each section, installed Agents stay ahead of uninstalled ones.
    // Codex remains pinned at the front of Main.
    const mainExternal = partitionExternal(nextMain);
    const moreExternal = partitionExternal(nextMore);
    mainAgents = enabledSet.has("codex") ? ["codex", ...mainExternal] : mainExternal;
    moreAgents = moreExternal;
    mainGroup.replaceChildren(
      ...mainAgents
        .map((agent) => rowsByAgent.get(agent))
        .filter((el): el is HTMLDivElement => !!el),
    );
    moreRows.replaceChildren(
      ...moreAgents
        .map((agent) => rowsByAgent.get(agent))
        .filter((el): el is HTMLDivElement => !!el),
    );
    const showMoreGroup = moreAgents.length > 0;
    const showCta = !showMoreGroup && enabledAgents.length > AGENT_GROUP_CTA_THRESHOLD;
    moreRow.style.display = showMoreGroup ? "block" : "none";
    morePanel.style.display = showMoreGroup && moreOpen ? "flex" : "none";
    moreToggle.setAttribute("aria-expanded", String(showMoreGroup && moreOpen));
    cta.style.display = showCta ? "flex" : "none";
    moreLabel.textContent = `${groupMessages.pickerMoreAgentsLabel} (${moreAgents.length})`;
    setMoreArrow(moreOpen);
  };
  moreToggle.addEventListener("click", () => {
    moreOpen = !moreOpen;
    regroup();
  });
  regroup();
  const unsubscribeGroup = groupPreference.subscribe(regroup);

  // More Agents sit above the toggle so the extra list expands upward.
  // Settings lives on the toggle row, not as a trailing item after expand.
  menu.append(mainGroup, morePanel, moreRow, cta);
  root.append(trigger, menu);

  const onTriggerClick = (): void => {
    if (popoverOpen(menu)) close();
    else open();
  };
  const onTriggerKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    open(event.key === "ArrowUp" ? "last" : "first");
  };
  const onMenuKeyDown = (event: KeyboardEvent): void => {
    const buttons = visibleAgentOrder()
      .map((agent) => options[agent]?.button)
      .filter((button): button is HTMLButtonElement => button !== undefined && !button.disabled);
    const current = event.target instanceof Element ? event.target.closest("button") : null;
    const index = buttons.indexOf(current as HTMLButtonElement);
    if (event.key === "Escape") {
      close();
      trigger.focus();
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const target =
      event.key === "Home"
        ? buttons[0]
        : event.key === "End"
          ? buttons.at(-1)
          : event.key === "ArrowDown"
            ? buttons[(index + 1 + buttons.length) % buttons.length]
            : buttons[(index - 1 + buttons.length) % buttons.length];
    target?.focus();
  };
  const onToggle = (): void => {
    trigger.setAttribute("aria-expanded", String(popoverOpen(menu)));
  };
  const onViewportChange = (): void => {
    if (popoverOpen(menu)) setMenuPosition(control);
  };
  trigger.addEventListener("click", onTriggerClick);
  trigger.addEventListener("keydown", onTriggerKeyDown);
  menu.addEventListener("keydown", onMenuKeyDown);
  menu.addEventListener("toggle", onToggle);
  window.addEventListener("resize", onViewportChange);
  window.addEventListener("scroll", onViewportChange, true);

  const control: RendererAgentPickerControl = {
    root,
    trigger,
    iconSlot,
    spinner,
    menu,
    agents: [...enabledAgents],
    options,
    syncAvailability(availability) {
      latestAvailability = availability;
      regroup();
    },
    close,
    dispose() {
      close();
      unsubscribeGroup();
      trigger.removeEventListener("click", onTriggerClick);
      trigger.removeEventListener("keydown", onTriggerKeyDown);
      menu.removeEventListener("keydown", onMenuKeyDown);
      menu.removeEventListener("toggle", onToggle);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      root.remove();
    },
  };
  return control;
}

export function renderRendererAgentPicker(
  control: RendererAgentPickerControl,
  state: { agent: RendererAgent; phase: ComposerAgentPhase },
  adapterState: RendererAdapterStatus["state"],
  switching: boolean,
  availability: AgentAvailability = {},
): RendererAgentPickerView {
  control.syncAvailability(availability);
  const view = rendererAgentPickerView(
    state,
    adapterState,
    switching,
    control.agents,
    availability,
  );
  if (control.iconSlot.dataset.agent !== state.agent) {
    control.iconSlot.replaceChildren(createRendererAgentIcon(state.agent));
    control.iconSlot.dataset.agent = state.agent;
  }
  control.trigger.disabled = view.triggerDisabled;
  control.trigger.setAttribute("aria-busy", String(switching));
  control.trigger.setAttribute(
    "aria-label",
    state.phase === "locked" ? `Agent: ${view.label}` : `Select Agent, current ${view.label}`,
  );
  control.trigger.title =
    state.phase === "locked" ? `Agent: ${view.label} (locked)` : `Agent: ${view.label}`;
  control.trigger.style.cursor = control.trigger.disabled ? "not-allowed" : "pointer";
  control.trigger.style.opacity = control.trigger.disabled && !switching ? "0.72" : "1";
  control.iconSlot.style.display = switching ? "none" : "inline-flex";
  control.spinner.style.display = switching ? "block" : "none";
  if (view.triggerDisabled) control.close();

  for (const agent of control.agents) {
    const option = control.options[agent];
    if (!option) continue;
    const selected = agent === state.agent;
    option.button.disabled = view.optionDisabled[agent] ?? true;
    option.button.setAttribute("aria-checked", String(selected));
    option.button.setAttribute("aria-pressed", String(selected));
    option.button.style.background = selected ? "rgba(127, 127, 127, 0.16)" : "transparent";
    option.button.style.cursor = option.button.disabled ? "not-allowed" : "pointer";
    option.button.style.opacity = option.button.disabled && !selected ? "0.5" : "1";
    if (option.action) {
      const externalAgent = agent as ExternalRendererAgent;
      const showInstall = view.downloadVisible[externalAgent] === true;
      const showError = view.errorVisible[externalAgent] === true;
      const { checkVisible, actionVisible } = rendererAgentTrailingSlot({
        selected,
        showInstall,
        showError,
      });
      option.check.style.visibility = checkVisible ? "visible" : "hidden";
      option.action.hidden = false;
      option.action.disabled = !actionVisible;
      option.action.style.display = "inline-flex";
      option.action.style.visibility = actionVisible ? "visible" : "hidden";
      option.action.style.pointerEvents = actionVisible ? "auto" : "none";
      if (showError) {
        option.action.dataset.mode = "error";
        option.action.textContent = "!";
        option.action.style.color = "#f87171";
        option.action.style.font = "800 13px/1 system-ui, sans-serif";
        option.action.style.opacity = "1";
        const label = `${RENDERER_AGENT_LABELS[agent]} connection error — open Settings for details`;
        option.action.setAttribute("aria-label", label);
        option.action.title = label;
      } else {
        option.action.dataset.mode = "install";
        option.action.textContent = "+";
        option.action.style.color = "inherit";
        option.action.style.font = "600 18px/1 system-ui, sans-serif";
        option.action.style.opacity = "0.72";
        const label = `Install ${RENDERER_AGENT_LABELS[agent]}`;
        option.action.setAttribute("aria-label", label);
        option.action.title = label;
      }
      option.action.setAttribute("aria-hidden", String(!actionVisible));
    } else {
      option.check.style.visibility = selected ? "visible" : "hidden";
    }
  }
  return view;
}
