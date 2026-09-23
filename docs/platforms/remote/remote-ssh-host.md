# Remote Harnesses over SSH

Use Harnesses that are installed and signed in only on a remote machine — Claude Code included — from your local Codex Desktop, through its native SSH workspace. Your credentials stay on the remote machine and are never sent over SSH.

## Prerequisites

- **Local machine** (macOS, Linux, or Windows): Codex Desktop and BOFT CLI are installed.
- **Remote machine** (macOS or x64/ARM64 Linux; Windows isn't supported yet): Codex CLI is installed, along with **the same BOFT CLI version** as your local machine.
- The Harness you want to use is installed and signed in on the remote machine.
- Codex Desktop's native SSH workspace already works (**Settings → Connections → SSH**).

## Install

On the remote machine, run:

```bash
npm install -g @liberseek/boft-cli
boft remote install
boft remote start
boft remote status
```

`remote install` adds a clearly marked block to your shell profile that only applies to SSH sessions, and backs up the profile first. Your local shells and existing `codex` command are left alone. On macOS, it also installs a per-user LaunchAgent that starts Claude Code in your logged-in session. It never reads the Keychain or any credentials.

## Usage

1. On your local machine, launch Codex Desktop through BOFT.
2. Open the SSH workspace.
3. Pick a Harness from the composer's Agent / Model selector.

Settings → Session Import is scoped to that same current Host. With a remote Composer selected, it lists and maps only Sessions stored on the SSH host, and opens the imported Thread through that remote Host. Claude discovery runs directly on Linux SSH hosts and through the Aqua broker on managed macOS hosts; only bounded Session metadata and the validated native identity cross the broker, never Transcript content or credentials. Close the Session in its native Claude client before importing when activity is reported as unknown. Install the same BOFT CLI version on both machines and reconnect after an upgrade so the remote runtime and broker expose the matching import methods.

## Commands

```bash
boft remote status     # Check whether it is running and installed correctly
boft remote start      # Start it (safe to run more than once)
boft remote stop       # Stop it without touching other Codex processes
boft remote uninstall  # Uninstall it but keep your Thread mapping data
```

After you start, stop, or uninstall, reconnect the SSH workspace in Codex Desktop.

## Upgrade

Upgrade both machines to the same version using the same package manager. Then rerun `boft remote install` and `boft remote start` on the remote machine and reconnect the SSH workspace.

## Troubleshooting

- **`codexhost/harness/inspect is unsupported on this Host connection`**: the SSH connection isn't going through BOFT. Make sure the same BOFT CLI version is installed and running on the remote machine, then reconnect the SSH workspace.
- **`remote status` says degraded or asks you to reinstall**: run `boft remote install`, then `boft remote start`.
- **A Harness is missing**: make sure it is installed and signed in on the remote machine, then click **Run connection diagnostics** in Settings.
- **Install fails on macOS with a launchd / `gui/$UID` error**: the remote Mac needs someone logged in to the desktop. Log in, then run `boft remote install` again.
