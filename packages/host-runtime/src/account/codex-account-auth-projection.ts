import type { CodexAccountListResult, CodexAccountSummary } from "@codexhost/shared-contracts";

import type { CodexHomeAuthInspection } from "./codex-home-auth.js";

export const OFFICIAL_API_ACCOUNT_ID = "codex-api";

function officialApiAccount(
  identity: string,
  accountId = OFFICIAL_API_ACCOUNT_ID,
): CodexAccountSummary {
  return {
    accountId,
    label: identity,
    authKind: "api",
    authIdentity: identity,
  };
}

/** Present official-home API auth on the native snapshot without exposing credential paths. */
export function projectCodexAccountAuth(
  snapshot: CodexAccountListResult,
  homeAuth: CodexHomeAuthInspection | undefined,
): CodexAccountListResult {
  if (!homeAuth || homeAuth.kind !== "api") return snapshot;
  const identity = homeAuth.identity;
  if (snapshot.accounts.length === 0 || snapshot.currentAccountId === null) {
    const apiAccount = officialApiAccount(
      identity,
      snapshot.currentAccountId ?? OFFICIAL_API_ACCOUNT_ID,
    );
    return {
      ...snapshot,
      currentAccountId: apiAccount.accountId,
      accounts: [apiAccount],
    };
  }
  return {
    ...snapshot,
    accounts: snapshot.accounts.map((account) =>
      account.accountId === snapshot.currentAccountId
        ? {
            ...account,
            authKind: "api" as const,
            authIdentity: identity,
            ...(account.email ? {} : { label: identity }),
          }
        : account,
    ),
  };
}
