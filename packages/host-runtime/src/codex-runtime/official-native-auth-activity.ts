import type { JsonObject } from "@codexhost/protocol-core";
import type { OfficialWorkGate } from "./official-work-gate.js";

interface Login {
  release(): void;
  id?: string;
  completed: Set<string>;
}
const object = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Observes native credential writers solely to keep Host switches from stopping them.
 * Never validates auth parameters, changes IDs/results, cancels login or runs a transaction.
 */
export class OfficialNativeAuthActivity {
  readonly #logins = new Set<Login>();
  constructor(private readonly gate: OfficialWorkGate) {}

  admit(method: string, params: JsonObject): (response?: JsonObject) => void {
    if (!method.startsWith("account/login/") && method !== "account/logout")
      return this.gate.admit();
    const release = this.gate.admit("native-auth");
    const login: Login | undefined =
      method === "account/login/start" ? { release, completed: new Set() } : undefined;
    if (login) this.#logins.add(login);
    let replied = false;
    return (response) => {
      if (replied) return;
      replied = true;
      const result =
        response && !response.error && object(response.result) ? response.result : null;
      if (login && this.#logins.has(login) && typeof result?.loginId === "string") {
        login.id = result.loginId;
        const completed = login.completed.has(login.id);
        login.completed.clear();
        if (!completed) return; // Browser/device login outlives its start response.
      }
      if (login) this.#logins.delete(login);
      if (
        method === "account/login/cancel" &&
        result?.status === "canceled" &&
        typeof params.loginId === "string"
      )
        this.#complete(params.loginId);
      release();
    };
  }

  observe(value: JsonObject): void {
    if (
      value.method === "account/login/completed" &&
      object(value.params) &&
      typeof value.params.loginId === "string"
    )
      this.#complete(value.params.loginId);
  }

  #complete(id: string): void {
    for (const login of this.#logins) {
      if (login.id === id) {
        login.release();
        this.#logins.delete(login);
      } else if (login.id === undefined) {
        // Native completion can precede the start response. Discard correlation
        // once that response arrives; never retain credentials or auth URLs.
        login.completed.add(id);
      }
    }
  }

  /** A client disconnect alone does not prove a native login writer has stopped. */
  backendStopped(): void {
    for (const login of this.#logins) login.release();
    this.#logins.clear();
  }
}
