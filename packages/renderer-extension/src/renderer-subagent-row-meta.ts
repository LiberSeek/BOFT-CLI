import {
  createSubagentThreadModelResolver,
  createSubagentThreadStatusResolver,
  readRendererSubagentStatus,
  readRendererSubagentThreadModel,
  type SubagentThreadModel,
  type SubagentThreadModelResolver,
  type SubagentThreadStatus,
  type SubagentThreadStatusResolver,
} from "./renderer-subagent-thread-model.js";

export const SUBAGENT_ROW_META_ATTRIBUTE = "data-codexhost-subagent-meta";
export const SUBAGENT_ROW_COPY_ATTRIBUTE = "data-codexhost-subagent-copy";
export const SUBAGENT_ITEM_BUTTON_SELECTOR = 'button[data-slot="thread-summary-panel-item-button"]';
export const SUBAGENT_ITEM_LABEL_SELECTOR = '[data-slot="thread-summary-panel-item-label"]';

export interface SubagentRowMeta {
  displayName: string;
  spawnModel?: string;
  model?: string;
  reasoningEffort?: string;
  agentRole?: string;
  status?: string;
  conversationId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDomElement(value: unknown): value is Element {
  return typeof Element !== "undefined" && value instanceof Element;
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
}

/** Parent Composer labels look like "BANK OF TOKEN · Grok 4.5", not a child Model id. */
export function isParentComposerModelLabel(model: string | undefined): boolean {
  const trimmed = model?.trim();
  if (!trimmed) return false;
  const head = trimmed.includes(" · ") ? (trimmed.split(" · ")[0]?.trim() ?? "") : trimmed;
  if (!head) return false;
  if (/^(grok|gpt|o\d|claude|codex)/i.test(head)) return false;
  return trimmed.includes(" · ");
}

function usableModel(value: unknown): string | undefined {
  if (!nonBlank(value) || isParentComposerModelLabel(value)) return undefined;
  return value.trim();
}

export function prettySubagentStatus(status: string | undefined): string | undefined {
  switch (status) {
    case "active":
    case "running":
    case "working":
      return "进行中";
    case "waiting":
    case "pending":
    case "pendingInit":
      return "等待中";
    case "done":
    case "completed":
      return "已完成";
    case "failed":
    case "errored":
      return "失败";
    case "interrupted":
      return "已中断";
    default:
      return undefined;
  }
}

export function prettySubagentEffort(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (lower === "xhigh") return "xHigh";
  if (lower === "ultra") return "超高";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function prettySubagentModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed || isParentComposerModelLabel(trimmed)) return "";
  if (trimmed.includes(" · ")) return trimmed;
  const slash = trimmed.lastIndexOf("/");
  const id = slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
  if (id.toLowerCase().startsWith("grok")) {
    return id
      .replace(/^grok[-_]?/iu, "Grok ")
      .replace(/\s+/gu, " ")
      .trim();
  }
  if (!id.trimStart().toLowerCase().startsWith("gpt")) return trimmed;
  const joiner = /^gpt-\d/iu.test(id.trimStart()) ? " " : "-";
  return id
    .split(/(\s+)/u)
    .map((part) => {
      if (part.trim().length === 0) return part;
      return part
        .split("-")
        .map((token, index) => {
          if (token.toLowerCase() === "gpt") return "GPT";
          if (token.toLowerCase() === "oai") return "OAI";
          if (index > 0 && token.length > 0) {
            return `${token[0]?.toUpperCase() ?? ""}${token.slice(1)}`;
          }
          return token;
        })
        .join(joiner)
        .replace(/^GPT (?=\d)/u, "GPT-");
    })
    .join("");
}

function includesEffort(label: string, effort: string): boolean {
  return new RegExp(`(?:^|·\\s*)${effort.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`, "iu").test(
    label,
  );
}

