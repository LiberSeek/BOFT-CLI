## ADDED Requirements

### Requirement: Global Account changes SHALL preserve the native Codex architecture

Managed Codex SHALL use one canonical permanent CODEX_HOME, native session store and Host-owned main official app-server shared by Desktop clients and one management connection through a capability-token-protected loopback listener. A separate short-lived Settings login app-server MAY run concurrently in its own private home. Host SHALL NOT proxy Model requests, create permanent per-Account backends or homes, or route Threads by Account. Account changes SHALL NOT change Harness, Model, Provider or Billing Source semantics.

#### Scenario: Switch A to B

- **WHEN** the user selects saved B with usable credentials
- **THEN** subsequent native work SHALL use verified global B while retaining permanent home, native Thread IDs, persisted history and Harness ownership
- **AND** Host, Desktop and other Harnesses SHALL remain running without replaying prior work

### Requirement: Switching SHALL replace credentials only after stopping native backends

Switching SHALL enter changing, reject new native work and conflicting switches, save A's latest credentials, check file-based storage and absence of API-key environment overrides, stop the Host-owned backend and wait for process exit, stop the detected external Codex batch, save A again to capture rotation, atomically install B, restart and verify using native `account/read` and file identity before ready. It SHALL NOT scan Thread, Goal, queue or temporary-session activity, issue a Model Turn, or query quota for verification.

#### Scenario: Native requests are pending

- **WHEN** switching stops the main backend while ordinary native requests or tasks are active
- **THEN** retired RPCs SHALL fail explicitly and new work SHALL be rejected before connection or automatic startup
- **AND** work SHALL NOT be queued or replayed under B

#### Scenario: Native authentication is pending

- **WHEN** Desktop native authentication is still in flight
- **THEN** a conflicting Host switch SHALL return busy before stopping or replacing credentials
- **AND** ordinary native requests SHALL retain normal operation

#### Scenario: Owned process exit cannot be confirmed

- **WHEN** stopping the owned backend fails to establish process exit
- **THEN** Host SHALL NOT install target credentials or start a competing backend
- **AND** transport closure alone SHALL NOT establish process exit

#### Scenario: Storage or environment overrides native file authentication

- **WHEN** storage is not file-based or an API-key environment override is present
- **THEN** switching SHALL be rejected without installing the target
- **AND** unsupported management SHALL NOT replace the official backend's native authentication semantics

### Requirement: Switching SHALL stop the detected external Codex batch

After stopping its own backend, switching SHALL stop external processes matched by executable name `codex`, `codex.exe` or the official binary basename, with PID/start-identity checks and bounded termination escalation. This is necessary because live external backends retain old tokens and can write them back to shared auth.json. The current batch SHALL NOT be described as limited to the same CODEX_HOME or to app-server processes; it can interrupt terminal CLI sessions. Startup, ordinary shutdown, logout, rollback and recover SHALL NOT run this batch.

#### Scenario: External backends use other homes or terminal CLI sessions

- **WHEN** those processes match the detected executable-name batch
- **THEN** switching SHALL apply identity-checked bounded termination to them before target installation
- **AND** a failed batch SHALL NOT result in reported successful switching
- **AND** editors, Desktop, Host and other Harnesses SHALL NOT be closed, and external tool children SHALL NOT be recursively terminated

#### Scenario: An editor automatically restarts Codex

- **WHEN** an editor creates another backend after the detected batch
- **THEN** Host SHALL NOT repeatedly hunt replacement processes
- **AND** success SHALL depend on target file identity and the verified owned backend, not synchronized identity across all clients

### Requirement: Failure and recovery SHALL use current native credentials without a Journal

After a failure following backend stop, Host SHALL restore saved A credentials, restart and verify A when safe to do so. Failed rollback SHALL make Codex unavailable. Recover SHALL stop, restart and verify the identity currently in permanent auth.json, and retry Account management initialization. Host SHALL NOT persist or replay a credential Journal, operation commit receipt, process exit record or supervisor receipt.

#### Scenario: Installing or verifying B fails

- **WHEN** the backend has stopped and the target operation fails
- **THEN** Host SHALL attempt to restore saved A and verify its restarted backend
- **AND** if that fails, native work SHALL remain unavailable while recover is offered when it can be retried
- **AND** other Harness work SHALL remain available

#### Scenario: Switching is interrupted

- **WHEN** Host exits during atomic auth replacement
- **THEN** permanent auth.json SHALL contain one complete A or B identity
- **AND** next startup collection SHALL reconcile that file without replaying the previous switch intent

### Requirement: Startup SHALL be independent of Account management initialization

Startup SHALL canonicalize CODEX_HOME, launch the shared native main backend, then initialize Account management asynchronously. It SHALL NOT gate startup on historical Journal/login records, process exit receipts or an exact-version allowlist. Management initialization or corrupt-Vault failure SHALL disable management only, preserving ordinary native use. SSH SHALL retain remote native single-account authentication without local credential transfer or a remote managed Account vault.

