import assert from "node:assert/strict";
import { afterEach, describe, expect, it } from "vitest";
import type { CodexAccountLoginCompleted } from "@codexhost/shared-contracts";
import { NativeCodexAccounts } from "../src/account/native-codex-accounts.js";
import { nativeDigest } from "../src/account/native-profile-vault.js";
import {
  credential,
  createNativeAccountTestState,
  nativeAccountIds as ids,
  type NativeAccountTestState,
} from "./fixtures/native-account-state.js";

const resources: Array<{ state: NativeAccountTestState; manager?: NativeCodexAccounts }> = [];
afterEach(async () => {
  for (const { state, manager } of resources.splice(0)) {
    await manager?.close();
    await state.close();
  }
});
async function fixture() {
  const state = await createNativeAccountTestState();
  const resource: { state: NativeAccountTestState; manager?: NativeCodexAccounts } = { state };
  resources.push(resource);
  state.files.seed(state.store.home, "auth.json", credential("a").serializeForNativeStore());
  const manager = await state.initializeManager();
  resource.manager = manager;
  return { state, manager };
}
function present<T>(value: T | null | undefined): T {
  assert.ok(value !== null && value !== undefined);
  return value;
}
function persisted(state: NativeAccountTestState) {
  return JSON.parse(present(state.files.peek(state.store.directory, "vault.json")).toString());
}

