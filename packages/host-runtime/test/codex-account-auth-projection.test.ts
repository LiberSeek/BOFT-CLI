import { describe, expect, it } from "vitest";

import {
  OFFICIAL_API_ACCOUNT_ID,
  projectCodexAccountAuth,
} from "../src/account/codex-account-auth-projection.js";

const snapshot = {
  version: 2 as const,
  currentAccountId: "account-a",
  phase: "ready" as const,
  revision: 1,
  accounts: [{ accountId: "account-a", label: "Account A", email: "a@example.com" }],
};

describe("Codex Account auth projection", () => {
  it("leaves ChatGPT Accounts unchanged when the official home is not API", () => {
    expect(projectCodexAccountAuth(snapshot, { kind: "chatgpt", identity: "" })).toEqual(snapshot);
  });

  it("surfaces a current API Account when the official home is API and the vault is empty", () => {
    expect(
      projectCodexAccountAuth(
        { ...snapshot, currentAccountId: null, accounts: [] },
        { kind: "api", identity: "BANK OF TOKEN" },
      ),
    ).toEqual({
      ...snapshot,
      currentAccountId: OFFICIAL_API_ACCOUNT_ID,
      accounts: [
        {
          accountId: OFFICIAL_API_ACCOUNT_ID,
          label: "BANK OF TOKEN",
          authKind: "api",
          authIdentity: "BANK OF TOKEN",
        },
      ],
    });
  });

  it("annotates the current Account as API without exposing a home path", () => {
    const projected = projectCodexAccountAuth(snapshot, {
      kind: "api",
      identity: "BANK OF TOKEN",
    });
    expect(projected).toMatchObject({
      currentAccountId: "account-a",
      accounts: [
        {
          accountId: "account-a",
          email: "a@example.com",
          authKind: "api",
          authIdentity: "BANK OF TOKEN",
        },
      ],
    });
    expect(JSON.stringify(projected)).not.toContain("codexHome");
  });
});
