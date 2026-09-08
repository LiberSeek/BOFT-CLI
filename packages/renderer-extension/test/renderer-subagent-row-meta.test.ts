import { describe, expect, it } from "vitest";

import {
  formatSubagentRowMeta,
  installRendererSubagentRowMeta,
  isParentComposerModelLabel,
  prettySubagentModel,
  prettySubagentStatus,
  subagentRowMetaFromProps,
  withResolvedThreadModel,
} from "../src/renderer-subagent-row-meta.js";
import { subagentThreadModelFromReadResult } from "../src/renderer-subagent-thread-model.js";

describe("renderer subagent row meta", () => {
  it("formats status, model, and effort for an existing row", () => {
    expect(prettySubagentStatus("running")).toBe("进行中");
    expect(prettySubagentStatus("completed")).toBe("已完成");
    expect(prettySubagentModel("grok-4.6")).toBe("Grok 4.6");
    expect(
      formatSubagentRowMeta({
        displayName: "Inspect implementation",
        status: "completed",
        model: "grok-4.6",
        reasoningEffort: "high",
      }),
    ).toBe("已完成 · Grok 4.6 · High");
  });

  it("reads collab item model and status from Fiber props", () => {
    expect(
      subagentRowMetaFromProps({
        displayName: "Inspect implementation",
        conversationId: "child-1",
        item: {
          type: "collabAgentToolCall",
          tool: "spawnAgent",
          model: "Grok 4.6",
          reasoningEffort: "high",
          receiverThreadIds: ["child-1"],
          agentsStates: { "child-1": { status: "completed", message: "done" } },
        },
      }),
    ).toEqual({
      displayName: "Inspect implementation",
      conversationId: "child-1",
      model: "Grok 4.6",
      reasoningEffort: "high",
      status: "completed",
    });
  });

  it("ignores the parent Composer brand Model on official rows", () => {
    expect(isParentComposerModelLabel("BANK OF TOKEN · Grok 4.5")).toBe(true);
    expect(isParentComposerModelLabel("Grok 4.6 · High")).toBe(false);
    expect(prettySubagentModel("BANK OF TOKEN · Grok 4.5")).toBe("");
    expect(
      formatSubagentRowMeta({
        displayName: "List repo root files",
        status: "completed",
        model: "BANK OF TOKEN · Grok 4.5",
        reasoningEffort: "high",
      }),
    ).toBe("已完成 · High");
    expect(
      subagentRowMetaFromProps({
        displayName: "List repo root files",
        conversationId: "child-1",
        model: "BANK OF TOKEN · Grok 4.5",
        thread: { id: "parent-thread", model: "BANK OF TOKEN · Grok 4.5" },
        item: {
          type: "collabAgentToolCall",
          tool: "spawnAgent",
          model: "Grok 4.6",
          reasoningEffort: "high",
          receiverThreadIds: ["child-1"],
          agentsStates: { "child-1": { status: "completed", message: "done" } },
        },
      }),
    ).toEqual({
      displayName: "List repo root files",
      conversationId: "child-1",
      model: "Grok 4.6",
      reasoningEffort: "high",
      status: "completed",
    });
    expect(
      formatSubagentRowMeta({
        displayName: "List repo root files",
        status: "completed",
        model: "Grok 4.6",
        reasoningEffort: "high",
      }),
    ).toBe("已完成 · Grok 4.6 · High");
  });

  it("fills missing model from the exact child Thread", () => {
    const row = withResolvedThreadModel(
      { displayName: "Explore", conversationId: "child-1", status: "running" },
      { model: "gpt-5.3-codex", reasoningEffort: "xhigh" },
    );
    expect(row).toMatchObject({
      model: "gpt-5.3-codex",
      reasoningEffort: "xhigh",
    });
    expect(
      withResolvedThreadModel(
        {
          displayName: "Explore",
          conversationId: "child-1",
          status: "completed",
          model: "BANK OF TOKEN · Grok 4.5",
        },
        { model: "Grok 4.6", reasoningEffort: "high" },
      ),
    ).toMatchObject({
      model: "Grok 4.6",
      reasoningEffort: "high",
    });
    expect(
      subagentThreadModelFromReadResult(
        { thread: { id: "child-1", model: "gpt-5.3-codex", reasoningEffort: "xhigh" } },
        "child-1",
      ),
    ).toEqual({ model: "gpt-5.3-codex", reasoningEffort: "xhigh" });
    expect(
      subagentThreadModelFromReadResult(
        { thread: { id: "child-1", model: "grok-4.6", reasoningEffort: "high" } },
        "child-1",
      ),
    ).toEqual({ model: "grok-4.6", reasoningEffort: "high" });
    expect(
      subagentThreadModelFromReadResult(
        {
          thread: {
            id: "child-1",
            latestModel: "BANK OF TOKEN · Grok 4.5",
            model: "grok-4.6",
            reasoningEffort: "high",
          },
        },
        "child-1",
      ),
    ).toEqual({ model: "grok-4.6", reasoningEffort: "high" });
    expect(
      formatSubagentRowMeta({
        displayName: "List repo root files",
        status: "completed",
        agentRole: "explore",
        model: "grok-4.6",
        reasoningEffort: "high",
      }),
    ).toBe("已完成 · Grok 4.6 · High");
    expect(
      formatSubagentRowMeta({
        displayName: "List repo root files",
        status: "completed",
        agentRole: "explore",
      }),
    ).toBe("已完成");
  });

  it("does not scan DOM when Element is unavailable", () => {
    const installed = installRendererSubagentRowMeta();
    installed.refresh();
    installed.dispose();
  });
});
