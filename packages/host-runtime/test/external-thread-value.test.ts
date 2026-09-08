import type { StoredThreadRecordV1 } from "@codexhost/mapping-store";
import { encodeGrokTransportModel } from "@codexhost/protocol-core";
import {
  harnessIdSchema,
  harnessModelRefSchema,
  harnessPermissionModeIdSchema,
  harnessThinkingOptionIdSchema,
  hostThreadIdSchema,
  nativeSessionRefSchema,
} from "@codexhost/shared-contracts";
import { describe, expect, it } from "vitest";

import { externalThreadValue } from "../src/external-thread-repository.js";

const grokHarnessId = harnessIdSchema.parse("grok");
const parentId = hostThreadIdSchema.parse("parent-thread");
const childId = hostThreadIdSchema.parse("child-thread");

function grokRecord(subagent?: StoredThreadRecordV1["subagent"]): StoredThreadRecordV1 {
  const model = harnessModelRefSchema.parse({ id: "grok-4.6" });
  return {
    formatVersion: 1,
    revision: 1,
    hostThreadId: childId,
    createRequestId: "create-1",
    harnessId: grokHarnessId,
    state: "ready",
    nativeSessionRef: nativeSessionRefSchema.parse({
      harnessId: grokHarnessId,
      nativeSessionId: "native-1",
      formatVersion: 1,
    }),
    cwd: "/workspace",
    title: "List repo root files",
    archived: false,
    transportModelId: encodeGrokTransportModel(
      model,
      harnessPermissionModeIdSchema.parse("ask"),
      harnessThinkingOptionIdSchema.parse("high"),
    ),
    ephemeral: false,
    historyMode: "paginated",
    turnMappings: [],
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
    isPinned: false,
    ...(subagent ? { subagent } : {}),
  };
}

describe("externalThreadValue Subagent Model", () => {
  it("projects child Model and effort from the Grok transport selection", () => {
    const thread = externalThreadValue({
      record: grokRecord({
        parentHostThreadId: parentId,
        nativeSubagentId: "native-child",
        role: "explore",
      }),
      turns: [],
      sessionId: parentId,
    });
    expect(thread).toMatchObject({
      model: "grok-4.6",
      reasoningEffort: "high",
      agentRole: "explore",
    });
  });

  it("does not attach spawn Model fields to an ordinary parent Thread", () => {
    const thread = externalThreadValue({
      record: grokRecord(),
      turns: [],
      sessionId: parentId,
    });
    expect(thread.model).toBeUndefined();
    expect(thread.reasoningEffort).toBeUndefined();
  });
});
