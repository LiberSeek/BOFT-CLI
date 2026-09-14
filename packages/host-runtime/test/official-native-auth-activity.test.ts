import { describe, expect, it } from "vitest";
import { OfficialNativeAuthActivity } from "../src/codex-runtime/official-native-auth-activity.js";
import { OfficialWorkGate } from "../src/codex-runtime/official-work-gate.js";

function fixture() {
  const gate = new OfficialWorkGate();
  gate.initialized();
  return { gate, activity: new OfficialNativeAuthActivity(gate) };
}
const completed = (loginId: string) => ({
  method: "account/login/completed",
  params: { loginId, success: false },
});

describe("native credential writer observation", () => {
  it("protects a login through native completion but permits ordinary requests", () => {
    const { gate, activity } = fixture();
    const finish = activity.admit("account/login/start", {});
    expect(() => gate.beginStoppingChange()).toThrow("busy");
    finish({ result: { loginId: "native-id" } });
    const done = gate.admit();
    done();
    expect(() => gate.beginStoppingChange()).toThrow("busy");
    activity.observe(completed("other-id"));
    expect(gate.busy).toBe(true);
    activity.observe(completed("native-id"));
    expect(gate.busy).toBe(false);
    gate.beginStoppingChange().finish("ready");
  });

  it.each([false, true])("handles completion before the response (cancel=%s)", (cancel) => {
    const { gate, activity } = fixture();
    const finish = activity.admit("account/login/start", {});
    if (cancel)
      activity.admit("account/login/cancel", { loginId: "early" })({
        result: { status: "canceled" },
      });
    else activity.observe(completed("early"));
    expect(gate.busy).toBe(true);
    finish({ result: { loginId: "early" } });
    expect(gate.busy).toBe(false);
  });

  it("tracks overlapping starts independently and ignores a failed cancellation", () => {
    const { gate, activity } = fixture();
    activity.admit("account/login/start", {})({ result: { loginId: "one" } });
    activity.admit("account/login/start", {})({ result: { loginId: "two" } });
    activity.admit("account/login/cancel", { loginId: "one" })({ error: { code: -1 } });
    expect(gate.busy).toBe(true);
    activity.admit("account/login/cancel", { loginId: "one" })({ result: { status: "canceled" } });
    expect(gate.busy).toBe(true);
    activity.observe(completed("two"));
    expect(gate.busy).toBe(false);
  });

  it.each([undefined, { error: { code: -1 } }, { result: {} }, { result: { loginId: null } }])(
    "releases a start without an asynchronous native login: %j",
    (response) => {
      const { gate, activity } = fixture();
      const finish = activity.admit("account/login/start", {});
      finish(response);
      finish(response);
      expect(gate.busy).toBe(false);
    },
  );

  it("protects logout only while the native request is pending", () => {
    const { gate, activity } = fixture();
    const finish = activity.admit("account/logout", {});
    expect(() => gate.beginStoppingChange()).toThrow("busy");
    finish({ result: {} });
    gate.beginStoppingChange().finish("ready");
  });

  it("releases native login activity on backend exit, ignoring late replies", () => {
    const { gate, activity } = fixture();
    const late = activity.admit("account/login/start", {});
    activity.admit("account/login/start", {})({ result: { loginId: "one" } });
    activity.backendStopped();
    late({ result: { loginId: "retired" } });
    expect(gate.busy).toBe(false);
  });

  it("does not admit native authentication during a Host credential transaction", () => {
    const { gate, activity } = fixture();
    const change = gate.beginStoppingChange();
    expect(() => activity.admit("account/login/start", {})).toThrow("changing");
    expect(() => activity.admit("account/logout", {})).toThrow("changing");
    change.finish("ready");
    expect(gate.busy).toBe(false);
  });
});
