# Application icons

`codexhost.png` is the 1024px BOFT application icon used by macOS packaging.
It matches `packages/renderer-extension/src/assets/codexhost-icon.png`. Windows
launchers and the Inno Setup installer use `codexhost.ico`, with 16, 24, 32,
48, 64, 128, and 256 pixel frames. The uninstall listing uses `boft-start.exe`.

`packages/renderer-extension/src/assets/codexhost-app-icon.svg` is the upstream
vector master. `scripts/release/generate-brand-icons.mjs` renders that SVG over
these files, so do not run it when the BOFT marks should stay.