describe("native credential collection", () => {
  it.each(["a", "b", "new", null])(
    "migrates a v1 selection when official credentials are %s",
    async (actual) => {
      const state = await createNativeAccountTestState();
      const resource: { state: NativeAccountTestState; manager?: NativeCodexAccounts } = { state };
      resources.push(resource);
      await state.seedAccounts({
        current: { accountId: ids.a, credential: credential("a") },
        saved: [{ accountId: ids.b, credential: credential("b") }],
      });
      const legacy = { ...state.store.vault, version: 1, currentAccountId: ids.a };
      present(legacy.accounts.find((a) => a.accountId === ids.a)).payload = null;
      state.files.seed(state.store.directory, "vault.json", JSON.stringify(legacy));
      if (actual)
        state.files.seed(
          state.store.home,
          "auth.json",
          credential(actual, 2).serializeForNativeStore(),
        );
      else {
        const bytes = present(state.files.peek(state.store.home, "auth.json"));
        await state.files.remove(state.store.home, "auth.json", nativeDigest(bytes));
      }
      const nativeBefore = state.files.peek(state.store.home, "auth.json");
      await state.store.close();
      await state.store.open();
      const manager = await state.initializeManager();
      resource.manager = manager;
      const snapshot = manager.snapshot();
      expect(snapshot.phase).toBe("ready");
      expect(snapshot.accounts).toHaveLength(actual === "new" ? 3 : 2);
      const vault = persisted(state);
      expect(vault.version).toBe(2);
      expect(vault).not.toHaveProperty("currentAccountId");
      expect(snapshot.accounts.find((a) => a.accountId === ids.a)?.requiresLogin).toBe(
        actual === "a" ? undefined : true,
      );
      if (actual) {
        const selected = present(
          state.store.vault.accounts.find((a) => a.accountId === snapshot.currentAccountId),
        );
        expect(selected.identity.subject).toBe(actual);
        expect(state.store.restoreCredential(selected).serializeForNativeStore()).toBe(
          credential(actual, 2).serializeForNativeStore(),
        );
      } else expect(snapshot.currentAccountId).toBeNull();
      expect(state.files.peek(state.store.home, "auth.json")).toEqual(nativeBefore);
    },
  );

  it.each(["prepared", "auth-replaced", "vault-committed"])(
    "recovers a v1 %s journal before collecting credentials",
    async (phase) => {
      const state = await createNativeAccountTestState();
      const resource: { state: NativeAccountTestState; manager?: NativeCodexAccounts } = { state };
      resources.push(resource);
      await state.seedAccounts({
        current: { accountId: ids.a, credential: credential("a") },
        saved: [{ accountId: ids.b, credential: credential("b") }],
      });
      const before = { ...state.store.vault, version: 1, currentAccountId: String(ids.a) };
      const source = present(before.accounts.find((a) => a.accountId === ids.a)).payload;
      const target = present(before.accounts.find((a) => a.accountId === ids.b)).payload;
      present(before.accounts.find((a) => a.accountId === ids.a)).payload = null;
      const after = structuredClone(before);
      after.currentAccountId = ids.b;
      after.revision++;
      after.lastOperationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      present(after.accounts.find((a) => a.accountId === ids.a)).payload = source;
      present(after.accounts.find((a) => a.accountId === ids.b)).payload = null;
      const journal = {
        version: 1,
        operationId: after.lastOperationId,
        phase,
        before,
        after,
        source,
        target,
      };
      state.files.seed(
        state.store.directory,
        "vault.json",
        JSON.stringify(phase === "vault-committed" ? after : before),
      );
      state.files.seed(state.store.directory, "transaction.json", JSON.stringify(journal));
      state.files.seed(state.store.home, "auth.json", credential("b").serializeForNativeStore());
      await expect(state.store.captureCurrent()).rejects.toThrow("recovery-required");
      await state.store.close();
      await state.store.open();
      const manager = new NativeCodexAccounts({ store: state.store, runtime: state.runtime });
      resource.manager = manager;
      const collectionBefore = persisted(state);
      // External login is legitimate only outside a pending transaction. An
      // unexplained identity must not erase its evidence or start a writer.
      state.files.seed(
        state.store.home,
        "auth.json",
        credential("outsider").serializeForNativeStore(),
      );
      await expect(manager.initialize()).rejects.toThrow("recovery-required");
      expect(state.runtime.starts).toEqual([]);
      expect(persisted(state)).toEqual(collectionBefore);
      expect(await state.store.readJournal()).not.toBeNull();
      state.files.seed(state.store.home, "auth.json", credential("b").serializeForNativeStore());
      await manager.initialize();
      expect(manager.currentAccountId()).toBe(ids.b);
      expect(manager.snapshot().accounts.every((a) => !a.requiresLogin)).toBe(true);
      expect(await state.store.readJournal()).toBeNull();
      expect(persisted(state)).not.toHaveProperty("currentAccountId");
    },
  );

  it("collects rotated source and target grants after a failed switch rolls back", async () => {
    const { state, manager } = await fixture();
    const a = present(manager.currentAccountId());
    state.files.seed(state.store.home, "auth.json", credential("b").serializeForNativeStore());
    const b = present((await manager.refresh()).currentAccountId);
    await manager.switch(a);
    state.runtime.rotateOnNextStop(state.store.home, credential("a", 2));
    state.runtime.startHook = async (home) => {
      if ((await state.store.readCredentials())?.identity.subject !== "b") return;
      state.runtime.rotateOnNextStop(home, credential("b", 2));
      state.runtime.verifyError = new Error("synthetic target verification failure");
    };
    await expect(manager.switch(b)).rejects.toThrow("switch-failed");
    expect(manager.snapshot().phase).toBe("ready");
    expect(manager.currentAccountId()).toBe(a);
    for (const account of state.store.vault.accounts) {
      expect(state.store.restoreCredential(account).serializeForNativeStore()).toBe(
        credential(account.identity.subject, 2).serializeForNativeStore(),
      );
    }
  });
  it("retains saved login acknowledgement if collecting refreshed credentials loses its write acknowledgement", async () => {
    const { state, manager } = await fixture();
    const a = present(manager.currentAccountId());
    const completed = new Promise<CodexAccountLoginCompleted>((resolve) =>
      manager.subscribeLogin(resolve),
    );
    let permanentStarts = 0;
    state.runtime.startHook = async (home) => {
      if (home !== state.store.home) {
        state.files.seed(home, "auth.json", credential("a", 2).serializeForNativeStore());
        state.runtime.emit({
          method: "account/login/completed",
          params: { loginId: "native-login", success: true },
        });
      } else if (++permanentStarts === 2) {
        state.files.seed(home, "auth.json", credential("a", 3).serializeForNativeStore());
        state.files.failNext({
          operation: "replace",
          phase: "after",
          matches: (_directory, name) => name === "vault.json",
        });
      }
    };
    await manager.startLogin(a);
    expect(await completed).toMatchObject({ success: true, saved: true, cleanupRequired: true });
    const account = present(state.store.vault.accounts.find((account) => account.accountId === a));
    expect(state.store.restoreCredential(account).serializeForNativeStore()).toBe(
      credential("a", 3).serializeForNativeStore(),
    );
    await manager.recover();
    expect(manager.snapshot().phase).toBe("ready");
  });

  it("saves the current credential without persisting a current-account marker", async () => {
    const { state, manager } = await fixture();
    const vault = persisted(state);
    expect(vault.version).toBe(2);
    expect(vault).not.toHaveProperty("currentAccountId");
    expect(vault.accounts).toHaveLength(1);
    expect(vault.accounts[0].payload.nativeDocument).toBe(
      credential("a").serializeForNativeStore(),
    );
    expect(manager.currentAccountId()).toBe(vault.accounts[0].accountId);
  });

  it("collects an external login and token refresh without restarting or overwriting native auth", async () => {
    const { state, manager } = await fixture();
    const starts = state.runtime.starts.length;
    const first = manager.currentAccountId();
    state.files.seed(state.store.home, "auth.json", credential("b").serializeForNativeStore());
    const updated = await manager.refresh();
    expect(updated.phase).toBe("ready");
    expect(updated.accounts).toHaveLength(2);
    expect(updated.currentAccountId).not.toBe(first);
    const second = updated.currentAccountId;
    const rotated = credential("b", 2).serializeForNativeStore();
    state.files.seed(state.store.home, "auth.json", rotated);
    const refreshed = await manager.refresh();
    expect(refreshed.currentAccountId).toBe(second);
    expect(refreshed.accounts).toHaveLength(2);
    expect(state.runtime.starts).toHaveLength(starts);
    expect(state.files.peek(state.store.home, "auth.json")?.toString()).toBe(rotated);
    expect(
      persisted(state).accounts.find((a: { accountId: string }) => a.accountId === second).payload
        .nativeDocument,
    ).toBe(rotated);
  });

  it("accepts external logout, retains saved credentials and never restores login implicitly", async () => {
    const { state, manager } = await fixture();
    const bytes = present(state.files.peek(state.store.home, "auth.json"));
    const oldRevision = manager.snapshot().revision;
    await state.files.remove(state.store.home, "auth.json", nativeDigest(bytes));
    const updated = await manager.refresh();
    expect(updated.currentAccountId).toBeNull();
    expect(updated.accounts).toHaveLength(1);
    expect(updated.revision).toBeGreaterThan(oldRevision);
    expect(persisted(state).accounts[0].payload).not.toBeNull();
    expect(state.files.peek(state.store.home, "auth.json")).toBeNull();
    await manager.recover();
    expect(manager.currentAccountId()).toBeNull();
    expect(state.files.peek(state.store.home, "auth.json")).toBeNull();
  });

  it("uses actual native identity after restart rather than a prior selection", async () => {
    const { state, manager } = await fixture();
    state.files.seed(state.store.home, "auth.json", credential("b").serializeForNativeStore());
    await manager.recover();
    const snapshot = manager.snapshot();
    expect(snapshot.phase).toBe("ready");
    expect(snapshot.accounts).toHaveLength(2);
    expect(snapshot.accounts.find((a) => a.accountId === snapshot.currentAccountId)?.email).toBe(
      credential("b").email,
    );
    expect(persisted(state)).not.toHaveProperty("currentAccountId");
  });

  it("keeps both credential copies through switch and logout", async () => {
    const { state, manager } = await fixture();
    const a = present(manager.currentAccountId());
    state.files.seed(state.store.home, "auth.json", credential("b").serializeForNativeStore());
    const b = present((await manager.refresh()).currentAccountId);
    await manager.switch(a);
    expect(manager.currentAccountId()).toBe(a);
    await manager.switch(b);
    expect(manager.currentAccountId()).toBe(b);
    await manager.logout();
    expect(manager.currentAccountId()).toBeNull();
    expect(persisted(state).accounts.every((a: { payload: unknown }) => a.payload !== null)).toBe(
      true,
    );
    expect(persisted(state)).not.toHaveProperty("currentAccountId");
  });
});
