/**
 * Shared surface chrome for Composer popover menus we own
 * (Agent / Model / Permission mode).
 *
 * Neutral gray border, no drop-shadow / blur / translucent token backgrounds.
 * Background tracks the host `color-scheme`: light keeps system `Canvas`,
 * dark uses the solid panel color below.
 */
const STYLE_ATTRIBUTE = "data-codexhost-picker-popover-style";

export const PICKER_POPOVER_CLASS = "codexhost-picker-popover";
export const PICKER_POPOVER_BORDER_LIGHT = "#EFEFEF";
export const PICKER_POPOVER_BORDER_DARK = "#424242";
export const PICKER_POPOVER_BACKGROUND_DARK = "#2D2D2D";
/**
 * Resolves against the host page's `color-scheme` the same way
 * `renderer-usage-control` does — light → `Canvas`, dark → solid panel.
 */
export const PICKER_POPOVER_BACKGROUND = `light-dark(Canvas, ${PICKER_POPOVER_BACKGROUND_DARK})`;
export const PICKER_POPOVER_BORDER = `light-dark(${PICKER_POPOVER_BORDER_LIGHT}, ${PICKER_POPOVER_BORDER_DARK})`;
/** Max practical corner radius for Composer picker menus (~200–280px wide). */
export const PICKER_POPOVER_RADIUS = "24px";

export function ensureRendererPickerPopoverStyle(ownerDocument: Document): void {
  if (ownerDocument.querySelector(`style[${STYLE_ATTRIBUTE}]`)) return;
  const style = ownerDocument.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "true");
  style.textContent = `
    .${PICKER_POPOVER_CLASS} {
      box-sizing: border-box;
      border: 1px solid ${PICKER_POPOVER_BORDER};
      border-radius: ${PICKER_POPOVER_RADIUS};
      background: ${PICKER_POPOVER_BACKGROUND};
      color: CanvasText;
      box-shadow: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
    .${PICKER_POPOVER_CLASS} :is(input, textarea) {
      border: 1px solid ${PICKER_POPOVER_BORDER};
      background: ${PICKER_POPOVER_BACKGROUND};
      color: inherit;
      box-shadow: none;
    }
  `;
  (ownerDocument.head ?? ownerDocument.documentElement).append(style);
}

/** Apply the shared solid popover surface, beating leftover utility classes. */
export function applyRendererPickerPopoverSurface(element: HTMLElement): void {
  ensureRendererPickerPopoverStyle(element.ownerDocument);
  element.classList.add(PICKER_POPOVER_CLASS);
  element.style.border = `1px solid ${PICKER_POPOVER_BORDER}`;
  element.style.borderRadius = PICKER_POPOVER_RADIUS;
  element.style.background = PICKER_POPOVER_BACKGROUND;
  element.style.color = "CanvasText";
  element.style.boxShadow = "none";
  element.style.backdropFilter = "none";
  element.style.setProperty("-webkit-backdrop-filter", "none");
}
