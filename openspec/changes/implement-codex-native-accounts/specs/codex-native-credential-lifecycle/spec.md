## ADDED Requirements

### Requirement: The Vault SHALL preserve complete native credentials securely

One atomic private v2 Vault SHALL store metadata and complete plaintext credential copies for all saved Accounts, including the current Account, without additional encryption or a persisted current-account selector. The permanent native file SHALL determine current identity; public current metadata SHALL be derived from observed issuer, subject and workspace identity, not email or Token equality. Native bytes, unknown fields, digest checks and OS file permissions SHALL be preserved. Legacy encrypted Vault, transaction and login payloads SHALL be validated with the existing key and converted under the home lease using per-file CAS; partial conversion SHALL be resumable. No API SHALL create new OS keys. Plaintext stores SHALL NOT access the OS keyring.

#### Scenario: Current native credentials rotate

- **WHEN** an owned backend refreshes its credentials before confirmed stop
- **THEN** the transaction SHALL preserve the final native bytes rather than an earlier cached snapshot

#### Scenario: External login, logout or Token rotation is observed

- **WHEN** ordinary startup, Account-list refresh, native authentication notifications or a credential change synchronizes native state without a pending Host operation
- **THEN** Host SHALL collect new identities and update matching credential copies without writing native auth, restarting the backend just for collection, or querying quota
- **AND** external logout SHALL retain saved copies but derive no current Account, without restoring login implicitly
- **AND** an observed selection change alone SHALL advance the public snapshot revision

#### Scenario: A v1 Vault or Journal is opened

- **WHEN** the old Vault persisted current with no credential copy for that entry
- **THEN** migration SHALL preserve IDs, revision and operation receipts, remove the Vault selector and fill the missing copy only from matching actual credentials
- **AND** unavailable copies SHALL retain metadata with requiresLogin and SHALL NOT be offered for switching until re-authenticated
- **AND** pending v1 Journals SHALL retain source/target selection evidence and be recovered before ordinary collection

#### Scenario: An existing Vault's key cannot be obtained

- **WHEN** the OS key required to migrate existing ciphertext is unavailable
- **THEN** managed credential operations SHALL fail closed without decrypting the Vault or creating a replacement key
- **AND** clean native fallback MAY retain file/process ownership solely for native single-account operation and process witnesses

#### Scenario: The file lease becomes unavailable

- **WHEN** the leased helper loses its stable file identity
- **THEN** all shared file facades SHALL stop issuing writes
- **AND** Rust primitives SHALL remain generic file/key/process capabilities without Account or OAuth semantics

### Requirement: One transaction executor SHALL recover from durable facts

Host switch, Settings first activation, current re-login and controlled logout SHALL share one native credential transaction. Desktop native authentication SHALL NOT invoke that transaction. Journal source/target, before/after credential collections with temporary transaction selections, actual credential identity/digest and operation receipts SHALL determine recovery. Durable commit followed by a lost acknowledgement or cleanup error MUST NOT roll back current. Compensation SHALL first preserve any latest target grant durably.

#### Scenario: Installed first login crashes before commit

- **WHEN** a Journal proves installation but the credential collection commit is incomplete
- **THEN** recovery SHALL interpret that operation before automatic native credential import

#### Scenario: Same-current re-login has rotated

- **WHEN** new authorization is installed and rotates before an error
- **THEN** recovery SHALL not restore the older authorization or replay a stale staged candidate

#### Scenario: Unknown native identity is observed

- **WHEN** a pending operation exists and actual credentials cannot be explained by its Vault and Journal facts
- **THEN** Host SHALL preserve evidence and reject the transition without first starting a writer that could refresh the unknown credentials

### Requirement: Settings login SHALL isolate staging and report saved state accurately

Host Settings login SHALL register one short-lived operation and use a private authentication-only home. Permanent and staging processes MUST NOT overlap. A current A SHALL remain A after Settings adds B. Native Desktop login SHALL bypass this staging workflow and execute on the official permanent backend. First successful login with no current Account SHALL activate through the common transaction. Completion and cancellation SHALL be associated with the operation and native login identity, not only a provisional Account ID.

#### Scenario: Login start races cancellation or an early event

- **WHEN** cancellation or completion arrives before start registration finishes, including after admission but before stage creation
- **THEN** the operation SHALL settle once, wait for start/stop facts and prevent late writes to the permanent home
- **AND** cancellation and terminal manager close SHALL recognize the already published operation ID before a stage object exists

#### Scenario: First login stops between saving its candidate and activation

