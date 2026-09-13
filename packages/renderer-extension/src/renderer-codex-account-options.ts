import type { CodexAccountSummary } from "@codexhost/shared-contracts";

import type { RendererSettingsMessages } from "./settings/localization.js";

export interface CodexAccountDisplayName {
  readonly local: string;
  readonly domain: string | null;
  readonly full: string;
}

export function codexAccountAuthKind(account: CodexAccountSummary): "api" | "chatgpt" {
  return account.authKind === "api" ? "api" : "chatgpt";
}

export function formatCodexAccountAuthLabel(
  account: CodexAccountSummary,
  messages: Pick<
    RendererSettingsMessages,
    "accountAuthApiPrefix" | "accountAuthChatPrefix" | "accountAuthApiIdentityFallback"
  >,
): string {
  if (codexAccountAuthKind(account) === "api") {
    const identity = account.authIdentity?.trim() || messages.accountAuthApiIdentityFallback;
    return `${messages.accountAuthApiPrefix} - ${identity}`;
  }
  const identity = account.email ?? account.authIdentity;
  if (!identity) return `${messages.accountAuthChatPrefix} - ${account.label}`;
  return `${messages.accountAuthChatPrefix} - ${identity}`;
}

export function codexAccountDisplayName(account: CodexAccountSummary): CodexAccountDisplayName {
  const full = account.email ?? account.label;
  const separator = account.email?.lastIndexOf("@") ?? -1;
  if (!account.email || separator <= 0 || separator === account.email.length - 1) {
    return { local: full, domain: null, full };
  }
  return {
    local: account.email.slice(0, separator),
    domain: account.email.slice(separator + 1),
    full,
  };
}
