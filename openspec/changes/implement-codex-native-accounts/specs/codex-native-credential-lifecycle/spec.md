## ADDED Requirements

### Requirement: The v3 Vault SHALL preserve exact native credential copies

Host SHALL store Account metadata and exact native auth.json text, including unknown fields, for every saved Account including current in `<CODEX_HOME>/.codexhost-native-accounts/vault.json`. The v3 Vault SHALL use plain Node fs, directory mode 0700, file mode 0600 and atomic temporary-file plus rename writes. It SHALL NOT persist current selection, add encryption, access the OS keyring or use Rust private-file IPC. Plaintext credentials SHALL be treated as sensitive, with OS permissions as the only protection; deletion SHALL NOT be represented as secure erasure.

#### Scenario: Current native credentials rotate before exit

- **WHEN** the backend rotates A's credentials between the first save and confirmed stop
- **THEN** switching SHALL save the final native text again before installing B
- **AND** it SHALL NOT substitute an earlier cached or reconstructed credential document

#### Scenario: Credentials reach public surfaces

- **WHEN** Host publishes state, diagnostics or errors
- **THEN** credentials and private file paths SHALL NOT enter browser snapshots, logs or command arguments
- **AND** public errors SHALL use stable categories rather than secret-bearing native documents

### Requirement: Current identity and collection SHALL follow permanent native auth

Current SHALL be derived from issuer/subject/workspace identity in permanent auth.json, not a Vault selector, email or Token equality. Startup, list refresh and native Account notifications SHALL collect new identities and update matching saved credential copies. Collection SHALL NOT install credentials, restart the backend or query quota. Decoded identity metadata SHALL NOT replace native authentication verification when switching.

#### Scenario: External login, logout or refresh changes native auth

- **WHEN** collection observes changed permanent credentials
- **THEN** Host SHALL update the matching copy or add the new identity and derive current from the file
- **AND** an observed current change SHALL advance public revision
- **AND** native logout SHALL retain saved copies without implicitly restoring login

### Requirement: Legacy compatibility SHALL salvage copies rather than recover operations

Host SHALL read 0.8.x v1/v2 Vaults and rewrite them as v3, preserving saved Account metadata and usable credential copies without a persisted current selector. Entries without usable copies SHALL expose requiresLogin. Host SHALL scan leftover transaction.json, login.json, login/, .codexhost-process*.json and .codexhost-writer.lock once for usable credential copies, only filling missing copies or adding unknown identities, then delete these leftover records. It SHALL NOT replay legacy transaction/login intent, migrate keys or access the OS keyring. Corrupt Vaults SHALL NOT be overwritten; management SHALL become unavailable while native Codex remains usable.

#### Scenario: Legacy current has no credential copy

- **WHEN** a v1/v2 entry has metadata but no usable native document
- **THEN** collection MAY fill it from matching permanent auth or a specified leftover record
- **AND** otherwise it SHALL remain requiresLogin and SHALL NOT be switchable until credentials are acquired

#### Scenario: Leftovers contain older credentials or login activation intent

- **WHEN** a leftover record contains a copy for an already usable saved Account or a prior activate-on-success instruction
- **THEN** salvage SHALL NOT overwrite the usable saved copy or execute the prior activation intent
- **AND** unknown identities or missing copies MAY be saved before the leftover records are removed

#### Scenario: Vault is corrupt

- **WHEN** Host cannot safely read the existing Vault
- **THEN** it SHALL preserve that file rather than create a replacement Vault over it
- **AND** native startup SHALL remain independent, while recover MAY retry management initialization

### Requirement: Settings login SHALL use an independent short-lived native backend

Settings add/re-login SHALL use native device-code login in a separate `codex app-server`, with a private CODEX_HOME under the Accounts directory and a minimal environment. The main backend SHALL continue running during login. Successful credentials SHALL be saved; installation through the switch flow SHALL occur only when no current Account exists or the result re-authenticates the current identity. Same-identity re-login SHALL install new credential bytes. Cancellation or ten-minute timeout SHALL stop the login process, and every terminal path SHALL remove its directory. No durable login staging recovery or public cleanup state SHALL be retained.

#### Scenario: Current A adds B

- **WHEN** isolated login succeeds for a different B while A is current
- **THEN** Host SHALL save B without changing permanent A credentials or restarting the main backend
- **AND** B SHALL become available for an explicit later switch

#### Scenario: First login or current re-login succeeds

- **WHEN** no current exists or the successful login identity matches current
- **THEN** Host SHALL save the result and install it through the normal switching flow
- **AND** identity equality SHALL NOT skip installation of new bytes
- **AND** installation failure SHALL distinguish saved credentials from backend readiness

#### Scenario: Cancellation, timeout or an early completion races login start

- **WHEN** a terminal event occurs before or after the login start response
- **THEN** Host and UI SHALL reconcile it by operation and native login identity, not an existing email
- **AND** the login operation SHALL settle once, stop its process and remove its directory without late writes to permanent home
- **AND** a missing completion result SHALL NOT be presented as invented success

