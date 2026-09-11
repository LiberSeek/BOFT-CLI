import type {
  CodexAccountActivateParams,
  CodexAccountCreateParams,
  CodexAccountDeleteParams,
  CodexAccountDeleteResult,
  CodexAccountListResult,
  CodexAccountLoginCancelParams,
  CodexAccountLoginCancelResult,
  CodexAccountLoginCompleted,
  CodexAccountLoginStartParams,
  CodexAccountLoginStartResult,
  CodexAccountMutationResult,
  CodexAccountSummary,
  CodexAccountUsageParams,
  CodexAccountUsageResult,
  CodexAccountResetCreditConsumeParams,
  CodexAccountResetCreditConsumeResult,
} from "@codexhost/shared-contracts";

import { codexAccountAuthKind } from "../renderer-codex-account-options.js";
import {
  accountListFocusRestorer,
  accountPlanLabel,
  createAccountsGroup,
  renderAccountRows,
  renderHarnessAccountRow,
} from "./accounts-list.js";
import { createHarnessAccounts, type RendererHarnessAccountClient } from "./harness-accounts.js";
import { mountAccountResetCountdowns } from "./accounts-reset-time.js";
import type { AccountUsageDisplay, AccountUsageViewState } from "./accounts-usage.js";
import type { RendererSettingsPageDefinition, RendererSettingsPageMountContext } from "./core.js";
import { createRendererSettingsIcon } from "./icons.js";
import type { RendererSettingsMessages } from "./localization.js";

export interface RendererCodexAccountClient extends RendererHarnessAccountClient {
  listCodexAccounts(): Promise<CodexAccountListResult>;
  refreshCodexAccounts?(): Promise<CodexAccountListResult>;
  inspectCodexAccountUsage?(input: CodexAccountUsageParams): Promise<CodexAccountUsageResult>;
  consumeCodexAccountResetCredit?(
    input: CodexAccountResetCreditConsumeParams,
  ): Promise<CodexAccountResetCreditConsumeResult>;
  createCodexAccount(input: CodexAccountCreateParams): Promise<CodexAccountMutationResult>;
  deleteCodexAccount(input: CodexAccountDeleteParams): Promise<CodexAccountDeleteResult>;
  activateCodexAccount(input: CodexAccountActivateParams): Promise<CodexAccountMutationResult>;
  startCodexAccountLogin(
    input: CodexAccountLoginStartParams,
  ): Promise<CodexAccountLoginStartResult>;
  cancelCodexAccountLogin(
    input: CodexAccountLoginCancelParams,
  ): Promise<CodexAccountLoginCancelResult>;
  subscribeCodexAccountLogin?(listener: (result: CodexAccountLoginCompleted) => void): () => void;
}

