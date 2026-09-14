import { describe, expect, it, vi } from "vitest";

import { OfficialWorkGate } from "../src/codex-runtime/official-work-gate.js";

describe("official work publication", () => {
  it("does not duplicate an initialized publication", () => {
    const gate = new OfficialWorkGate();
    const listener = vi.fn();
    gate.subscribe(listener);
    gate.initialized();
    gate.initialized();
    expect(listener).toHaveBeenCalledOnce();
    expect(gate.revision).toBe(1);
  });

  it("cannot finish a stopping change before an independent writer releases its lease", () => {
    const gate = new OfficialWorkGate();
    gate.initialized();
    const release = gate.admit();
    const recovery = gate.beginStoppingChange();
    expect(gate.busy).toBe(true);
    expect(() => recovery.assertIdle()).toThrow("busy");
    expect(() => recovery.finish("ready")).toThrow("busy");
    release();
    recovery.assertIdle();
    recovery.finish("ready");
    expect(gate.phase).toBe("ready");
  });

  it("does not interrupt an admitted request to recover", () => {
    const gate = new OfficialWorkGate();
    gate.initialized();
    const release = gate.admit();
    gate.unavailable();
    expect(() => gate.beginChange(true)).toThrow("busy");
    release();
    gate.beginChange(true).finish("ready");
  });

  it("keeps the exclusive change lease after native cleanup becomes unavailable", () => {
    const gate = new OfficialWorkGate();
    gate.initialized();
    const change = gate.beginChange();
    gate.unavailable();
    expect(() => gate.beginChange(true)).toThrow("changing");
    expect(() => change.finish("ready")).toThrow("unavailable");
    expect(gate.phase).toBe("unavailable");
  });
});

describe("saved-Account collection admission", () => {
  it("retains native request leases through collection changes and rejects competing changes", () => {
    const gate = new OfficialWorkGate();
    gate.initialized();
    const release = gate.admit();
    expect(() => gate.beginChange()).toThrow("busy");
    expect(() => gate.beginChange(true)).toThrow("busy");
    const change = gate.beginCollectionChange();
    expect(() => gate.admit()).toThrow("changing");
    expect(() => gate.admit("credential-write")).toThrow("changing");
    expect(() => gate.beginCollectionChange()).toThrow("changing");
    expect(() => gate.beginStoppingChange()).toThrow("changing");
    expect(() => change.assertIdle()).toThrow("busy");
    change.finish("ready");
    expect(gate.phase).toBe("ready");
    expect(gate.busy).toBe(true);
    release();
    expect(gate.busy).toBe(false);
  });

  it("requires all independent Host writers to finish before changing the collection", () => {
    const gate = new OfficialWorkGate();
    gate.initialized();
    const first = gate.admit("credential-write");
    const second = gate.admit("credential-write");
    expect(() => gate.beginCollectionChange()).toThrow("busy");
    first();
    first(); // Releases remain idempotent.
    expect(() => gate.beginCollectionChange()).toThrow("busy");
    second();
    gate.beginCollectionChange().finish("ready");
    expect(gate.phase).toBe("ready");
  });

  it("does not weaken stop/replacement's requirement to drain every lease", () => {
    const gate = new OfficialWorkGate();
    gate.initialized();
    const native = gate.admit();
    const writer = gate.admit("credential-write");
    const change = gate.beginStoppingChange();
    native();
    expect(() => change.assertIdle()).toThrow("busy");
    expect(() => change.finish("ready")).toThrow("busy");
    writer();
    change.assertIdle();
    change.finish("ready");
    expect(gate.busy).toBe(false);
  });

  it("cannot use a collection change to bypass unavailable state", () => {
    const gate = new OfficialWorkGate();
    expect(() => gate.beginCollectionChange()).toThrow("unavailable");
    gate.initialized();
    const change = gate.beginCollectionChange();
    gate.unavailable();
    expect(() => change.finish("ready")).toThrow("unavailable");
    change.finish("unavailable");
    expect(gate.phase).toBe("unavailable");
  });
});
