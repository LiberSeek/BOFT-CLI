import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Models that receive the local `[1m]` suffix. Append one entry for a new 1M
 * model, then add the same id to `CLAUDE_LONG_CONTEXT_MODELS` so the switch
 * lists it. Aliases are spellings of the same model and stay off that list.
 */
const MILLION_CONTEXT_MODELS = [{ id: "claude-opus-5-5", aliases: ["claude-opus-5.5"] }] as const;
const MILLION_CONTEXT_MODEL_IDS = new Set<string>(
  MILLION_CONTEXT_MODELS.flatMap((model) => [model.id, ...model.aliases]),
);
const MILLION_CONTEXT_SUFFIX = /\[1m\]$/iu;

export function claudeLongContextFile(environment: NodeJS.ProcessEnv): string {
  const root = environment.CODEXHOST_DATA_DIR
    ? path.resolve(environment.CODEXHOST_DATA_DIR)
    : path.join(os.homedir(), ".codexhost");
  return path.join(root, "claude-code-long-context.json");
}

/** Missing or unreadable settings stay enabled. The switch is the way to turn this off. */
export async function readClaudeLongContext(environment: NodeJS.ProcessEnv): Promise<boolean> {
  try {
    const parsed: unknown = JSON.parse(await readFile(claudeLongContextFile(environment), "utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "enabled" in parsed &&
      typeof parsed.enabled === "boolean"
    ) {
      return parsed.enabled;
    }
  } catch {
    // A missing file is the default-on state. A corrupt file must not silently drop to 200k.
  }
  return true;
}

export async function writeClaudeLongContext(
  environment: NodeJS.ProcessEnv,
  enabled: boolean,
): Promise<boolean> {
  const file = claudeLongContextFile(environment);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify({ enabled })}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
  return enabled;
}

/**
 * Session model passed to Claude CLI. The `[1m]` suffix opens the local 1M
 * window; CLI strips it before the HTTP model field.
 */
export function claudeSessionModel(
  model: string | undefined,
  enabled: boolean,
): string | undefined {
  if (!model) return undefined;
  const bare = model.replace(MILLION_CONTEXT_SUFFIX, "");
  if (!enabled || !MILLION_CONTEXT_MODEL_IDS.has(bare)) return bare;
  return `${bare}[1m]`;
}
