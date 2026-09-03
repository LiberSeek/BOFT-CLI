import type { RendererAdapterStatus } from "../versioned-renderer-adapter.js";
import type { RendererSettingsPageDefinition, RendererSettingsPageMountContext } from "./core.js";
import type { RendererConnectionDiagnostics } from "./connections-page.js";
import { createRendererSettingsBrandIcon, createRendererSettingsIcon } from "./icons.js";
import type { RendererSettingsMessages } from "./localization.js";

type AdapterAvailability = RendererAdapterStatus["state"];

function adapterStatusLabel(
  availability: AdapterAvailability,
  messages: RendererSettingsMessages,
): string {
  if (availability === "ready") return messages.connectionStatusReady;
  if (availability === "installing") return messages.connectionStatusInstalling;
  return messages.connectionStatusUnsupported;
}

function adapterStatusTone(availability: AdapterAvailability): "ready" | "checking" | "failed" {
  if (availability === "ready") return "ready";
  if (availability === "installing") return "checking";
  return "failed";
}

function createAdapterRow(
  document: Document,
  adapter: RendererAdapterStatus,
  messages: RendererSettingsMessages,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "settings-connection-row";
  row.dataset.connectionItem = "renderer-adapter";
  row.dataset.pluginId = "renderer-adapter";
  row.setAttribute("role", "row");

  const identity = document.createElement("div");
  identity.className = "settings-connection-row__identity";
  identity.setAttribute("role", "cell");
  const mark = document.createElement("span");
  mark.className = "settings-connection-row__mark settings-connection-row__mark--logo";
  mark.setAttribute("aria-hidden", "true");
  mark.append(createRendererSettingsBrandIcon(22));
  const label = document.createElement("strong");
  label.textContent = messages.connectionAdapter;
  identity.append(mark, label);

  const status = document.createElement("span");
  status.className = "settings-connection-row__status";
  status.dataset.connectionTone = adapterStatusTone(adapter.state);
  status.setAttribute("role", "cell");
  status.textContent = adapterStatusLabel(adapter.state, messages);

  const action = document.createElement("div");
  action.className = "settings-connection-row__action";
  action.setAttribute("role", "cell");

  row.append(identity, status, action);
  return row;
}

export function createPluginsSettingsPage(
  messages: RendererSettingsMessages,
  getDiagnostics: () => RendererConnectionDiagnostics | null,
): RendererSettingsPageDefinition {
  return Object.freeze({
    id: "plugins",
    label: messages.pageLabels.plugins,
    icon: "plugins",
    mount(context: RendererSettingsPageMountContext) {
      const document = context.content.ownerDocument;
      const header = document.createElement("div");
      header.className = "settings-connection-page-header";
      const headingCopy = document.createElement("div");
      const heading = document.createElement("div");
      heading.className = "settings-section-label";
      heading.textContent = messages.pageLabels.plugins;
      const description = document.createElement("p");
      description.className = "settings-page-description";
      description.textContent = messages.pluginsDescription;
      headingCopy.append(heading, description);
      const refresh = document.createElement("button");
      refresh.type = "button";
      refresh.className = "settings-command-button settings-command-button--secondary";
      refresh.dataset.pluginAction = "refresh";
      refresh.append(createRendererSettingsIcon("diagnose", 16), messages.pluginsRefresh);
      header.append(headingCopy, refresh);
      const content = document.createElement("div");
      content.className = "settings-plugins-content";
      context.content.append(header, content);

      let pending = false;
      let unsubscribe = (): void => undefined;

      const render = (): void => {
        content.replaceChildren();
        const diagnostics = getDiagnostics();
        if (!diagnostics) {
          const empty = document.createElement("div");
          empty.className = "settings-empty";
          empty.textContent = messages.connectionNoRuntime;
          content.append(empty);
          return;
        }

        const adapter = diagnostics.snapshot().adapter;
        const list = document.createElement("section");
        list.className = "settings-connection-list";

        const tableHeader = document.createElement("div");
        tableHeader.className = "settings-connection-table-header";
        tableHeader.setAttribute("role", "row");
        const componentHeading = document.createElement("span");
        componentHeading.textContent = messages.connectionComponent;
        componentHeading.setAttribute("role", "columnheader");
        const statusHeading = document.createElement("span");
        statusHeading.textContent = messages.connectionStatus;
        statusHeading.setAttribute("role", "columnheader");
        const actionHeading = document.createElement("span");
        actionHeading.textContent = messages.connectionAction;
        actionHeading.setAttribute("role", "columnheader");
        tableHeader.append(componentHeading, statusHeading, actionHeading);

        const rows = document.createElement("div");
        rows.className = "settings-connection-rows";
        rows.setAttribute("role", "rowgroup");
        rows.append(createAdapterRow(document, adapter, messages));
        list.append(tableHeader, rows);
        content.append(list);
      };

      const runRefresh = (): void => {
        const diagnostics = getDiagnostics();
        if (pending || !diagnostics) return;
        pending = true;
        refresh.disabled = true;
        refresh.replaceChildren(
          createRendererSettingsIcon("diagnose", 16),
          messages.pluginsRefreshing,
        );
        void context.runLatest(() => diagnostics.refresh(), {
          success() {
            pending = false;
            refresh.disabled = false;
            refresh.replaceChildren(
              createRendererSettingsIcon("diagnose", 16),
              messages.pluginsRefresh,
            );
            render();
          },
          failure() {
            pending = false;
            refresh.disabled = false;
            refresh.replaceChildren(
              createRendererSettingsIcon("diagnose", 16),
              messages.pluginsRefresh,
            );
            render();
          },
        });
      };

      refresh.addEventListener("click", runRefresh);
      const diagnostics = getDiagnostics();
      if (diagnostics) {
        unsubscribe = diagnostics.subscribe(render);
      }
      render();
      return () => {
        unsubscribe();
      };
    },
  });
}
