import type { IconNode } from "lucide";
import createElement from "lucide/dist/esm/createElement.mjs";
import Boxes from "lucide/dist/esm/icons/boxes.mjs";
import Check from "lucide/dist/esm/icons/circle-check.mjs";
import CheckTick from "lucide/dist/esm/icons/check.mjs";
import ChevronDown from "lucide/dist/esm/icons/chevron-down.mjs";
import ChevronLeft from "lucide/dist/esm/icons/chevron-left.mjs";
import ChevronRight from "lucide/dist/esm/icons/chevron-right.mjs";
import ChevronUp from "lucide/dist/esm/icons/chevron-up.mjs";
import CircleArrowUp from "lucide/dist/esm/icons/circle-arrow-up.mjs";
import CircleOff from "lucide/dist/esm/icons/circle-off.mjs";
import Copy from "lucide/dist/esm/icons/copy.mjs";
import Ellipsis from "lucide/dist/esm/icons/ellipsis.mjs";
import Download from "lucide/dist/esm/icons/download.mjs";
import HardDriveDownload from "lucide/dist/esm/icons/hard-drive-download.mjs";
import ExternalLink from "lucide/dist/esm/icons/external-link.mjs";
import FolderInput from "lucide/dist/esm/icons/folder-input.mjs";
import GripVertical from "lucide/dist/esm/icons/grip-vertical.mjs";
import Info from "lucide/dist/esm/icons/info.mjs";
import Languages from "lucide/dist/esm/icons/languages.mjs";
import Network from "lucide/dist/esm/icons/network.mjs";
import PlugZap from "lucide/dist/esm/icons/plug-zap.mjs";
import Plus from "lucide/dist/esm/icons/plus.mjs";
import Puzzle from "lucide/dist/esm/icons/puzzle.mjs";
import RefreshCw from "lucide/dist/esm/icons/refresh-cw.mjs";
import RotateCcw from "lucide/dist/esm/icons/rotate-ccw.mjs";
import Route from "lucide/dist/esm/icons/route.mjs";
import Settings from "lucide/dist/esm/icons/settings.mjs";
import Stethoscope from "lucide/dist/esm/icons/stethoscope.mjs";
import TriangleAlert from "lucide/dist/esm/icons/triangle-alert.mjs";
import Ticket from "lucide/dist/esm/icons/ticket.mjs";
import Trash from "lucide/dist/esm/icons/trash-2.mjs";
import Terminal from "lucide/dist/esm/icons/terminal.mjs";
import Search from "lucide/dist/esm/icons/search.mjs";
import CircleHelp from "lucide/dist/esm/icons/circle-question-mark.mjs";
import Users from "lucide/dist/esm/icons/users.mjs";
import X from "lucide/dist/esm/icons/x.mjs";
import codexhostBrandIconUrl from "../assets/codexhost-brand-icon.png";

export const RENDERER_SETTINGS_ICON_NAMES = [
  "settings",
  "close",
  "language",
  "connections",
  "plugins",
  "accounts",
  "session-import",
  "add",
  "model-pool",
  "routes",
  "gateway",
  "updates",
  "about",
  "info",
  "external-link",
  "refresh",
  "unavailable",
  "alert",
  "check",
  "tick",
  "diagnose",
  "copy",
  "ellipsis",
  "download",
  "hard-drive-download",
  "chevron-left",
  "chevron-right",
  "chevron-down",
  "chevron-up",
  "grip-vertical",
  "undo",
  "ticket",
  "trash",
  "terminal",
  "search",
  "help",
] as const;

export type RendererSettingsIconName = (typeof RENDERER_SETTINGS_ICON_NAMES)[number];

const iconNodes = {
  settings: Settings,
  close: X,
  language: Languages,
  connections: PlugZap,
  plugins: Puzzle,
  accounts: Users,
  "session-import": FolderInput,
  add: Plus,
  "model-pool": Boxes,
  routes: Route,
  gateway: Network,
  updates: CircleArrowUp,
  about: Info,
  info: Info,
  "external-link": ExternalLink,
  refresh: RefreshCw,
  unavailable: CircleOff,
  alert: TriangleAlert,
  check: Check,
  tick: CheckTick,
  diagnose: Stethoscope,
  copy: Copy,
  ellipsis: Ellipsis,
  download: Download,
  "hard-drive-download": HardDriveDownload,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
  "grip-vertical": GripVertical,
  undo: RotateCcw,
  ticket: Ticket,
  trash: Trash,
  terminal: Terminal,
  search: Search,
  help: CircleHelp,
} satisfies Record<RendererSettingsIconName, IconNode>;

export function isRendererSettingsIconName(value: string): value is RendererSettingsIconName {
  return (RENDERER_SETTINGS_ICON_NAMES as readonly string[]).includes(value);
}

export function createRendererSettingsIcon(name: RendererSettingsIconName, size = 18): SVGElement {
  const icon = createElement(iconNodes[name], {
    width: size,
    height: size,
    "aria-hidden": "true",
    focusable: "false",
  });
  icon.classList.add("codexhost-settings-icon");
  return icon;
}

export function createRendererSettingsBrandIcon(size = 22): HTMLImageElement {
  const icon = document.createElement("img");
  icon.src = codexhostBrandIconUrl;
  icon.alt = "";
  icon.width = size;
  icon.height = size;
  icon.draggable = false;
  icon.setAttribute("aria-hidden", "true");
  icon.style.width = `${size}px`;
  icon.style.height = `${size}px`;
  icon.style.objectFit = "contain";
  icon.classList.add("codexhost-settings-icon");
  return icon;
}

// Official GitHub mark (Simple Icons path). Lucide no longer ships brand icons.
const GITHUB_MARK_PATH =
  "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

export function createRendererSettingsGitHubIcon(size = 14): SVGElement {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("width", String(size));
  icon.setAttribute("height", String(size));
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  icon.classList.add("codexhost-settings-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute("d", GITHUB_MARK_PATH);
  icon.append(path);
  return icon;
}
