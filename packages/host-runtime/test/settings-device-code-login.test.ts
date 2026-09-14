import { afterEach, describe, expect, it, vi } from "vitest";
import type { CodexAccountLoginCompleted } from "@codexhost/shared-contracts";
import type { NativeCodexAccounts } from "../src/account/native-codex-accounts.js";
import {
  createNativeAccountTestState,
  credential,
  nativeAccountIds,
  type NativeAccountTestState,
} from "./fixtures/native-account-state.js";

const resources: Array<{ state: NativeAccountTestState; manager?: NativeCodexAccounts }> = [];
afterEach(async () => {
  for (const { state, manager } of resources.splice(0)) {
    await manager?.close();
    await state.close();
  }
  vi.restoreAllMocks();
});
async function fixture() {
  const state = await createNativeAccountTestState();
  const resource: { state: NativeAccountTestState; manager?: NativeCodexAccounts } = { state };
  resources.push(resource);
  await state.seedAccounts({
    current: { accountId: nativeAccountIds.a, credential: credential("a") },
    saved: [{ accountId: nativeAccountIds.b, credential: credential("b") }],
  });
  const manager = await state.initializeManager();
  resource.manager = manager;
  return { state, manager };
}

describe("Settings-only device-code login", () => {
  it("recovers the activation intent of a login staged by an older Host", async () => {
    const { state, manager } = await fixture();
    const stage = await state.store.createStage();
    const candidate = state.store.vault.accounts.find((a) => a.accountId === nativeAccountIds.b);
    if (!candidate) throw new Error("Missing synthetic saved Account");
    await state.store.writeStage({ ...stage, activateOnSuccess: true, candidate });
    await manager.recover();
    expect(manager.currentAccountId()).toBe(nativeAccountIds.b);
    expect(await state.store.readStage()).toBeNull();
    expect(await state.store.readJournal()).toBeNull();
  });

  it.each([
    { phase: "inspection", action: "cancel" },
    { phase: "inspection", action: "close" },
    { phase: "registration", action: "cancel" },
    { phase: "registration", action: "close" },
  ])(
    "settles $action during stage $phase without starting authentication",
    async ({ phase, action }) => {
      const { state, manager } = await fixture();
      const inspected = Promise.withResolvers<undefined>();
      const proceed = Promise.withResolvers<undefined>();
      const pause = async () => {
        inspected.resolve(undefined);
        await proceed.promise;
      };
      if (phase === "inspection") {
        vi.spyOn(state.store, "readStage").mockImplementationOnce(async () => {
          await pause();
          return null;
        });
      } else {
        const createStage = state.store.createStage.bind(state.store);
        vi.spyOn(state.store, "createStage").mockImplementationOnce(async (...args) => {
          const stage = await createStage(...args);
          await pause();
          return stage;
        });
      }
      let started = false;
      const start = manager.startLogin().then(
        () => {
          started = true;
        },
        () => {},
      );
      await inspected.promise;
      const operationId = manager.snapshot().pendingOperation?.operationId;
      if (!operationId) throw new Error("Missing synthetic operation");
      const cancelled =
        action === "close" ? manager.close().then(() => true) : manager.cancelLogin(operationId);
      let settled = false;
      void cancelled.then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);
      proceed.resolve(undefined);
      await start;
      expect(await cancelled).toBe(true);
      expect(started).toBe(false);
      expect(
        state.runtime.controlRequests.some(({ method }) => method === "account/login/start"),
      ).toBe(false);
      expect(state.runtime.starts.every((home) => home === state.store.home)).toBe(true);
      expect(manager.snapshot()).toMatchObject({
        phase: "ready",
        currentAccountId: nativeAccountIds.a,
      });
      expect(await state.store.readStage()).toBeNull();
    },
  );

  it("accepts cancellation from the first published admission snapshot", async () => {
    const { state, manager } = await fixture();
    let cancelled: Promise<boolean> | undefined;
    const unsubscribe = state.runtime.gate.subscribe(() => {
      const pending = manager.snapshot().pendingOperation;
      if (!cancelled && pending?.kind === "login")
        cancelled = manager.cancelLogin(pending.operationId);
    });
    try {
      await expect(manager.startLogin()).rejects.toThrow();
      expect(cancelled).toBeDefined();
      expect(await cancelled).toBe(true);
      expect(manager.snapshot().phase).toBe("ready");
    } finally {
      unsubscribe();
    }
  });

  it("retains early Settings completion without activating an added identity", async () => {
    const { state, manager } = await fixture();
    const completed = new Promise<CodexAccountLoginCompleted>((resolve) =>
      manager.subscribeLogin(resolve),
    );
    const original = state.runtime.controlRequest.bind(state.runtime);
    vi.spyOn(state.runtime, "controlRequest").mockImplementation(async (method, params) => {
      const response = await original(method, params);
      if (method === "account/login/start") {
        const stage = await state.store.readStage();
        if (!stage) throw new Error("Missing synthetic stage");
        expect(stage.activateOnSuccess).toBeUndefined();
        state.files.seed(
          state.store.stageHome(stage),
          "auth.json",
          credential("b", 2).serializeForNativeStore(),
        );
        state.runtime.emit({
          method: "account/login/completed",
          params: { loginId: "native-login", success: true },
        });
      }
      return response;
    });
    const started = await manager.startLogin();
    await expect(completed).resolves.toMatchObject({
      loginId: started.loginId,
      success: true,
      saved: true,
    });
    expect(manager.currentAccountId()).toBe(nativeAccountIds.a);
  });
});
