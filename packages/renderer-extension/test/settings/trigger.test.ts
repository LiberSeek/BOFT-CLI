import { describe, expect, it, vi } from "vitest";

import {
  type RendererSettingsBounds,
  installRendererSettingsHeaderTrigger,
  mountRendererSettingsTrigger,
  selectRendererSettingsHeaderSlot,
} from "../../src/settings/trigger.js";

function bounds(left: number, top: number, width: number, height: number): RendererSettingsBounds {
  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
    width,
    height,
  };
}

describe("Renderer settings header trigger", () => {
  const header = bounds(240, 36, 942, 46);

  it("selects the right-side group containing Open Location and the context menu", () => {
    expect(
      selectRendererSettingsHeaderSlot(header, [
        { value: "open-location", bounds: bounds(1018, 45, 128, 28), visibleButtonCount: 1 },
        { value: "actions", bounds: bounds(1018, 36, 164, 46), visibleButtonCount: 2 },
        { value: "context-menu", bounds: bounds(1154, 45, 28, 28), visibleButtonCount: 1 },
      ]),
    ).toBe("actions");
  });

  it("selects the structural action group when a blank thread has no native actions", () => {
    expect(
      selectRendererSettingsHeaderSlot(header, [
        {
          value: "empty-actions",
          bounds: bounds(1176, 59, 0, 0),
          visibleButtonCount: 0,
          structuralActionGroup: true,
        },
      ]),
    ).toBe("empty-actions");
  });

  it("expands an inline clickable Updates action and opens the Updates page directly", () => {
    class FakeElement {
      readonly attributes = new Map<string, string>();
      readonly children: FakeElement[] = [];
      readonly listeners = new Map<string, (event: { stopPropagation(): void }) => void>();
      readonly classList = { add: vi.fn() };
      readonly style: Record<string, string | ((name: string, value: string) => void)> = {};
      disabled = false;
      isConnected = true;
      textContent = "";
      title = "";
      type = "";

      constructor() {
        this.style.setProperty = (name: string, value: string) => {
          this.style[name] = value;
        };
      }

      addEventListener(name: string, listener: (event: { stopPropagation(): void }) => void): void {
        this.listeners.set(name, listener);
      }
      append(...children: FakeElement[]): void {
        this.children.push(...children);
      }
      appendChild(child: FakeElement): FakeElement {
        this.children.push(child);
        return child;
      }
      dispatch(name: string): void {
        this.listeners.get(name)?.({ stopPropagation: vi.fn() });
      }
      hasAttribute(name: string): boolean {
        return this.attributes.has(name);
      }
      matches(): boolean {
        return false;
      }
      remove(): void {
        this.isConnected = false;
      }
      removeEventListener(name: string): void {
        this.listeners.delete(name);
      }
      setAttribute(name: string, value: string): void {
        this.attributes.set(name, value);
      }
      toggleAttribute(name: string, force: boolean): void {
        if (force) this.attributes.set(name, "");
        else this.attributes.delete(name);
      }
    }

    const document = {
      createElement: () => new FakeElement(),
      createElementNS: () => new FakeElement(),
    } as unknown as Document;
    vi.stubGlobal("document", document);
    const opened = vi.fn();
    const control = mountRendererSettingsTrigger(
      "test",
      true,
      (opener, pageId) => opened(opener, pageId),
      document,
    );

    const iconWrap = control.button.children[0] as unknown as FakeElement;
    const brandLabel = control.button.children[1] as unknown as FakeElement;
    const updateDot = iconWrap.children[1] as unknown as FakeElement;

    expect(brandLabel.textContent).toBe("BOFT CLI");
    expect(brandLabel.style.maxWidth).toBe("0");
    expect(control.updateButton.textContent).toBe("Updates");
    expect(control.updateButton.style.maxWidth).toBe("0");
    expect(control.updateButton.style.pointerEvents).toBe("none");
    expect(updateDot.style.display).toBe("none");
    expect(control.root.hasAttribute("data-update-available")).toBe(false);
    expect(control.root.children).toEqual([control.button, control.updateButton]);

    (control.root as unknown as FakeElement).dispatch("pointerenter");
    expect(brandLabel.style.maxWidth).toBe("96px");
    expect(control.updateButton.style.maxWidth).toBe("0");
    (control.root as unknown as FakeElement).dispatch("pointerleave");

    control.setUpdateAvailable(true);
    expect(updateDot.style.display).toBe("block");
    expect(control.root.hasAttribute("data-update-available")).toBe(true);

    (control.root as unknown as FakeElement).dispatch("pointerenter");
    expect(brandLabel.style.maxWidth).toBe("96px");
    expect(brandLabel.style.opacity).toBe("1");
    expect(control.updateButton.style.maxWidth).toBe("64px");
    expect(control.updateButton.style.opacity).toBe("1");
    expect(control.updateButton.style.pointerEvents).toBe("auto");
    expect(control.updateButton.style.color).toBe("#2563eb");

    (control.updateButton as unknown as FakeElement).dispatch("pointerenter");
    expect(control.updateButton.style.color).toBe("#1d4ed8");
    expect(control.updateButton.style.background).toBe("rgba(37, 99, 235, 0.14)");
    (control.updateButton as unknown as FakeElement).dispatch("pointerleave");
    expect(control.updateButton.style.color).toBe("#2563eb");
    expect(control.updateButton.style.background).toBe("transparent");

    (control.updateButton as unknown as FakeElement).dispatch("click");
    expect(opened).toHaveBeenCalledWith(control.updateButton, "updates");

    (control.root as unknown as FakeElement).dispatch("pointerleave");
    expect(brandLabel.style.maxWidth).toBe("0");
    expect(control.updateButton.style.maxWidth).toBe("0");
    expect(control.updateButton.style.pointerEvents).toBe("none");

    control.setUpdateAvailable(false);
    expect(updateDot.style.display).toBe("none");
    expect(control.root.hasAttribute("data-update-available")).toBe(false);
    control.dispose();
    vi.unstubAllGlobals();
  });

  it("mounts directly before the application header end slot without Thread actions", () => {
    class FakeElement {
      readonly attributes = new Map<string, string>();
      readonly children: FakeElement[] = [];
      readonly listeners = new Map<string, (event: { stopPropagation(): void }) => void>();
      readonly classList = { add: vi.fn() };
      readonly style: Record<string, string | ((name: string, value: string) => void)> = {};
      disabled = false;
      isConnected = true;
      parentElement: FakeElement | null = null;
      title = "";
      type = "";

      constructor(readonly left = 0) {
        this.style.setProperty = (name: string, value: string) => {
          this.style[name] = value;
        };
      }

      get firstChild(): FakeElement | null {
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
      appendChild(child: FakeElement): FakeElement {
        return this.insertBefore(child, null);
      }
      getBoundingClientRect(): DOMRect {
        return {
          left: this.left,
          right: this.left + 80,
          top: 0,
          bottom: 46,
          width: 80,
          height: 46,
        } as DOMRect;
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
      querySelectorAll(selector: string): FakeElement[] {
        return selector === ':scope > [data-test-id="header-shell-slot"]'
          ? this.children.filter((child) => child.attributes.has("data-test-id"))
          : [];
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
      setAttribute(name: string, value: string): void {
        this.attributes.set(name, value);
      }
      toggleAttribute(name: string, force: boolean): void {
        if (force) this.attributes.set(name, "");
        else this.attributes.delete(name);
      }
    }

    const header = new FakeElement();
    const startSlot = new FakeElement(0);
    startSlot.setAttribute("data-test-id", "header-shell-slot");
    const content = new FakeElement(240);
    const endSlot = new FakeElement(1120);
    endSlot.setAttribute("data-test-id", "header-shell-slot");
    header.append(startSlot, content, endSlot);
    let currentHeader = header;
    const document = {
      createElement: () => new FakeElement(),
      createElementNS: () => new FakeElement(),
      querySelector: (selector: string) =>
        selector === 'header[data-pip-obstacle="app-shell-header"]' ? currentHeader : null,
      querySelectorAll: () => [],
    } as unknown as Document;
    vi.stubGlobal("document", document);

    try {
      const control = installRendererSettingsHeaderTrigger({
        available: true,
        onOpen: vi.fn(),
        ownerDocument: document,
      });

      expect(control.root).not.toBeNull();
      expect(header.children).toEqual([startSlot, content, control.root, endSlot]);

      const replacementHeader = new FakeElement();
      const replacementStartSlot = new FakeElement(0);
      replacementStartSlot.setAttribute("data-test-id", "header-shell-slot");
      const replacementContent = new FakeElement(240);
      const replacementEndSlot = new FakeElement(1120);
      replacementEndSlot.setAttribute("data-test-id", "header-shell-slot");
      replacementHeader.append(replacementStartSlot, replacementContent, replacementEndSlot);
      currentHeader = replacementHeader;

      expect(control.refresh()).toBe(true);
      expect(header.children).toEqual([startSlot, content, endSlot]);
      expect(replacementHeader.children).toEqual([
        replacementStartSlot,
        replacementContent,
        control.root,
        replacementEndSlot,
      ]);
      control.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fails closed without a visible or structural bounded action group", () => {
    expect(
      selectRendererSettingsHeaderSlot(header, [
        { value: "open-location", bounds: bounds(1018, 45, 128, 28), visibleButtonCount: 1 },
        { value: "hidden", bounds: bounds(1018, 36, 164, 46), visibleButtonCount: 0 },
        {
          value: "outside",
          bounds: bounds(1184, 59, 0, 0),
          visibleButtonCount: 0,
          structuralActionGroup: true,
        },
      ]),
    ).toBeNull();
  });
});