interface CodexDesktopLinkWindow extends Window {
  electronBridge?: {
    sendMessageFromView(message: unknown): unknown;
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function accountHasUsage(account: CodexAccountSummary): boolean {
  return account.authKind === "api" || Boolean(account.email);
}

export function createAccountsSettingsPage(
  messages: RendererSettingsMessages,
  getClient: () => RendererCodexAccountClient | null,
): RendererSettingsPageDefinition {
  return Object.freeze({
    id: "accounts",
    label: messages.pageLabels.accounts,
    icon: "accounts",
    mount(context: RendererSettingsPageMountContext) {
      const document = context.content.ownerDocument;
      const header = document.createElement("div");
      header.className = "settings-connection-page-header";
      const copy = document.createElement("div");
      const heading = document.createElement("div");
      heading.className = "settings-section-label";
      heading.textContent = messages.pageLabels.accounts;
      const description = document.createElement("p");
      description.className = "settings-page-description";
      description.textContent = messages.accountsDescription;
      copy.append(heading, description);
      const add = document.createElement("button");
      add.type = "button";
      add.className = "settings-command-button settings-command-button--secondary";
      add.append(createRendererSettingsIcon("add", 16), messages.accountAdd);
      header.append(copy, add);

      const status = document.createElement("p");
      status.className = "settings-account-status";
      status.setAttribute("aria-live", "polite");
      const toolbar = document.createElement("div");
      toolbar.className = "settings-account-toolbar";
      const connected = document.createElement("div");
      connected.className = "settings-account-count";
      const connectedLabel = document.createElement("span");
      connectedLabel.textContent = messages.accountConnected;
      const connectedCount = document.createElement("span");
      connected.append(connectedLabel, connectedCount);
      const searchWrapper = document.createElement("label");
      searchWrapper.className = "settings-account-search";
      const search = document.createElement("input");
      search.type = "search";
      search.name = "account-search";
      search.autocomplete = "off";
      search.spellcheck = false;
      search.placeholder = messages.accountSearch;
      search.setAttribute("aria-label", messages.accountSearch);
      searchWrapper.append(createRendererSettingsIcon("search", 16), search);
      const displayControls = document.createElement("div");
      displayControls.className = "settings-segmented";
      displayControls.setAttribute("role", "group");
      const displayButtons = new Map<AccountUsageDisplay, HTMLButtonElement>();
      for (const display of ["used", "remaining"] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "settings-segmented__item";
        button.textContent =
          display === "used" ? messages.accountCreditsUsed : messages.accountCreditsRemaining;
        button.addEventListener("click", () => {
          usageDisplay = display;
          render();
        });
        displayButtons.set(display, button);
        displayControls.append(button);
      }
      const refreshUsage = document.createElement("button");
      refreshUsage.type = "button";
      refreshUsage.className = "settings-icon-button";
      refreshUsage.title = messages.accountCreditsRefresh;
      refreshUsage.setAttribute("aria-label", messages.accountCreditsRefresh);
      refreshUsage.append(createRendererSettingsIcon("refresh", 16));
      refreshUsage.addEventListener("click", () => {
        usageByAccountId.clear();
        loadUsage(accounts);
        void harnessAccounts?.refresh();
      });
      search.addEventListener("input", () => render());
      toolbar.append(connected, searchWrapper, displayControls, refreshUsage);
      const groups = document.createElement("div");
      groups.className = "settings-account-groups";
      const apiGroup = createAccountsGroup(document, messages, "api");
      const chatGroup = createAccountsGroup(document, messages, "chatgpt");
      context.content.append(header, status, toolbar, groups);
      const stopCountdowns = mountAccountResetCountdowns(groups, messages, context.signal);

      let accounts: readonly CodexAccountSummary[] = [];
      let accountCreating = false;
      let accountActivating = false;
      let deletingAccountId: string | null = null;
      let login: CodexAccountLoginStartResult | null = null;
      let loginStartingAccountId: string | null = null;
      let loginMessage: string | null = null;
      let loginRefreshTimer: number | undefined;
      const usageByAccountId = new Map<string, AccountUsageViewState>();
      let usingResetAccountId: string | null = null;
      let usageDisplay: AccountUsageDisplay = "remaining";
      const expandedResetAccounts = new Set<string>();
      // Mutations share runLatest; do not let a second action discard the
      // completion handler of an in-flight login, deletion, or reset.
      const accountBusy = (): boolean =>
        accountCreating ||
        accountActivating ||
        deletingAccountId !== null ||
        login !== null ||
        loginStartingAccountId !== null ||
        usingResetAccountId !== null;

      const clearLoginRefresh = (): void => {
        if (loginRefreshTimer === undefined) return;
        document.defaultView?.clearTimeout(loginRefreshTimer);
        loginRefreshTimer = undefined;
      };

      const scheduleLoginRefresh = (): void => {
        clearLoginRefresh();
        if (!login || context.signal.aborted) return;
        loginRefreshTimer = document.defaultView?.setTimeout(() => {
          loginRefreshTimer = undefined;
          if (!login || context.signal.aborted) return;
          void context.runLatest(
            () => client().refreshCodexAccounts?.() ?? client().listCodexAccounts(),
            {
              success(result) {
                const signedIn = result.accounts.some(
                  (account) => account.accountId === login?.accountId && account.email,
                );
                if (signedIn) {
                  login = null;
                  loginMessage = messages.accountLoginSucceeded;
                }
                setAccounts(result.accounts);
                scheduleLoginRefresh();
              },
              failure() {
                scheduleLoginRefresh();
              },
            },
          );
        }, 750);
      };

      const appendCodexAccount = (body: HTMLElement, account: CodexAccountSummary): void => {
        body.append(
          ...renderAccountRows(document, account, messages, {
            usage: usageByAccountId.get(account.accountId),
            display: usageDisplay,
            actionsDisabled: accountBusy(),
            usingReset: usingResetAccountId === account.accountId,
            resetDisabled: accountBusy(),
            resetExpanded: expandedResetAccounts.has(account.accountId),
            onActivate: () =>
              mutate(() => client().activateCodexAccount({ accountId: account.accountId })),
            onSignIn: () => startLogin(account.accountId),
            onDelete: () => deleteAccount(account.accountId),
            onRetry: () => {
              usageByAccountId.delete(account.accountId);
              loadUsage(accounts);
            },
            onResetExpanded: (open) => {
              if (open) expandedResetAccounts.add(account.accountId);
              else expandedResetAccounts.delete(account.accountId);
            },
            ...(getClient()?.consumeCodexAccountResetCredit
              ? { onUseReset: () => useReset(account.accountId) }
              : {}),
          }),
        );
        if (login?.accountId !== account.accountId) return;
        const verification = document.createElement("div");
        verification.className = "settings-account-verification";
        const prompt = document.createElement("span");
        prompt.textContent = messages.accountVerificationDescription;
        const link = document.createElement("a");
        link.href = login.verificationUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = login.verificationUrl;
        link.addEventListener("click", (event) => {
          const bridge = (document.defaultView as CodexDesktopLinkWindow | null)?.electronBridge;
          if (typeof bridge?.sendMessageFromView !== "function") return;
          event.preventDefault();
          void Promise.resolve(
            bridge.sendMessageFromView({
              type: "open-in-browser",
              url: login?.verificationUrl ?? link.href,
              initiator: "open_in_browser_bridge",
              openTarget: "external-browser",
              source: "manual",
            }),
          ).catch(() => undefined);
        });
        const code = document.createElement("code");
        code.textContent = login.userCode;
        const copyCode = document.createElement("button");
        copyCode.type = "button";
        copyCode.className = "settings-command-button settings-command-button--secondary";
        copyCode.textContent = messages.accountCopyCode;
        copyCode.addEventListener("click", () => {
          void document.defaultView?.navigator.clipboard
            ?.writeText(login?.userCode ?? "")
            .then(() => {
              copyCode.textContent = messages.accountCopied;
            });
        });
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "settings-command-button settings-command-button--secondary";
        cancel.textContent = messages.accountLoginCancel;
        cancel.addEventListener("click", () =>
          cancelLogin(login?.accountId ?? "", login?.loginId ?? ""),
        );
        verification.append(prompt, link, code, copyCode, cancel);
        const verificationRow = document.createElement("tr");
        const verificationCell = document.createElement("td");
        verificationCell.colSpan = codexAccountAuthKind(account) === "api" ? 3 : 4;
        verificationCell.append(verification);
        verificationRow.append(verificationCell);
        body.append(verificationRow);
      };

      const render = (): void => {
        const restoreFocus = accountListFocusRestorer(groups, search);
        apiGroup.body.replaceChildren();
        chatGroup.body.replaceChildren();
        status.textContent = loginMessage ?? "";
        connectedCount.textContent = String(accounts.length + harnessAccounts.accounts.length);
        apiGroup.updateDisplay(usageDisplay);
        chatGroup.updateDisplay(usageDisplay);
        search.disabled = login !== null || loginStartingAccountId !== null;
        for (const [display, button] of displayButtons) {
          const selected = display === usageDisplay;
          button.setAttribute("aria-pressed", String(selected));
          button.className = selected
            ? "settings-segmented__item settings-segmented__item--selected"
            : "settings-segmented__item";
        }
        refreshUsage.disabled =
          ((!getClient()?.inspectCodexAccountUsage ||
            !accounts.some((account) => accountHasUsage(account))) &&
            !getClient()?.listHarnessAccounts) ||
          harnessAccounts?.refreshing === true ||
          [...usageByAccountId.values()].some((usage) => usage.status === "loading") ||
          accountBusy();
        const query = search.value.trim().toLocaleLowerCase();
        const visibleAccounts = accounts.filter((account) =>
          `Codex ${account.email ?? ""} ${account.label} ${account.authIdentity ?? ""} ${account.authKind ?? ""} ${accountPlanLabel(account.planType) ?? ""}`
            .toLocaleLowerCase()
            .includes(query),
        );
        const visibleApi = visibleAccounts.filter(
          (account) => codexAccountAuthKind(account) === "api",
        );
        const visibleChat = visibleAccounts.filter(
          (account) => codexAccountAuthKind(account) !== "api",
        );
        const visibleHarnessAccounts = harnessAccounts.accounts.filter((account) =>
          `${account.harnessName} ${account.email ?? ""} ${account.label ?? ""} ${account.plan ?? ""}`
            .toLocaleLowerCase()
            .includes(query),
        );
        displayControls.hidden =
          !accounts.some((account) => codexAccountAuthKind(account) !== "api") &&
          harnessAccounts.accounts.length === 0;
        add.disabled = accountBusy();
        groups.replaceChildren();
        if (visibleApi.length + visibleChat.length + visibleHarnessAccounts.length === 0) {
          const empty = document.createElement("div");
          empty.className = "settings-account-list";
          const emptyMessage = document.createElement("p");
          emptyMessage.className = "settings-account-empty";
          emptyMessage.textContent = query ? messages.accountNoMatches : messages.accountEmpty;
          empty.append(emptyMessage);
          groups.append(empty);
        } else {
          if (visibleApi.length) {
            for (const account of visibleApi) appendCodexAccount(apiGroup.body, account);
            groups.append(apiGroup.root);
          }
          if (visibleChat.length + visibleHarnessAccounts.length) {
            for (const account of visibleChat) appendCodexAccount(chatGroup.body, account);
            for (const account of visibleHarnessAccounts) {
              chatGroup.body.append(
                renderHarnessAccountRow(document, account, messages, usageDisplay),
              );
            }
            groups.append(chatGroup.root);
          }
        }
        restoreFocus();
      };

      const client = (): RendererCodexAccountClient => {
        const value = getClient();
        if (!value) throw new Error(messages.runtimeCapabilityNotInstalled);
        return value;
      };
      const loadUsage = (nextAccounts: readonly CodexAccountSummary[]): void => {
        const inspect = getClient()?.inspectCodexAccountUsage;
        const signedIn = nextAccounts.filter((account) => accountHasUsage(account));
        const keep = new Set(signedIn.map((account) => account.accountId));
        for (const accountId of [...usageByAccountId.keys()]) {
          if (!keep.has(accountId)) usageByAccountId.delete(accountId);
        }
        const pending = signedIn.filter((account) => !usageByAccountId.has(account.accountId));
        if (!inspect || pending.length === 0) {
          render();
          return;
        }
        const requests = pending.map((account) => {
          const loading: AccountUsageViewState = { status: "loading" };
          usageByAccountId.set(account.accountId, loading);
          return { account, loading };
        });
        render();
        void Promise.all(
          requests.map(async ({ account, loading }) => {
            try {
              const result = await inspect({ accountId: account.accountId });
              if (context.signal.aborted || usageByAccountId.get(account.accountId) !== loading)
                return;
              usageByAccountId.set(
                account.accountId,
                result.accountCredits
                  ? { status: "ready", credits: result.accountCredits }
                  : { status: "empty" },
              );
            } catch {
              if (context.signal.aborted || usageByAccountId.get(account.accountId) !== loading)
                return;
              usageByAccountId.set(account.accountId, { status: "error" });
            }
            render();
          }),
        );
      };
      const setAccounts = (nextAccounts: readonly CodexAccountSummary[]): void => {
        accounts = nextAccounts;
        for (const accountId of expandedResetAccounts) {
          if (!accounts.some((account) => account.accountId === accountId))
            expandedResetAccounts.delete(accountId);
        }
        loadUsage(nextAccounts);
      };
      const refreshInBackground = (): void => {
        if (!client().refreshCodexAccounts) return;
        void context.runLatest(
          () => client().refreshCodexAccounts?.() ?? client().listCodexAccounts(),
          {
            success(result) {
              setAccounts(result.accounts);
            },
            failure() {
              // Keep showing the cached Account list when live metadata refresh fails.
            },
          },
        );
      };
      const load = (): void => {
        void context.runLatest(() => client().listCodexAccounts(), {
          success(result) {
            loginMessage = null;
            setAccounts(result.accounts);
            refreshInBackground();
          },
          failure(error) {
            loginMessage = errorMessage(error, messages.accountLoadFailed);
            render();
          },
        });
      };
      const mutate = (operation: () => Promise<CodexAccountMutationResult>): void => {
        if (accountBusy()) return;
        accountActivating = true;
        render();
        void context.runLatest(() => operation(), {
          success(result) {
            accountActivating = false;
            loginMessage = null;
            setAccounts(
              accounts.map((account) => ({
                ...(account.accountId === result.account.accountId ? result.account : account),
                active: account.accountId === result.account.accountId,
              })),
            );
          },
          failure(error) {
            accountActivating = false;
            loginMessage = errorMessage(error, messages.accountLoadFailed);
            render();
          },
        });
      };
      const startLogin = (accountId: string): void => {
        if (accountBusy()) return;
        loginStartingAccountId = accountId;
        loginMessage = messages.accountSigningIn;
        render();
        void context.runLatest(() => client().startCodexAccountLogin({ accountId }), {
          success(result) {
            loginStartingAccountId = null;
            login = result;
            loginMessage = null;
            render();
            scheduleLoginRefresh();
          },
          failure(error) {
            loginStartingAccountId = null;
            loginMessage = errorMessage(error, messages.accountLoginFailed);
            render();
          },
        });
      };
      const createAndLogin = (): void => {
        if (accountBusy()) return;
        accountCreating = true;
        loginMessage = messages.accountSigningIn;
        render();
        void context.runLatest(() => client().createCodexAccount({}), {
          success(result) {
            accountCreating = false;
            loginMessage = null;
            search.value = "";
            setAccounts([
              ...accounts.filter(({ accountId }) => accountId !== result.account.accountId),
              result.account,
            ]);
            startLogin(result.account.accountId);
          },
          failure(error) {
            accountCreating = false;
            loginMessage = errorMessage(error, messages.accountCreateFailed);
            render();
          },
        });
      };
      const resetOutcomeMessage = (
        outcome: CodexAccountResetCreditConsumeResult["outcome"],
      ): string => {
        if (outcome === "reset") return messages.accountResetCreditsSucceeded;
        if (outcome === "nothingToReset") return messages.accountResetCreditsNothingToReset;
        if (outcome === "noCredit") return messages.accountResetCreditsNoCredit;
        return messages.accountResetCreditsAlreadyRedeemed;
      };
      const useReset = (accountId: string): void => {
        const consume = getClient()?.consumeCodexAccountResetCredit;
        if (!consume || accountBusy()) return;
        if (document.defaultView?.confirm?.(messages.accountResetCreditsConfirm) === false) return;
        usingResetAccountId = accountId;
        loginMessage = messages.accountResetCreditsUsing;
        render();
        void context.runLatest(() => consume({ accountId, idempotencyKey: crypto.randomUUID() }), {
          success(result) {
            usingResetAccountId = null;
            loginMessage = resetOutcomeMessage(result.outcome);
            if (result.accountCredits) {
              usageByAccountId.set(accountId, {
                status: "ready",
                credits: result.accountCredits,
              });
            } else if (result.outcome === "reset") {
              usageByAccountId.delete(accountId);
              loadUsage(accounts);
            }
            render();
          },
          failure(error) {
            usingResetAccountId = null;
            loginMessage = errorMessage(error, messages.accountResetCreditsFailed);
            render();
          },
        });
      };
      const deleteAccount = (accountId: string): void => {
        const account = accounts.find((candidate) => candidate.accountId === accountId);
        if (!account || account.isDefault || accountBusy()) return;
        if (document.defaultView?.confirm?.(messages.accountDeleteConfirm) === false) return;
        deletingAccountId = accountId;
        loginMessage = messages.accountDeleting;
        render();
        void context.runLatest(() => client().deleteCodexAccount({ accountId }), {
          success() {
            deletingAccountId = null;
            loginMessage = null;
            setAccounts(
              accounts
                .filter((candidate) => candidate.accountId !== accountId)
                .map((candidate) => ({
                  ...candidate,
                  active: account.active ? candidate.isDefault : candidate.active,
                })),
            );
          },
          failure(error) {
            deletingAccountId = null;
            loginMessage = errorMessage(error, messages.accountDeleteFailed);
            render();
          },
        });
      };
      const cancelLogin = (accountId: string, loginId: string): void => {
        void context.runLatest(() => client().cancelCodexAccountLogin({ accountId, loginId }), {
          success() {
            clearLoginRefresh();
            login = null;
            loginMessage = null;
            render();
          },
          failure(error) {
            loginMessage = errorMessage(error, messages.accountLoginFailed);
            render();
          },
        });
      };

      add.addEventListener("click", createAndLogin);
      let unsubscribe: (() => void) | undefined;
      try {
        unsubscribe = getClient()?.subscribeCodexAccountLogin?.((result) => {
          if (result.loginId !== login?.loginId) return;
          clearLoginRefresh();
          login = null;
          loginMessage = result.success
            ? messages.accountLoginSucceeded
            : (result.error ?? messages.accountLoginFailed);
          render();
          if (result.success) load();
        });
      } catch {
        // Login remains usable even when the renderer bridge cannot subscribe.
      }
      const harnessAccounts = createHarnessAccounts(context.signal, getClient, render);
      void harnessAccounts.refresh();
      load();
      return () => {
        stopCountdowns();
        clearLoginRefresh();
        unsubscribe?.();
      };
    },
  });
}