#### Scenario: Collection is slow, corrupt or unavailable

- **WHEN** Account initialization fails or is delayed after native startup
- **THEN** native work SHALL continue without waiting for collection or restarting the main backend
- **AND** corrupt Vault contents SHALL NOT be overwritten

#### Scenario: Other Codex clients already run

- **WHEN** Host starts while VS Code or CLI backends are running
- **THEN** startup SHALL NOT inventory, stop or reject those external processes

#### Scenario: Required management protocol capability is missing

- **WHEN** the official backend lacks a required management capability
- **THEN** Host SHALL report unsupported management without an exact-version allowlist
- **AND** native single-account authentication SHALL remain available when the native backend is usable

### Requirement: Desktop transport initialization SHALL remain independent of native readiness

Host SHALL acknowledge Desktop initialization with Host identity, permanent home and platform metadata while native admission is changing or unavailable, without claiming native authentication or Model capabilities. It SHALL retain original native negotiation parameters for recovery, and SHALL NOT connect Desktop task clients to the private login backend. Terminally closed clients SHALL NOT accept new initialization.

#### Scenario: Desktop attaches during a switch or private login

- **WHEN** Desktop initializes while changing, unavailable or a separate login process is active
- **THEN** initialization SHALL identify the permanent home, not the login directory
- **AND** native work SHALL follow main-backend admission while other Harness requests remain available
- **AND** after recovery the client SHALL use retained native initialization parameters without requiring Desktop restart

### Requirement: Native Desktop authentication SHALL retain its protocol semantics

Desktop `account/login/*` and `account/logout` SHALL be forwarded unchanged to the official backend, subject to native availability and conflicting Host credential replacement. Host SHALL only observe pending native authentication and collect credentials after notifications; it SHALL NOT rewrite parameters, login IDs, results, errors or completion events, or redirect Desktop login to the Settings login process.

#### Scenario: Authentication parameters evolve or completion arrives early

- **WHEN** Desktop sends unknown, absent or null parameters, or native completion precedes the start response
- **THEN** Host SHALL preserve protocol content and ordering for the official backend and Desktop
- **AND** pending-auth observation SHALL reconcile the native login identity without leaving a stale switching blocker

#### Scenario: Native success is followed by collection failure

- **WHEN** an official account notification arrives but collection fails
- **THEN** Host SHALL deliver the native notification before asynchronous collection
- **AND** collection failure SHALL NOT change the official result or close native admission; later notifications or list refresh MAY retry

#### Scenario: Replacement backend becomes ready

- **WHEN** switching or recover verifies the main backend
- **THEN** Desktop Account updates SHALL reflect its actual native account/read result, not a saved login candidate or retired generation

### Requirement: Thread restoration SHALL preserve original identity and generation

Backend replacements SHALL create new generations. Owner SHALL lazily resume native Threads by original Thread ID and retained subscription parameters. Renderer SHALL reopen the selected local Codex Thread through native navigation after a successful switch. Host SHALL NOT fabricate replacement Threads, replay Turns or guarantee lossless temporary content and full runtime settings.

#### Scenario: Work reaches a replaced backend

- **WHEN** a previously subscribed Thread receives work in a new generation
- **THEN** Owner SHALL first use native thread/resume for the original Thread ID
- **AND** resume failure SHALL reject work explicitly, while retired frames SHALL NOT update the new generation

#### Scenario: Switching restores window navigation

- **WHEN** a successful switch replaces the view of the selected local Codex Thread
- **THEN** Renderer SHALL reopen that same Thread once the native view is available
- **AND** rejection, user navigation, timeout or disposal SHALL end restoration without resubmitting Account operations or Thread input

### Requirement: Public v2 Account state SHALL describe global native-derived facts

The browser-safe v2 snapshot SHALL expose phase ready/changing/unavailable, instanceId/revision, native-derived current, Accounts with requiresLogin, pendingOperation and capabilities manage/switch/login/delete/logout/recover. Capability reasons SHALL be limited to unsupported-storage, recovery-required, ssh-single-account and unsupported-version. It SHALL NOT expose credentials, private paths, cleanupRequired, legacyHistoryPreserved, keyring-unavailable or migration-required. Current identity SHALL NOT imply backend readiness. Only Settings SHALL offer global switching.

#### Scenario: State or client changes during an operation

- **WHEN** an Account response arrives from an old Host/revision or Desktop replaces its Request Client
- **THEN** stale state SHALL NOT replace newer state, and the response SHALL complete only its original request
- **AND** busy SHALL end UI waiting and allow explicit retry without resending the original operation

#### Scenario: Saved credentials exist but Codex is unavailable

- **WHEN** login credentials were saved but installation or recovery did not make the backend ready
- **THEN** the UI SHALL distinguish saved Account state from readiness and offer recover according to capabilities
- **AND** it SHALL NOT expose a cleanup-required state or retry-cleanup workflow
