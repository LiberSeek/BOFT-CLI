import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  claudeLongContextFile,
  claudeSessionModel,
  readClaudeLongContext,
  writeClaudeLongContext,
} from "../src/long-context.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function dataDir(): Promise<NodeJS.ProcessEnv> {
  const directory = await mkdtemp(path.join(tmpdir(), "claude-long-context-"));
  directories.push(directory);
  return { CODEXHOST_DATA_DIR: directory };
}

describe("Claude 1M session model", () => {
  it("suffixes only the Opus 5.5 gateway ids, and only while the switch is on", () => {
    expect(claudeSessionModel("claude-opus-5-5", true)).toBe("claude-opus-5-5[1m]");
    expect(claudeSessionModel("claude-opus-5.5", true)).toBe("claude-opus-5.5[1m]");
    expect(claudeSessionModel("claude-opus-5-5[1M]", true)).toBe("claude-opus-5-5[1m]");
    expect(claudeSessionModel("claude-opus-5-5", false)).toBe("claude-opus-5-5");
    expect(claudeSessionModel("claude-opus-5-5[1m]", false)).toBe("claude-opus-5-5");
    expect(claudeSessionModel("sonnet", true)).toBe("sonnet");
    expect(claudeSessionModel("claude-sonnet-5", true)).toBe("claude-sonnet-5");
    expect(claudeSessionModel("claude-opus-5-5[2m]", true)).toBe("claude-opus-5-5[2m]");
    expect(claudeSessionModel(undefined, true)).toBeUndefined();
  });

  it("stays enabled when the preference file is missing or unreadable", async () => {
    const environment = await dataDir();
    await expect(readClaudeLongContext(environment)).resolves.toBe(true);
    await writeFile(claudeLongContextFile(environment), "{", "utf8");
    await expect(readClaudeLongContext(environment)).resolves.toBe(true);
    await expect(writeClaudeLongContext(environment, false)).resolves.toBe(false);
    await expect(readClaudeLongContext(environment)).resolves.toBe(false);
    expect(JSON.parse(await readFile(claudeLongContextFile(environment), "utf8"))).toEqual({
      enabled: false,
    });
  });
});