- **WHEN** the first verified candidate is saved but activation has not committed
- **THEN** its durable stage SHALL remain until activation completes so restart or recover can finish the same operation
- **AND** activation failure with a stopped permanent backend SHALL report unavailable rather than ready

#### Scenario: An older Host left a native login activation stage

- **WHEN** an existing stage records a verified candidate and activate-on-success intent from the previous native interception implementation
- **THEN** recovery SHALL retain that durable intent and activate the candidate through the existing transaction
- **AND** new native Desktop logins SHALL NOT create such stages or require a Host completion event

#### Scenario: Completion precedes the login start response

- **WHEN** the UI receives a completion before the matching start response, possibly with a deduplicated Account ID
- **THEN** it SHALL reconcile by loginId and SHALL NOT infer success from an existing Account email
- **AND** an ended operation with no received completion SHALL be shown as result-unconfirmed rather than an invented success

#### Scenario: Adding B succeeds but restoring A fails

- **WHEN** B is committed and A's restart or staging cleanup fails
- **THEN** the result SHALL report B saved and recovery required
- **AND** any newly refreshed A credentials SHALL remain authoritative

### Requirement: Inactive quota refresh SHALL not install credentials or lose concurrent data

Inactive quota reads SHALL use bounded requests without starting another backend. OAuth refresh SHALL use single-flight, exclusive change admission, identity verification and latest-Vault CAS. Cache retries SHALL reapply only the affected Account patch and retain last-good values rather than invent zero usage. Only current SHALL consume reset credits, without automatic retry.

#### Scenario: Two Accounts update during a cache conflict

- **WHEN** one cache write observes a newer persisted snapshot
- **THEN** retry SHALL merge its own Account change with that snapshot rather than overwrite another Account's update

### Requirement: Unsupported old layouts SHALL preserve authentication without claiming migration

Only verified layouts SHALL be adopted. Single permanent-home adoption SHALL not copy or delete native history. A valid legacy registry whose selected Account already uses the effective permanent home MAY adopt missing credentials after normal native recovery, identity and file-store verification, exclusive admission and owned backend exit. Other homes SHALL contain no managed state or ownership records. Source credentials SHALL remain read-only and be revalidated together with the registry and writer admission before one Vault CAS commits the plaintext Account payloads and source registry digest. Existing saved grants SHALL NOT be overwritten by legacy copies. Current-home managed state SHALL go through normal recovery. Foreign or mismatched selected homes, invalid metadata, orphan Thread bindings and unconfirmed owned processes SHALL remain blocked. This is credential adoption, not history migration: all source databases, attachments, memories, queues, projects and native relationships SHALL remain in place. The current scope SHALL preserve the primary Account's existing permanent-home history; merging or displaying histories from other legacy homes is not required. Legacy source directories SHALL NOT be automatically deleted. A future irreversible migration MUST require approved human confirmation and retain source data.

#### Scenario: Multiple old homes contain history

- **WHEN** startup detects that unsupported layout
- **THEN** layout inspection SHALL mark history migration as incomplete, preserve all source homes and avoid both rollout-only migration and an old multi-backend fallback
- **AND** it SHALL not claim that history migration has completed; unmerged histories alone SHALL NOT create a migration delivery gate for otherwise eligible credential adoption

#### Scenario: Adopted credentials support a global round trip

- **WHEN** verified legacy credentials A and B have been adopted
- **THEN** switching A to B and back SHALL use only the permanent home and the same credential transaction, with at most one Host-owned official backend
- **AND** restarting SHALL NOT reimport an Account deleted after adoption; changed registry provenance SHALL NOT be silently accepted

#### Scenario: Startup coexists with other Codex clients

- **WHEN** VS Code or CLI backends are running
- **THEN** startup SHALL NOT inventory, stop or reject those external backends
- **AND** managed and legacy-compatible startup SHALL retain their layout, provenance and owned-process recovery checks without an external-process capability blocker

#### Scenario: Native-only compatibility becomes unsafe before backend start

- **WHEN** the registry changes or managed state appears in an incompatible legacy layout
- **THEN** the Host SHALL refuse that compatibility path without deleting data or bypassing managed recovery

#### Scenario: Switching stops detected external Codex backends

- **WHEN** switching retires its own backend
- **THEN** the native helper SHALL stop the executable-name-matched external batch with PID/start-identity checks and bounded termination escalation, across CODEX_HOME values
- **AND** it SHALL NOT close editors, recursively kill external tool children, or run this batch during startup, shutdown, rollback or recovery
- **AND** any observed credential identity or CAS conflict SHALL fail rather than report successful switching
