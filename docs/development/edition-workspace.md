# BOFT CLI Edition Workspace

This checkout is the shared development workspace for BOFT CLI CE and BOFT CLI EE.

## Local Layout

Only one BOFT CLI checkout is kept locally:

```text
Boft/
  BOFT-CLI/
```

The archived Legacy checkout is preserved on GitHub at `LiberSeek/BOFT-CLI-Legacy`.
It is not part of active development.

## Git Remotes

The checkout uses three remotes with separate responsibilities:

| Remote     | URL                                                | Responsibility     | Push                                                              |
| ---------- | -------------------------------------------------- | ------------------ | ----------------------------------------------------------------- |
| `origin`   | `git@github.com:LiberSeek/BOFT-CLI-EE.git`         | EE repository      | allowed                                                           |
| `public`   | `git@github.com:LiberSeek/BOFT-CLI.git`            | CE repository      | allowed from `ce` or `ce/*`; direct integration is `ce` to `main` |
| `upstream` | `https://github.com/BytePioneer-AI/codex-host.git` | CodexHost upstream | disabled                                                          |

`origin` is the default push remote. The `public` and `upstream` remotes should
be used explicitly when fetching or publishing CE/upstream changes.

## Local Branches

| Branch          | Tracks                       | Meaning                                              |
| --------------- | ---------------------------- | ---------------------------------------------------- |
| `main`          | `origin/main`                | EE integration branch; contains CE plus EE-only code |
| `ce`            | `public/main`                | CE integration branch; must not contain EE-only code |
| `upstream/main` | fetched from `upstream/main` | upstream reference; never a development branch       |

Feature branches use one of these prefixes:

- `ce/<topic>`: CE work, based on `ce`
- `ee/<topic>`: EE work, based on `main`
- `sync/<topic>`: temporary upstream synchronization work, based on `ce`

## Development Flow

### CE changes

```bash
git switch ce
git pull --ff-only public main
git switch -c ce/<topic>
# develop and test
git push public HEAD
```

Open or update a pull request against `LiberSeek/BOFT-CLI`. After the CE
change is integrated into `public/main`, update the local CE branch:

```bash
git switch ce
git fetch --no-tags public main
git reset --hard public/main
```

The `ce` branch is the only local branch allowed to update `public/main`
directly through the configured push guard. CE feature branches may be pushed
to matching `ce/*` branches for review.

### EE changes

EE starts from the CE baseline and adds private functionality:

```bash
git switch main
git pull --ff-only origin main
git fetch --no-tags public main
git merge --no-ff public/main -m "sync: update EE with CE"
git switch -c ee/<topic>
# develop and test
git push origin HEAD
```

EE-only changes are developed and reviewed in `LiberSeek/BOFT-CLI-EE`. They
must never be merged back into `public/main`.

When CE moves forward, merge `public/main` into `main`, resolve conflicts in
the EE checkout, and run the complete validation required by the affected
packages before pushing `origin/main`.

### Upstream synchronization

Upstream work is reviewed through a temporary branch. Do not merge upstream
straight into EE:

```bash
git fetch --no-tags upstream main
git switch ce
git switch -c sync/upstream-<date>
git merge --no-ff upstream/main -m "sync: update from codex-host upstream"
# run validation and review branding/license changes
git push public HEAD
```

Only upstream changes that are suitable for CE should be integrated into
`public/main`, then propagated to EE through the normal CE-to-EE merge.

## Edition Boundaries

CE is the complete public product and must work without a BOFT-EE account or
BOFT-EE service. The first CE feature area is a guided CC Switch API key import
flow, with the import action presented as the recommended provider setup path.

EE contains all CE capabilities plus optional BOFT-EE account integration:

- browser-based account binding and login;
- authenticated balance and usage queries;
- API key configuration and synchronization;
- recharge entry points;
- route and service status views.

EE integration must be optional at runtime and must not make CE depend on a
private endpoint, private credential, or EE-only package. Network mutations
such as key changes and recharge requests require explicit confirmation and
must use typed contracts with server-side authorization.

Recommended code ownership:

- CE UI and import flow: `packages/renderer-extension/src/settings/`
- CE/EE browser-safe DTOs: `packages/shared-contracts/src/`
- host-side authenticated orchestration: `packages/host-runtime/src/`
- update and platform behavior: existing `packages/update-manager/` and `crates/`
- EE-only modules: separate `ee/` modules inside the owning package, kept out of
  the `ce` branch

The EE service contract should be defined before UI implementation. It should
cover capability discovery, login/session state, account summary, balance,
API key operations, recharge creation, and route status. Tokens must be stored
in the existing secure host storage boundary, never in renderer local storage
or source-controlled configuration.

## Validation Matrix

Every CE change requires:

- formatting, lint, typecheck;
- focused renderer/contract tests;
- npm packaging smoke test when package boundaries change;
- cross-platform CI before a public release.

Every EE change requires all CE checks plus:

- EE capability-disabled behavior;
- unauthenticated and expired-session behavior;
- authorization and confirmation checks for mutations;
- API contract and error-state tests;
- verification that the CE branch remains free of EE-only files.

## Local Setup

The repository requires Node.js `22.22.0` or `24.x` and npm `11.8.0`.
Install the pinned JavaScript toolchain and dependencies with:

```bash
nvm install 22.22.0
nvm use 22.22.0
npm install --global npm@11.8.0
npm ci
```

Rust is required for local native checks and release preparation. Install the
Rust toolchain declared by the repository, then verify:

```bash
rustc --version
cargo --version
rustup target list --installed
```

The local release workflow must not be triggered casually. Do not create or
push a release tag until npm credentials, package permissions, release notes,
and all CI jobs have been verified.

## Push Guard

The tracked hook at `.githooks/pre-push` is installed as this checkout's
`core.hooksPath`. It rejects all pushes to `upstream`, rejects EE branches from
`public`, and rejects CE branches from `origin`. It permits only annotated `v*`
release tags from `ce` to `public` or from `main` to `origin`. Keep this guard
enabled on the shared checkout; use an explicit, reviewed override only when
repairing the repository configuration.

To reinstall it after cloning or changing the checkout location:

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-push
```
