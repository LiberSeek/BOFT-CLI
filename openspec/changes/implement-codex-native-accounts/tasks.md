## 1. Simplify storage and startup

- [ ] 1.1 Implement Node fs v3 Vault with exact native credential text, metadata, modes 0700/0600, atomic rename and no persisted current selector.
- [ ] 1.2 Rewrite v1/v2 Vaults, mark missing copies requiresLogin, salvage missing/unknown credentials once from specified 0.8.x records and delete leftovers; preserve corrupt Vaults.
- [ ] 1.3 Remove Journal recovery, process exit records, supervisor receipts, Rust private-file IPC and OS keyring access.
- [ ] 1.4 Start the shared capability-token loopback backend before asynchronous management initialization; preserve native use on management failure and remote single-account SSH behavior.

## 2. Simplify Account operations

- [ ] 2.1 Implement changing admission, native-auth busy handling, save/stop/external-stop/save/install/restart/native-verify switching without Model or quota probes.
- [ ] 2.2 Keep executable-name-matched external termination with PID/start-identity checks and bounded escalation; document cross-home and terminal CLI interruption.
- [ ] 2.3 Implement rollback to saved A and unavailable on failed rollback; recover by stop/restart/current-file verification and management initialization retry, without Journal replay.
- [ ] 2.4 Implement Settings logout with no target or external stop, and inactive-only deletion without backend stop; retain saved credentials on logout.
- [ ] 2.5 Run separate private-home Settings device-code login while main backend runs; save only unless no current or current re-login, install same-identity new bytes, stop on cancel/ten-minute timeout and always remove the directory.
- [ ] 2.6 Preserve native authentication forwarding, pending-auth observation and post-notification credential collection.

## 3. Contracts, Desktop and unchanged quota behavior

- [ ] 3.1 Update v2 state/capabilities and remove cleanupRequired, legacyHistoryPreserved, keyring-unavailable and migration-required.
- [ ] 3.2 Preserve generation isolation, Owner lazy native resume, Renderer selected-Thread reopening and original-client response ownership without promising temporary-content or full-settings restoration.
- [ ] 3.3 Preserve current native quota reads, inactive WHAM/single-flight OAuth refresh, concurrent-write protection, last-good caching and current-only reset credits.
- [x] 3.4 Replace documentation and OpenSpec requirements with the simplified design; retain attribution only for native credential envelope and inactive quota reading.

## 4. Validation pending for the simplified implementation

- [ ] 4.1 Add/run focused storage upgrade, corrupt Vault, atomic replacement, rollback/recover and login cancellation/timeout tests.
- [ ] 4.2 Validate native authentication passthrough, busy admission, generation retirement, public contracts, Renderer behavior and unchanged quota behavior.
- [ ] 4.3 Run applicable type, lint, boundary and focused TS/Rust checks through the owning workstreams; previous results do not validate this implementation.
- [ ] 4.4 Validate real platform permissions and process exit behavior, including external VS Code/CLI termination and automatic restart risks.
- [ ] 4.5 Validate real A→B→A on the same Thread, subsequent authentication/context, Desktop/Host continuity and other Harness behavior.
- [ ] 4.6 Complete the support matrix and release acceptance after authorized real-account/platform validation.

## 5. Explicitly deferred, not completed

- [ ] 5.1 Consolidate OfficialWorkGate lease kinds.
- [ ] 5.2 Choose between Owner lazy resume and Renderer navigation restoration.
- [ ] 5.3 Narrow external termination to same CODEX_HOME or app-server only.
- [ ] 5.4 Re-evaluate inactive-account OAuth refresh.

Implementation boxes remain unchecked until confirmed by their owning workstreams. Documentation/OpenSpec checks do not validate code. See [evidence.md](evidence.md); real-account, process and release actions require appropriate authorization.