export function formatSubagentRowMeta(row: SubagentRowMeta): string | undefined {
  const raw = usableModel(row.spawnModel) ?? usableModel(row.model) ?? "";
  const model = raw ? prettySubagentModel(raw) : "";
  const effort = prettySubagentEffort(row.reasoningEffort);
  const modelLine =
    model && effort && !includesEffort(model, effort) ? `${model} · ${effort}` : model || effort;
  const parts = [prettySubagentStatus(row.status), modelLine].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function contribute(
  target: Partial<SubagentRowMeta>,
  source: Record<string, unknown>,
  allowUnscopedModel = false,
): void {
  const sourceId = nonBlank(source.conversationId)
    ? source.conversationId.trim()
    : Array.isArray(source.receiverThreadIds) && nonBlank(source.receiverThreadIds[0])
      ? source.receiverThreadIds[0].trim()
      : undefined;
  if (target.conversationId && sourceId && sourceId !== target.conversationId) return;
  if (nonBlank(source.displayName) && !target.displayName) {
    target.displayName = source.displayName.trim();
  }
  if (sourceId && !target.conversationId) target.conversationId = sourceId;
  const childModelSource =
    allowUnscopedModel ||
    source.type === "collabAgentToolCall" ||
    (target.conversationId && nonBlank(source.id) && source.id.trim() === target.conversationId);
  if (childModelSource) {
    const spawn = usableModel(source.spawnModel);
    const model =
      usableModel(source.model) ??
      usableModel(source.modelLabel) ??
      usableModel(source.latestModel);
    if (spawn && !target.spawnModel) target.spawnModel = spawn;
    if (model && !usableModel(target.model)) target.model = model;
    if (nonBlank(source.reasoningEffort) && !target.reasoningEffort) {
      target.reasoningEffort = source.reasoningEffort.trim();
    }
    if (nonBlank(source.latestReasoningEffort) && !target.reasoningEffort) {
      target.reasoningEffort = source.latestReasoningEffort.trim();
    }
  }
  if (nonBlank(source.agentRole) && !target.agentRole) {
    target.agentRole = source.agentRole.trim();
  }
  if (nonBlank(source.status) && !target.status) {
    target.status = source.status.trim();
  }
  if (isRecord(source.agentState) && nonBlank(source.agentState.status) && !target.status) {
    target.status = source.agentState.status.trim();
  }
  if (isRecord(source.agentsStates) && target.conversationId) {
    const state = source.agentsStates[target.conversationId];
    if (isRecord(state) && nonBlank(state.status) && !target.status) {
      target.status = state.status.trim();
    }
  }
}

function collabMatches(item: Record<string, unknown>, conversationId: string | undefined): boolean {
  if (item.type !== "collabAgentToolCall" || item.tool !== "spawnAgent") return false;
  if (!conversationId) return true;
  if (Array.isArray(item.receiverThreadIds) && item.receiverThreadIds.includes(conversationId)) {
    return true;
  }
  return isRecord(item.agentsStates) && conversationId in item.agentsStates;
}

function harvestFromValue(value: unknown, target: Partial<SubagentRowMeta>): void {
  if (!isRecord(value)) return;
  contribute(target, value);
  const nested = [
    isRecord(value.row) ? value.row : null,
    isRecord(value.backgroundAgent) ? value.backgroundAgent : null,
    isRecord(value.item) ? value.item : null,
    isRecord(value.item) && isRecord(value.item.backgroundAgent)
      ? value.item.backgroundAgent
      : null,
    isRecord(value.thread) &&
    (!target.conversationId ||
      (nonBlank(value.thread.id) && value.thread.id.trim() === target.conversationId))
      ? value.thread
      : null,
    isRecord(value.childConversation) ? value.childConversation : null,
  ];
  for (const source of nested) {
    if (source) contribute(target, source);
  }
  if (!target.conversationId) return;
  const items = Array.isArray(value.items)
    ? value.items
    : Array.isArray(value.turns)
      ? value.turns.flatMap((turn) =>
          isRecord(turn) && Array.isArray(turn.items) ? turn.items : [],
        )
      : [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    if (collabMatches(item, target.conversationId)) contribute(target, item, true);
  }
}

function finalizeRow(target: Partial<SubagentRowMeta>): SubagentRowMeta | null {
  if (!nonBlank(target.displayName)) return null;
  if (
    !nonBlank(target.conversationId) &&
    !nonBlank(target.spawnModel) &&
    !nonBlank(target.model) &&
    !nonBlank(target.status)
  ) {
    return null;
  }
  const spawnModel = usableModel(target.spawnModel);
  const model = usableModel(target.model);
  return {
    displayName: target.displayName.trim(),
    ...(spawnModel ? { spawnModel } : {}),
    ...(model ? { model } : {}),
    ...(nonBlank(target.reasoningEffort) ? { reasoningEffort: target.reasoningEffort.trim() } : {}),
    ...(nonBlank(target.agentRole) ? { agentRole: target.agentRole.trim() } : {}),
    ...(nonBlank(target.status) ? { status: target.status.trim() } : {}),
    ...(nonBlank(target.conversationId) ? { conversationId: target.conversationId.trim() } : {}),
  };
}

export function withResolvedThreadModel(
  row: SubagentRowMeta,
  thread: SubagentThreadModel,
): SubagentRowMeta {
  const spawn = usableModel(row.spawnModel);
  const model = spawn ?? usableModel(row.model) ?? usableModel(thread.model);
  const reasoningEffort =
    row.reasoningEffort ??
    (nonBlank(thread.reasoningEffort) ? thread.reasoningEffort.trim() : undefined);
  return {
    displayName: row.displayName,
    ...(row.conversationId ? { conversationId: row.conversationId } : {}),
    ...(row.status ? { status: row.status } : {}),
    ...(row.agentRole ? { agentRole: row.agentRole } : {}),
    ...(spawn ? { spawnModel: spawn } : {}),
    ...(model ? { model } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
  };
}

export function withResolvedThreadStatus(
  row: SubagentRowMeta,
  status: SubagentThreadStatus,
): SubagentRowMeta {
  return { ...row, status };
}

function resolveSubagentRow(
  row: SubagentRowMeta,
  modelResolver?: SubagentThreadModelResolver,
  statusResolver?: SubagentThreadStatusResolver,
): SubagentRowMeta {
  if (!row.conversationId) return row;
  const resolvedStatus = statusResolver?.get(row.conversationId);
  let enriched = resolvedStatus ? withResolvedThreadStatus(row, resolvedStatus) : row;
  const visibleStatus = prettySubagentStatus(enriched.status);
  if (!visibleStatus || visibleStatus === "进行中" || visibleStatus === "等待中") {
    statusResolver?.ensure(row.conversationId);
  }
  const resolvedModel = modelResolver?.get(row.conversationId);
  if (resolvedModel) enriched = withResolvedThreadModel(enriched, resolvedModel);
  const currentModel = usableModel(enriched.spawnModel) ?? usableModel(enriched.model);
  const modelIncludesEffort = Boolean(currentModel?.includes(" · "));
  if (!currentModel || (!enriched.reasoningEffort && !modelIncludesEffort)) {
    modelResolver?.ensure(row.conversationId);
  }
  return enriched;
}

export function subagentRowMetaFromProps(value: unknown): SubagentRowMeta | null {
  const target: Partial<SubagentRowMeta> = {};
  harvestFromValue(value, target);
  return finalizeRow(target);
}

function fiberFromElement(element: HTMLElement): Record<string, unknown> | null {
  const names = Object.getOwnPropertyNames(element).filter((name) =>
    name.startsWith("__reactFiber$"),
  );
  const name = names[0];
  if (!name) return null;
  const fiber =
    Object.getOwnPropertyDescriptor(element, name)?.value ??
    (element as unknown as Record<string, unknown>)[name];
  return isRecord(fiber) ? fiber : null;
}

function metaFromFiberProps(fiber: Record<string, unknown> | null): SubagentRowMeta | null {
  if (!fiber) return null;
  return (
    subagentRowMetaFromProps(fiber.memoizedProps) ?? subagentRowMetaFromProps(fiber.pendingProps)
  );
}

function mergeRow(
  base: SubagentRowMeta | null,
  next: SubagentRowMeta | null,
): SubagentRowMeta | null {
  if (!base) return next;
  if (!next) return base;
  if (base.conversationId && next.conversationId && base.conversationId !== next.conversationId) {
    return base;
  }
  const spawnModel = usableModel(base.spawnModel) ?? usableModel(next.spawnModel);
  const model = usableModel(base.model) ?? usableModel(next.model);
  const reasoningEffort = base.reasoningEffort ?? next.reasoningEffort;
  const agentRole = base.agentRole ?? next.agentRole;
  const status = base.status ?? next.status;
  const conversationId = base.conversationId ?? next.conversationId;
  return {
    displayName: base.displayName || next.displayName,
    ...(spawnModel ? { spawnModel } : {}),
    ...(model ? { model } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
    ...(agentRole ? { agentRole } : {}),
    ...(status ? { status } : {}),
    ...(conversationId ? { conversationId } : {}),
  };
}

function metaFromDescendants(start: Record<string, unknown> | null): SubagentRowMeta | null {
  if (!start || !isRecord(start.child)) return null;
  const stack: Array<Record<string, unknown>> = [start.child];
  const seen = new Set<Record<string, unknown>>();
  let found: SubagentRowMeta | null = null;
  let steps = 0;
  while (stack.length > 0 && steps < 40) {
    const fiber = stack.pop();
    if (!fiber || seen.has(fiber)) continue;
    seen.add(fiber);
    steps += 1;
    found = mergeRow(found, metaFromFiberProps(fiber));
    if (isRecord(fiber.child)) stack.push(fiber.child);
    if (isRecord(fiber.sibling)) stack.push(fiber.sibling);
  }
  return found;
}

export function subagentRowMetaFromElement(element: HTMLElement): SubagentRowMeta | null {
  let fiber = fiberFromElement(element);
  let found = metaFromDescendants(fiber);
  for (let depth = 0; fiber && depth < 12; depth += 1) {
    found = mergeRow(found, metaFromFiberProps(fiber));
    fiber = isRecord(fiber.return) ? fiber.return : null;
  }
  return found;
}

function findNameNode(element: HTMLElement): HTMLElement | null {
  const label = element.querySelector<HTMLElement>(SUBAGENT_ITEM_LABEL_SELECTOR);
  return label ?? element;
}

function createMetaNode(ownerDocument: Document): HTMLElement {
  const meta = ownerDocument.createElement("span");
  meta.setAttribute(SUBAGENT_ROW_META_ATTRIBUTE, "true");
  meta.style.display = "block";
  meta.style.maxWidth = "100%";
  meta.style.fontSize = "11px";
  meta.style.lineHeight = "1.35";
  meta.style.color = "var(--text-tertiary, #8a8a8a)";
  meta.style.whiteSpace = "normal";
  return meta;
}

function ensureColumnCopy(nameNode: HTMLElement): { copy: HTMLElement; meta: HTMLElement } {
  const parent = nameNode.parentElement;
  if (parent?.getAttribute(SUBAGENT_ROW_COPY_ATTRIBUTE) === "true") {
    const existing = parent.querySelector<HTMLElement>(`[${SUBAGENT_ROW_META_ATTRIBUTE}]`);
    if (existing) return { copy: parent, meta: existing };
    const meta = createMetaNode(nameNode.ownerDocument);
    parent.append(meta);
    return { copy: parent, meta };
  }
  const copy = nameNode.ownerDocument.createElement("span");
  copy.setAttribute(SUBAGENT_ROW_COPY_ATTRIBUTE, "true");
  copy.style.display = "flex";
  copy.style.flexDirection = "column";
  copy.style.alignItems = "flex-start";
  copy.style.justifyContent = "center";
  copy.style.minWidth = "0";
  copy.style.flex = "1";
  copy.style.overflow = "hidden";
  nameNode.style.maxWidth = "100%";
  nameNode.style.minWidth = "0";
  nameNode.replaceWith(copy);
  copy.append(nameNode);
  const meta = createMetaNode(nameNode.ownerDocument);
  copy.append(meta);
  return { copy, meta };
}

export function decorateSubagentRow(
  element: HTMLElement,
  resolver?: SubagentThreadModelResolver,
  statusResolver?: SubagentThreadStatusResolver,
): boolean {
  const label = element.querySelector<HTMLElement>(SUBAGENT_ITEM_LABEL_SELECTOR);
  const harvested =
    subagentRowMetaFromElement(element) ?? (label ? subagentRowMetaFromElement(label) : null);
  if (!harvested) return false;
  const row = resolveSubagentRow(harvested, resolver, statusResolver);
  const text = formatSubagentRowMeta(row);
  const nameNode = findNameNode(element);
  if (!nameNode || !text) {
    element.querySelector(`[${SUBAGENT_ROW_META_ATTRIBUTE}]`)?.remove();
    return false;
  }
  const { meta } = ensureColumnCopy(nameNode);
  if (meta.textContent !== text) meta.textContent = text;
  return true;
}

export function decorateSubagentRows(
  root: ParentNode,
  resolver?: SubagentThreadModelResolver,
  statusResolver?: SubagentThreadStatusResolver,
): number {
  if (typeof root.querySelectorAll !== "function") return 0;
  const buttons = root.querySelectorAll(SUBAGENT_ITEM_BUTTON_SELECTOR);
  let decorated = 0;
  for (const element of buttons) {
    if (!isHtmlElement(element)) continue;
    if (decorateSubagentRow(element, resolver, statusResolver)) decorated += 1;
  }
  return decorated;
}

function isOwnMetaMutation(mutations: MutationRecord[]): boolean {
  return mutations.every((mutation) => {
    const nodes = [...mutation.addedNodes, ...mutation.removedNodes, mutation.target];
    return nodes.every((node) => {
      if (!isDomElement(node)) return mutation.type === "characterData";
      return (
        node.getAttribute?.(SUBAGENT_ROW_META_ATTRIBUTE) === "true" ||
        node.getAttribute?.(SUBAGENT_ROW_COPY_ATTRIBUTE) === "true" ||
        Boolean(node.closest?.(`[${SUBAGENT_ROW_META_ATTRIBUTE}]`)) ||
        Boolean(node.closest?.(`[${SUBAGENT_ROW_COPY_ATTRIBUTE}]`))
      );
    });
  });
}

export function installRendererSubagentRowMeta(root?: ParentNode): {
  refresh(): void;
  dispose(): void;
} {
  const owner =
    root ??
    (typeof document !== "undefined" && typeof Element !== "undefined" ? document : undefined);
  if (
    !owner ||
    typeof MutationObserver === "undefined" ||
    typeof Element === "undefined" ||
    typeof document === "undefined"
  ) {
    return { refresh() {}, dispose() {} };
  }
  let disposed = false;
  let scanScheduled = false;
  let mutating = false;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const scan = (): void => {
    scanScheduled = false;
    if (disposed) return;
    mutating = true;
    try {
      decorateSubagentRows(owner, resolver, statusResolver);
    } finally {
      mutating = false;
    }
  };
  const schedule = (): void => {
    if (disposed || mutating || scanScheduled) return;
    scanScheduled = true;
    if (debounce !== undefined) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = undefined;
      scan();
    }, 250);
  };
  const resolver = createSubagentThreadModelResolver({
    read: readRendererSubagentThreadModel,
    onUpdate: schedule,
  });
  const statusResolver = createSubagentThreadStatusResolver({
    read: readRendererSubagentStatus,
    onUpdate: schedule,
  });
  const observer = new MutationObserver((mutations) => {
    if (mutating || isOwnMetaMutation(mutations)) return;
    schedule();
  });
  observer.observe(owner, { childList: true, subtree: true });
  schedule();
  return {
    refresh() {
      resolver.refresh();
      statusResolver.refresh();
      schedule();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (debounce !== undefined) clearTimeout(debounce);
      observer.disconnect();
      resolver.dispose();
      statusResolver.dispose();
      if (isDomElement(owner) || (typeof Document !== "undefined" && owner instanceof Document)) {
        for (const copy of owner.querySelectorAll(`[${SUBAGENT_ROW_COPY_ATTRIBUTE}]`)) {
          const label = copy.querySelector(SUBAGENT_ITEM_LABEL_SELECTOR);
          if (label && copy.parentElement) copy.replaceWith(label);
          else copy.remove();
        }
        for (const meta of owner.querySelectorAll(`[${SUBAGENT_ROW_META_ATTRIBUTE}]`)) {
          meta.remove();
        }
      }
    },
  };
}
