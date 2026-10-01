import type { RendererSettingsMessages } from "./localization.js";

/** Append a model here to list it on the 1M switch. */
export const CLAUDE_LONG_CONTEXT_MODELS = [{ id: "claude-opus-5-5", window: "1M" }] as const;

let tooltipSequence = 0;

function popoverOpen(tooltip: HTMLElement): boolean {
  try {
    return tooltip.matches(":popover-open");
  } catch {
    return false;
  }
}

export function createClaudeLongContextControl(
  document: Document,
  messages: RendererSettingsMessages,
  actions: {
    get: () => Promise<{ enabled: boolean }>;
    set: (enabled: boolean) => Promise<{ enabled: boolean }>;
  },
): HTMLElement {
  const control = document.createElement("span");
  control.className = "settings-connection-long-context";
  const label = document.createElement("label");
  label.className = "settings-connection-long-context__control";
  const text = document.createElement("span");
  text.textContent = messages.connectionLongContextLabel;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = true;
  input.setAttribute("role", "switch");
  input.setAttribute("aria-checked", "true");
  input.setAttribute("aria-label", messages.connectionLongContextLabel);
  input.dataset.connectionAction = "long-context";
  const tooltip = document.createElement("div");
  tooltip.id = `settings-long-context-tooltip-${++tooltipSequence}`;
  tooltip.className = "settings-connection-long-context__tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.setAttribute("popover", "manual");
  tooltip.hidden = true;
  const on = document.createElement("p");
  on.textContent = messages.connectionLongContextOn;
  const off = document.createElement("p");
  off.textContent = messages.connectionLongContextOff;
  const modelsLabel = document.createElement("p");
  modelsLabel.textContent = messages.connectionLongContextModelsLabel;
  const models = document.createElement("ul");
  for (const model of CLAUDE_LONG_CONTEXT_MODELS) {
    const item = document.createElement("li");
    item.textContent = `${model.id} (${model.window})`;
    models.append(item);
  }
  tooltip.append(on, off, modelsLabel, models);
  input.setAttribute("aria-describedby", tooltip.id);
  const stop = (event: Event): void => {
    event.stopPropagation();
  };
  control.addEventListener("click", stop);
  label.addEventListener("click", stop);
  input.addEventListener("click", stop);
  let surfaceReady = false;
  const applyTooltipSurface = (): void => {
    if (surfaceReady) return;
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;visibility:hidden;color:var(--settings-text);background-color:var(--settings-elevated);border-top-color:var(--settings-border)";
    control.append(probe);
    const computed = document.defaultView?.getComputedStyle(probe);
    const color = computed?.color;
    const background = computed?.backgroundColor;
    const borderColor = computed?.borderTopColor;
    probe.remove();
    if (color) tooltip.style.color = color;
    if (background && background !== "rgba(0, 0, 0, 0)") tooltip.style.backgroundColor = background;
    if (borderColor) tooltip.style.border = `1px solid ${borderColor}`;
    surfaceReady = true;
  };
  const showTooltip = (): void => {
    // The settings page clips overflow inside a shadow root. A tip on
    // document.body never receives these styles and paints under the page.
    // The top layer also escapes a transformed Desktop ancestor.
    const root = control.getRootNode();
    const host = root instanceof ShadowRoot ? root : (document.body ?? control);
    if (tooltip.parentNode !== host) host.append(tooltip);
    applyTooltipSurface();
    tooltip.hidden = false;
    if (typeof tooltip.showPopover === "function" && !popoverOpen(tooltip)) {
      try {
        tooltip.showPopover();
      } catch {
        // Keep a normal fixed tip when this document cannot open a popover.
        tooltip.removeAttribute("popover");
      }
    }
    tooltip.style.position = "fixed";
    tooltip.style.inset = "auto";
    tooltip.style.zIndex = "80";
    tooltip.style.margin = "0";
    tooltip.style.height = "auto";
    tooltip.style.overflow = "visible";
    const rect = control.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(280, Math.max(160, window.innerWidth - margin * 2));
    tooltip.style.width = `${width}px`;
    const preferredLeft = Math.min(
      Math.max(margin, rect.right - width),
      window.innerWidth - width - margin,
    );
    const height = tooltip.offsetHeight;
    const below = rect.bottom + 8;
    const preferredTop =
      below + height <= window.innerHeight - margin
        ? below
        : Math.max(margin, rect.top - height - 8);
    tooltip.style.left = `${preferredLeft}px`;
    tooltip.style.top = `${preferredTop}px`;
    const placed = tooltip.getBoundingClientRect();
    const shiftX = preferredLeft - placed.left;
    const shiftY = preferredTop - placed.top;
    if (Math.abs(shiftX) > 0.5 || Math.abs(shiftY) > 0.5) {
      tooltip.style.left = `${preferredLeft + shiftX}px`;
      tooltip.style.top = `${preferredTop + shiftY}px`;
    }
  };
  const hideTooltip = (): void => {
    if (typeof tooltip.hidePopover === "function" && popoverOpen(tooltip)) {
      try {
        tooltip.hidePopover();
      } catch {
        // Already closed, or popover is unavailable.
      }
    }
    tooltip.hidden = true;
  };
  control.addEventListener("mouseenter", showTooltip);
  control.addEventListener("mouseleave", hideTooltip);
  control.addEventListener("focusin", showTooltip);
  control.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && control.contains(next)) return;
    hideTooltip();
  });
  let generation = 0;
  input.addEventListener("change", () => {
    const next = input.checked;
    generation += 1;
    const request = generation;
    input.disabled = true;
    input.setAttribute("aria-checked", String(next));
    void actions.set(next).then(
      (result) => {
        if (request !== generation) return;
        input.checked = result.enabled;
        input.setAttribute("aria-checked", String(result.enabled));
        input.disabled = false;
      },
      () => {
        if (request !== generation) return;
        input.checked = !next;
        input.setAttribute("aria-checked", String(!next));
        input.disabled = false;
      },
    );
  });
  void actions.get().then(
    (result) => {
      if (generation !== 0) return;
      input.checked = result.enabled;
      input.setAttribute("aria-checked", String(result.enabled));
    },
    () => undefined,
  );
  label.append(text, input);
  control.append(label, tooltip);
  return control;
}
