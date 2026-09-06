import { createRendererSettingsIcon, type RendererSettingsIconName } from "./settings/icons.js";

export const PICKER_CHROME_ICON_SIZE_PX = 18;
export const PICKER_TRAILING_SLOT_PX = 24;
export const PICKER_TRAILING_INSET_PX = 8;
export const PICKER_ROW_PADDING = `0 ${PICKER_TRAILING_INSET_PX + PICKER_TRAILING_SLOT_PX + 2}px 0 8px`;

export function applyPickerTrailingSlot(element: HTMLElement): void {
  element.style.position = "absolute";
  element.style.top = "50%";
  element.style.right = `${PICKER_TRAILING_INSET_PX}px`;
  element.style.transform = "translateY(-50%)";
  element.style.display = "inline-flex";
  element.style.alignItems = "center";
  element.style.justifyContent = "center";
  element.style.width = `${PICKER_TRAILING_SLOT_PX}px`;
  element.style.height = `${PICKER_TRAILING_SLOT_PX}px`;
  element.style.flex = "none";
  element.style.padding = "0";
  element.style.boxSizing = "border-box";
  element.style.lineHeight = "0";
}

export function applyPickerChromeIconHost(
  element: HTMLElement,
  size = PICKER_TRAILING_SLOT_PX,
): void {
  element.style.display = "inline-flex";
  element.style.alignItems = "center";
  element.style.justifyContent = "center";
  element.style.width = `${size}px`;
  element.style.height = `${size}px`;
  element.style.flex = "none";
  element.style.lineHeight = "0";
}

export function createPickerChromeIcon(name: RendererSettingsIconName): SVGElement {
  const icon = createRendererSettingsIcon(name, PICKER_CHROME_ICON_SIZE_PX);
  icon.style.display = "block";
  icon.style.flex = "none";
  return icon;
}
