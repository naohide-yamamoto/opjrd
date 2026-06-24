# Desktop Packaging

This guide describes how maintainers build and prepare the OPJRD macOS desktop
app. The packaged app uses the same browser-first experiment core as browser
mode, with Tauri providing the desktop window, local file access, fullscreen
handling, and local saving.

Public desktop releases currently target macOS. Release packages are signed and
notarised before public distribution.

## Prerequisites

Install the standard Tauri macOS prerequisites, including Node.js, npm, Rust,
Cargo, Xcode command-line tools, and the Apple tooling needed for signing and
notarisation.

For the universal macOS build, install both macOS Rust targets:

```sh
rustup target add aarch64-apple-darwin
rustup target add x86_64-apple-darwin
rustup target list --installed
```

Install JavaScript dependencies from the public project root:

```sh
npm install
```

## Development App

For local desktop development, run:

```sh
npm run tauri:dev
```

This starts the Vite development server and opens the Tauri app. If another
Vite server is already using port `5173`, stop it before running the Tauri dev
command.

## Universal macOS App Build

Build the universal macOS `.app` package from the public project root:

```sh
npm run tauri:build:mac
```

This script runs:

```sh
tauri build --target universal-apple-darwin --bundles app
```

The generated app bundle is written under:

```text
src-tauri/target/universal-apple-darwin/release/bundle/macos/
```

The universal build is the default macOS packaging path because it includes both
Apple Silicon and Intel slices.

Architecture-specific helper scripts are available for diagnostic builds:

```sh
npm run tauri:build:mac:apple-silicon
npm run tauri:build:mac:intel
```

These helper scripts are not the default distribution path.

## DMG Build

An optional DMG build script is available:

```sh
npm run tauri:build:mac:dmg
```

This builds the `.app`, runs Tauri's DMG bundler, and writes a SHA-256 sidecar
file next to the generated DMG. The checksum file uses the same filename as the
DMG with `.sha256` appended, for example:

```text
OPJRD_0.1.1_universal.dmg.sha256
```

The DMG window layout and drag-to-Applications background are configured in
`src-tauri/tauri.conf.json` under `bundle.macOS.dmg`. The editable artwork is
`src-tauri/dmg-background.svg`; Tauri uses the generated
`src-tauri/dmg-background.png` file during DMG bundling.

For public distribution, use the signed and notarised release workflow below
rather than distributing an unsigned development build.

If the DMG is notarised or stapled after this build command finishes, regenerate
the checksum before publication so it matches the final DMG:

```sh
npm run release:checksum:mac-dmg
```

## Signing and Notarisation

The public macOS release package should be signed, notarised, stapled, and
Gatekeeper-tested before distribution.

At a high level, the maintainer release workflow is:

1. Build the universal macOS app.
2. Sign the app with the appropriate Apple Developer ID Application identity.
3. Build the DMG.
4. Sign the DMG with the appropriate Developer ID identity.
5. Submit the DMG to Apple notarisation.
6. Staple the notarisation ticket to the distributed artefact.
7. Verify Gatekeeper launch behaviour on a clean macOS environment.
8. Publish the DMG and its `.sha256` sidecar file together.

The exact signing identity, keychain setup, Apple account configuration, and
notarytool credentials are machine- and maintainer-specific. Do not commit
signing certificates, keychain material, Apple credentials, or notarisation
secrets to the repository.

## App Icons

The source icon is:

```text
src-tauri/icons/opjrd-icon.svg
```

Tauri's icon generator can regenerate desktop icon assets from this source.
OPJRD does not target mobile apps, so generated Android and iOS icon directories
are not kept in the repository.

Keep the desktop icon assets referenced by `src-tauri/tauri.conf.json`,
including the macOS `.icns`, Windows `.ico`, desktop PNGs, and Windows tile
PNGs. The current public packaging target is macOS, but these generated desktop
assets are harmless to keep and may be useful for later desktop targets.

## Release Smoke Test

Before publishing a macOS package, run a smoke test that covers both
`object_placement` and `jrd` modes:

- app launch
- config selection
- participant metadata form when enabled
- fullscreen entry and restoration
- trial start gate
- object-placement drag and finalisation
- JRD rod movement and click finalisation
- local JSON save
- optional CSV save
- post-save navigation

Current public platform support is documented in `docs/platform-support.md`.
