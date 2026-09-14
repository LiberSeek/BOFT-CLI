import { afterEach, describe, expect, it, vi } from "vitest";
import type { JsonObject } from "@codexhost/protocol-core";
import { UnavailableCodexAccounts } from "../src/account/codex-account-control.js";
import { OfficialWorkGate } from "../src/codex-runtime/official-work-gate.js";
import { NativeAccountObserver } from "../src/native-account-observer.js";

const observers = new Set<NativeAccountObserver>();
afterEach(() => {
  for (const observer of observers) observer.close();
  observers.clear();
});
function fixture() {
  const gate = new OfficialWorkGate();
  gate.initialized();
  const controlRequest = vi.fn<(method: string, params: JsonObject) => Promise<JsonObject>>(
    async () => ({
      result: { account: { type: "chatgpt", planType: "pro" } },
    }),
  );
  const scope = { gate, closed: false, owner: { generation: 1, running: true, controlRequest } };
  const snapshot = new UnavailableCodexAccounts().snapshot();
  const refresh = vi.fn(async () => snapshot);
  const notify = vi.fn<(method: string, params: JsonObject) => Promise<void>>(async () => {});
  const diagnose = vi.fn();
  const observer = new NativeAccountObserver({ scope, control: { refresh }, notify, diagnose });
  observers.add(observer);
  return { observer, scope, refresh, snapshot, controlRequest, notify, diagnose };
}

describe("native Account observation", () => {
  it("announces only a ready replacement backend, never Settings staging", async () => {
    const f = fixture();
    f.observer.initialized(1);
    expect(f.controlRequest).not.toHaveBeenCalled();
    const change = f.scope.gate.beginChange();
    f.scope.owner.generation = 2;
    f.observer.initialized(undefined);
    await Promise.resolve();
    expect(f.notify).not.toHaveBeenCalled();
    f.scope.owner.generation = 3;
    change.finish("ready");
    await vi.waitFor(() => expect(f.notify).toHaveBeenCalledOnce());
    expect(f.controlRequest).toHaveBeenCalledWith("account/read", { refreshToken: false });
    expect(f.notify).toHaveBeenCalledWith("account/updated", {
      authMode: "chatgpt",
      planType: "pro",
    });
    const metadata = f.scope.gate.beginCollectionChange();
    metadata.finish("ready");
    await Promise.resolve();
    expect(f.controlRequest).toHaveBeenCalledOnce();
  });

  it("discards a retired generation without blocking another switch", async () => {
    const f = fixture();
    const old = Promise.withResolvers<JsonObject>();
    f.controlRequest.mockImplementationOnce(() => old.promise);
    f.observer.initialized(undefined);
    await vi.waitFor(() => expect(f.controlRequest).toHaveBeenCalledOnce());
    expect(f.scope.gate.busy).toBe(false);
    const change = f.scope.gate.beginStoppingChange();
    f.scope.owner.generation = 2;
    change.finish("ready");
    old.resolve({ result: { account: null } });
    await vi.waitFor(() => expect(f.notify).toHaveBeenCalledOnce());
    expect(f.controlRequest).toHaveBeenCalledTimes(2);
    expect(f.notify).toHaveBeenCalledWith("account/updated", {
      authMode: "chatgpt",
      planType: "pro",
    });
  });

  it("publishes signed-out state after an explicit Host credential change", async () => {
    const f = fixture();
    f.controlRequest.mockResolvedValue({ result: { account: null } });
    f.observer.initialized(undefined);
    await vi.waitFor(() =>
      expect(f.notify).toHaveBeenCalledWith("account/updated", { authMode: null, planType: null }),
    );
  });

  it("isolates notification errors without retries or readiness changes", async () => {
    const f = fixture();
    f.controlRequest.mockResolvedValue({
      error: { code: -1, message: "synthetic private diagnostic" },
    });
    f.observer.initialized(undefined);
    await vi.waitFor(() => expect(f.diagnose).toHaveBeenCalledOnce());
    expect(f.controlRequest).toHaveBeenCalledOnce();
    expect(f.diagnose).toHaveBeenCalledWith();
    expect(f.scope.gate.phase).toBe("ready");
    expect(f.notify).not.toHaveBeenCalled();
  });

  it.each(["account/updated", "account/login/completed"])(
    "collects after %s without generating native authentication events",
    async (method) => {
      const f = fixture();
      f.observer.observe({ method, params: { futureField: true } });
      await vi.waitFor(() =>
        expect(f.notify).toHaveBeenCalledWith("codexhost/account/changed", f.snapshot),
      );
      expect(f.refresh).toHaveBeenCalledOnce();
      expect(f.controlRequest).not.toHaveBeenCalled();
      expect(f.notify).toHaveBeenCalledOnce();
    },
  );

  it("collects again if another native change arrives during backup", async () => {
    const f = fixture();
    const pending = Promise.withResolvers<typeof f.snapshot>();
    f.refresh.mockImplementationOnce(() => pending.promise);
    f.observer.observe({ method: "account/updated" });
    f.observer.observe({ method: "account/updated" });
    pending.resolve(f.snapshot);
    await vi.waitFor(() => expect(f.refresh).toHaveBeenCalledTimes(2));
  });

  it("does not close admission when backup fails; a later observation can retry", async () => {
    const f = fixture();
    f.refresh.mockRejectedValueOnce(new Error("synthetic private backup failure"));
    f.observer.observe({ method: "account/updated" });
    await vi.waitFor(() => expect(f.diagnose).toHaveBeenCalledOnce());
    expect(f.diagnose).toHaveBeenCalledWith();
    expect(f.scope.gate.phase).toBe("ready");
    expect(f.notify).not.toHaveBeenCalled();
    f.observer.observe({ method: "account/updated" });
    await vi.waitFor(() => expect(f.notify).toHaveBeenCalledOnce());
  });

  it("never publishes late native or backup results after closing", async () => {
    const f = fixture();
    const native = Promise.withResolvers<JsonObject>();
    const backup = Promise.withResolvers<typeof f.snapshot>();
    f.controlRequest.mockImplementationOnce(() => native.promise);
    f.refresh.mockImplementationOnce(() => backup.promise);
    f.observer.initialized(undefined);
    f.observer.observe({ method: "account/updated" });
    f.observer.close();
    native.resolve({ result: { account: null } });
    backup.resolve(f.snapshot);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(f.notify).not.toHaveBeenCalled();
    expect(f.scope.gate.phase).toBe("ready");
  });
});
