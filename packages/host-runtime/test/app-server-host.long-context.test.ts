import { describe, expect, it, vi } from "vitest";
import {
  HARNESS_LONG_CONTEXT_GET_METHOD,
  HARNESS_LONG_CONTEXT_SET_METHOD,
} from "@codexhost/shared-contracts";

import { createFixture, requestId, stopFixture, writeRequest } from "./app-server-host-fixture.js";

describe("Host 1M context routing", () => {
  it("reads and saves the preference without starting a Session", async () => {
    const fixture = createFixture();
    const getLongContext = vi.fn(async () => ({ enabled: true }));
    const setLongContext = vi.fn(async (enabled: boolean) => ({ enabled }));
    Object.assign(fixture.adapter, { getLongContext, setLongContext });
    try {
      await fixture.ready;
      writeRequest(fixture.desktopInput, {
        id: 1,
        method: HARNESS_LONG_CONTEXT_GET_METHOD,
        params: { harnessId: "pi" },
      });
      expect(await fixture.collector.waitFor((message) => requestId(message, 1))).toMatchObject({
        result: { enabled: true },
      });
      writeRequest(fixture.desktopInput, {
        id: 2,
        method: HARNESS_LONG_CONTEXT_SET_METHOD,
        params: { harnessId: "pi", enabled: false },
      });
      expect(await fixture.collector.waitFor((message) => requestId(message, 2))).toMatchObject({
        result: { enabled: false },
      });
      expect(setLongContext).toHaveBeenCalledWith(false);
      expect(fixture.adapter.sessions).toHaveLength(0);
    } finally {
      await stopFixture(fixture);
    }
  });

  it("rejects a missing capability and hides native errors", async () => {
    const fixture = createFixture();
    try {
      await fixture.ready;
      const send = async (id: number, method: string, params: unknown) => {
        writeRequest(fixture.desktopInput, { id, method, params });
        return fixture.collector.waitFor((message) => requestId(message, id));
      };
      expect(await send(1, HARNESS_LONG_CONTEXT_GET_METHOD, { harnessId: "pi" })).toMatchObject({
        error: { code: -32078 },
      });
      expect(
        await send(2, HARNESS_LONG_CONTEXT_SET_METHOD, { harnessId: "pi", enabled: "yes" }),
      ).toMatchObject({ error: { code: -32602 } });
      Object.assign(fixture.adapter, {
        getLongContext: vi.fn(async () => {
          throw new Error("secret-access-token");
        }),
      });
      const failed = await send(3, HARNESS_LONG_CONTEXT_GET_METHOD, { harnessId: "pi" });
      expect(failed).toMatchObject({ error: { code: -32077 } });
      expect(JSON.stringify(failed)).not.toContain("secret-access-token");
    } finally {
      await stopFixture(fixture);
    }
  });
});
