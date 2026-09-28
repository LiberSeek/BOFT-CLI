import { describe, expect, it, vi } from "vitest";

import {
  inspectRendererSettingsContract,
  installRendererSettingsHeaderTrigger,
  mountRendererSettingsTrigger,
} from "../../src/settings/trigger.js";

class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, (event: { stopPropagation(): void }) => void>();
  readonly classList = { add: vi.fn() };
  readonly style: Record<string, string | ((name: string, value: string) => void)> = {};
  readonly nodeType = 1;
  disabled = false;
  isConnected = true;
  parentElement: FakeElement | null = null;
  title = "";
  type = "";
  textContent = "";
  left = 0;
  top = 0;
  width = 40;
  height = 28;
  marginInlineStart = "0px";

  constructor(readonly tagName = "DIV") {
    this.style.setProperty = (name: string, value: string) => {
      this.style[name] = value;
    };
  }

  get firstElementChild(): FakeElement | null {
    return this.children[0] ?? null;
  }
  get nextSibling(): FakeElement | null {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return this.parentElement.children[index + 1] ?? null;
  }
  addEventListener(name: string, listener: (event: { stopPropagation(): void }) => void): void {
    this.listeners.set(name, listener);
  }
  append(...children: FakeElement[]): void {
    for (const child of children) this.insertBefore(child, null);
  }
  dispatch(name: string): void {
    this.listeners.get(name)?.({ stopPropagation: vi.fn() });
  }
  getBoundingClientRect(): DOMRect {
    return {
      left: this.left,
      right: this.left + this.width,
      top: this.top,
      bottom: this.top + this.height,
      width: this.width,
      height: this.height,
    } as DOMRect;
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  insertBefore(child: FakeElement, before: FakeElement | null): FakeElement {
    child.remove();
    child.parentElement = this;
    child.isConnected = true;
    const index = before ? this.children.indexOf(before) : -1;
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }
  matches(selector: string): boolean {
    const match = /^([a-z]*)\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (!match) return false;
    const [, tag, name, value] = match;
    if (tag && tag.toUpperCase() !== this.tagName) return false;
    return (
      name !== undefined &&
      this.attributes.has(name) &&
      (value === undefined || this.attributes.get(name) === value)
    );
  }
  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  querySelectorAll(selector: string): FakeElement[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  remove(): void {
    if (this.parentElement) {
      const index = this.parentElement.children.indexOf(this);
      if (index >= 0) this.parentElement.children.splice(index, 1);
    }
    this.parentElement = null;
    this.isConnected = false;
  }
  removeEventListener(name: string): void {
    this.listeners.delete(name);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  toggleAttribute(name: string, force: boolean): void {
    if (force) this.attributes.set(name, "");
    else this.attributes.delete(name);
  }
}

interface FakeHeader {
  header: FakeElement;
  cluster: FakeElement;
  menu: FakeElement;
  actions: FakeElement;
}

// Header 0–1000. Toolbar title sits on the left; the right cluster uses an auto inline margin.
function createFakeHeader(options: { visible?: boolean; cluster?: boolean } = {}): FakeHeader {
  const header = new FakeElement("HEADER");
  header.setAttribute("data-pip-obstacle", "app-shell-header");
  header.left = 0;
  header.width = 1000;
  header.height = options.visible === false ? 0 : 44;
  const toolbar = new FakeElement();
  toolbar.setAttribute("data-app-shell-header-toolbar", "true");
  toolbar.left = 200;
  toolbar.width = 800;
  toolbar.height = header.height;
  const title = new FakeElement();
  title.left = 210;
  title.width = 120;
  const cluster = new FakeElement();
  cluster.left = 860;
  cluster.width = 80;
  cluster.marginInlineStart = "auto";
  const menu = new FakeElement("BUTTON");
  menu.left = 860;
  menu.width = 28;
  const actions = new FakeElement("BUTTON");
  actions.setAttribute("aria-pressed", "false");
  actions.left = 894;
  actions.width = 28;
  cluster.append(menu, actions);
  toolbar.append(title);
  if (options.cluster !== false) toolbar.append(cluster);
  header.append(toolbar);
  return { header, cluster, menu, actions };
}

function stubHeaderDocument(current: () => FakeElement): Document {
  const matches = (selector: string) => {
    const found: FakeElement[] = [];
    const visit = (element: FakeElement): void => {
      if (element.matches(selector)) found.push(element);
      for (const child of element.children) visit(child);
    };
    visit(current());
    return found;
  };
  const document = {
    createElement: (tag: string) => new FakeElement(tag.toUpperCase()),
    createElementNS: () => new FakeElement("SVG"),
    querySelector: (selector: string) => matches(selector)[0] ?? null,
    querySelectorAll: (selector: string) => matches(selector),
  } as unknown as Document;
  vi.stubGlobal("document", document);
  vi.stubGlobal("getComputedStyle", (element: FakeElement) => ({
    marginInlineStart: element.marginInlineStart,
  }));
  return document;
}

describe("Renderer settings application header trigger", () => {
  it("badges the icon for updates and opens the Updates page directly", () => {
    const document = stubHeaderDocument(() => createFakeHeader().header);
    try {
      const opened = vi.fn();
      const control = mountRendererSettingsTrigger(
        "test",
        true,
        (opener, pageId) => opened(opener, pageId),
        document,
      );
      const button = control.button as unknown as FakeElement;
      const root = control.root as unknown as FakeElement;
      const label = button.children[1];
      const dot = button.children[0]?.children[1];
      const updateButton = control.updateButton as unknown as FakeElement;

      expect(button.style.height).toBe("28px");
      expect(button.children[0]?.children[0]?.tagName).toBe("IMG");
      expect(label?.textContent).toBe("BOFT CLI");
      expect(label?.style.opacity).toBe("0");
      expect(label?.style.maxWidth).toBe("0");
      expect(dot?.style.display).toBe("none");
      expect(dot?.style.background).toBe("#ef4444");
      expect(updateButton.textContent).toBe("Updates");
      expect(updateButton.style.opacity).toBe("0");
      expect(updateButton.style.pointerEvents).toBe("none");
      button.dispatch("click");
      expect(opened).toHaveBeenLastCalledWith(control.button, undefined);

      control.setUpdateAvailable(true);
      expect(dot?.style.display).toBe("block");
      expect(updateButton.style.opacity).toBe("0");
      expect(control.root.hasAttribute("data-update-available")).toBe(true);
      root.dispatch("pointerenter");
      expect(label?.style.opacity).toBe("1");
      expect(updateButton.style.opacity).toBe("1");
      expect(updateButton.style.pointerEvents).toBe("auto");
      updateButton.dispatch("click");
      expect(opened).toHaveBeenLastCalledWith(control.updateButton, "updates");

      control.setUpdateAvailable(false);
      expect(dot?.style.display).toBe("none");
      expect(updateButton.style.opacity).toBe("0");
      control.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("mounts immediately to the right of the summary toggle", () => {
    const shell = createFakeHeader();
    const document = stubHeaderDocument(() => shell.header);
    try {
      const control = installRendererSettingsHeaderTrigger({
        available: true,
        onOpen: vi.fn(),
        ownerDocument: document,
      });

      expect(shell.cluster.children).toEqual([shell.menu, shell.actions, control.root]);
      control.dispose();
      expect(shell.cluster.children).toEqual([shell.menu, shell.actions]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("remounts when Codex replaces the application header", () => {
    const shell = createFakeHeader();
    let current = shell.header;
    const document = stubHeaderDocument(() => current);
    try {
      const control = installRendererSettingsHeaderTrigger({
        available: true,
        onOpen: vi.fn(),
        ownerDocument: document,
      });
      const replacement = createFakeHeader();
      current = replacement.header;

      expect(control.refresh()).toBe(true);
      expect(shell.cluster.children).toEqual([shell.menu, shell.actions]);
      expect(replacement.cluster.children).toEqual([
        replacement.menu,
        replacement.actions,
        control.root,
      ]);
      control.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("stays put when another injected control mounts after the owned trigger", () => {
    const shell = createFakeHeader();
    const document = stubHeaderDocument(() => shell.header);
    try {
      const control = installRendererSettingsHeaderTrigger({
        available: true,
        onOpen: vi.fn(),
        ownerDocument: document,
      });
      const foreign = new FakeElement();
      shell.cluster.append(foreign);

      expect(control.refresh()).toBe(true);
      expect(shell.cluster.children).toEqual([shell.menu, shell.actions, control.root, foreign]);
      control.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("moves back to the right of the summary toggle when a foreign control is inserted between them", () => {
    const shell = createFakeHeader();
    const document = stubHeaderDocument(() => shell.header);
    try {
      const control = installRendererSettingsHeaderTrigger({
        available: true,
        onOpen: vi.fn(),
        ownerDocument: document,
      });
      const foreign = new FakeElement();
      shell.cluster.insertBefore(foreign, control.root as unknown as FakeElement);

      expect(control.refresh()).toBe(true);
      expect(shell.cluster.children).toEqual([shell.menu, shell.actions, control.root, foreign]);
      control.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("unmounts while the header is hidden or has no right-side action cluster", () => {
    for (const options of [{ visible: false }, { cluster: false }]) {
      const shell = createFakeHeader(options);
      const document = stubHeaderDocument(() => shell.header);
      try {
        const control = installRendererSettingsHeaderTrigger({
          available: true,
          onOpen: vi.fn(),
          ownerDocument: document,
        });
        expect(control.refresh()).toBe(false);
        expect(control.root?.isConnected ?? false).toBe(false);
        expect(shell.cluster.children).toEqual([shell.menu, shell.actions]);
        control.dispose();
      } finally {
        vi.unstubAllGlobals();
      }
    }
  });

  it("counts visible headers with a right-side action cluster for the contract audit", () => {
    const visible = createFakeHeader();
    expect(inspectRendererSettingsContract(stubHeaderDocument(() => visible.header))).toEqual({
      headerCount: 1,
      visibleHeaderCount: 1,
      insertionPointCount: 1,
    });
    const hidden = createFakeHeader({ visible: false });
    expect(inspectRendererSettingsContract(stubHeaderDocument(() => hidden.header))).toEqual({
      headerCount: 1,
      visibleHeaderCount: 0,
      insertionPointCount: 0,
    });
    vi.unstubAllGlobals();
  });
});