### Requirement: Settings logout and deletion SHALL preserve their distinct scope

Settings logout SHALL use the stop/save/replace/restart/verify flow with no target credentials and without external backend termination, preserving saved copies including current's latest credentials. Delete SHALL only remove a non-current saved Account and SHALL NOT stop a backend, modify native authentication, delete Threads or homes, or select another Account. Desktop native logout SHALL remain forwarded unchanged rather than invoking this Host flow.

#### Scenario: User logs out in Settings

- **WHEN** controlled logout completes
- **THEN** current SHALL be null based on verified native auth state
- **AND** saved Accounts SHALL remain selectable without requiring another login when their copies are usable

#### Scenario: User deletes a non-current Account during native work

- **WHEN** deletion of saved B is confirmed while A is current
- **THEN** collection mutation SHALL retain existing concurrent credential-write protection without stopping A or clearing native request leases
- **AND** ordinary native requests or Account-list refresh SHALL NOT by themselves block deletion

#### Scenario: User attempts to delete current

- **WHEN** deletion targets the current native identity
- **THEN** Host SHALL reject deletion without changing auth or selecting another Account

### Requirement: Quota reading SHALL retain its existing independent behavior

Current Account quota SHALL use official account/rateLimits/read. Inactive quota SHALL use bounded WHAM requests without starting another backend or installing saved credentials. OAuth refresh SHALL retain per-Account single-flight, exclusive change admission, identity verification and latest-Vault concurrent-write protection. Failed reads SHALL preserve last-good values and fetch time rather than invent zero usage. Only current SHALL consume reset credits, without automatic retry. Quota availability SHALL NOT gate startup, login, switching or recovery verification.

#### Scenario: Two Accounts update during a cache conflict

- **WHEN** one cache write observes a newer persisted snapshot
- **THEN** retry SHALL merge only its affected Account change rather than overwrite another Account's update

#### Scenario: An inactive OAuth token expires

- **WHEN** an inactive quota request needs credential refresh
- **THEN** concurrent refresh requests SHALL share one refresh and update only saved credentials after identity checks
- **AND** permanent auth.json and the main backend identity SHALL remain unchanged

#### Scenario: Quota service fails during native verification

- **WHEN** startup, login, switch or recover verifies native identity
- **THEN** verification SHALL use native account/read and file identity without a quota query or Model Turn
- **AND** independent quota display failure SHALL NOT make verified native authentication unavailable

### Requirement: Native verification SHALL wait without forcing token rotation

Switch, logout, rollback and recover verification SHALL poll `account/read {refreshToken:false}` approximately every 200 ms for at most 10 seconds, including stalled reads. A non-null target SHALL require a ChatGPT account and matching permanent auth.json identity; a null target SHALL require both a null native account and absent credentials. Transient error responses and nonmatching observations SHALL be retried, using the last observed failure category when the bound expires. File-based credential-storage and environment override checks SHALL remain unchanged.

#### Scenario: Authentication is not ready on the first reads

- **WHEN** initial account reads return null or transient RPC errors and a later read reports ChatGPT with matching file identity within the bound
- **THEN** verification SHALL succeed without any refreshToken true request

#### Scenario: The target does not become ready

- **WHEN** null account, wrong account type or identity mismatch persists through the bound
- **THEN** verification SHALL fail with authentication-failed and retain the last observed category
- **AND** a stalled read SHALL NOT extend verification beyond the bound

### Requirement: Account operation failures SHALL have bounded sanitized diagnostics

Each failed switch, logout or recover step SHALL emit one JSON line to Host diagnostic output and append it to CODEX_HOME/.codexhost-native-accounts/diagnostics.log with mode 0600, retaining the last 200 lines. Lines SHALL contain only operation kind, fixed failing step, optional numeric JSON-RPC error code and elapsed milliseconds. Verification SHALL log its final failure rather than each retry. Rollback failures SHALL use rollback-prefixed steps. Diagnostics SHALL NOT contain tokens, email, Account IDs, paths or raw error messages; diagnostic sink failure SHALL NOT prevent rollback.

#### Scenario: Verification and rollback both fail

- **WHEN** target verification fails and rollback verification also fails
- **THEN** diagnostics SHALL contain separate sanitized target and rollback failure lines
- **AND** Codex SHALL remain unavailable

### Requirement: Other homes and histories SHALL remain outside collection

Apart from the specified one-time records in the permanent home's Account storage, Host SHALL NOT scan legacy registries, inventory other homes or automatically import their credentials. Other home histories, databases, attachments, memory, queues and project relationships SHALL remain untouched. The removed legacyHistoryPreserved field SHALL NOT trigger imports or imply migrated history.

#### Scenario: Multiple old homes or another legacy selection exist

- **WHEN** Host starts with the canonical permanent home
- **THEN** it SHALL ignore old selections and leave other homes untouched
- **AND** it SHALL collect permanent auth and the specified leftover copies only, retaining already saved Vault Accounts
