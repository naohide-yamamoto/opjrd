# Platform Support

This document summarises OPJRD's current public support scope and known platform
limits.

## Current Support Scope

The current release is scoped to:

- macOS browser use in recent Chrome, Safari, and Firefox
- a signed and notarised packaged macOS app

The packaged macOS app has been tested on Apple Silicon. The macOS app is built
as a universal app, but Intel Mac validation is still pending.

Windows browser validation remains pending.

## Browser Mode

Browser-mode OPJRD uses the browser Fullscreen API on a best-effort basis. If a
participant exits fullscreen during a trial, OPJRD attempts to restore
fullscreen at the next trial start when the browser allows it.

macOS may still reveal the menu bar or Dock when the system cursor
reaches the top or bottom of the desktop. This is ordinary operating-system
behaviour.

Browser-mode local saving uses browser downloads. JSON is always produced, and
CSV is produced when `save.csvEnabled` is `true`.

## Recent Browser Smoke Tests

### macOS Firefox

- OPJRD commit tested: `5f0cd1e`
- Environment: macOS Tahoe 26.4 on Apple Silicon M2
- Browser: Firefox 152.0.2 (aarch64)
- Configs tested: `/assets/examples/basic/config.json` and `/assets/examples/jrd/config.json`
- Modes tested: `object_placement` and `jrd`
- Passed: config loading, metadata form, fullscreen entry/restoration, start gate on and off, object-placement drag/finalise, JRD rod/click, JSON and CSV download, and post-save buttons
- Known Firefox-specific issues: none so far
- Non-Firefox-specific issue found: missing-file error-message issues were also present in Chrome and Safari and were fixed in commit `97c2256`

## Tauri macOS App

The packaged macOS app uses the same browser-first experiment core as browser
mode, with Tauri providing the desktop window, local config/file loading,
fullscreen handling, and local saving.

Tauri local saving asks the user to choose an output folder and writes JSON and
optional CSV files there. If the folder selection is cancelled, OPJRD returns to
the save screen so the session can still be saved.

## Not Currently Supported

The current release does not claim support for:

- Windows browser workflows
- Windows packaged apps
- Linux browser workflows
- Linux packaged apps
- JATOS deployment
- mobile platforms

JATOS-related config and save-adapter paths are not publicly supported until the
JATOS workflow is validated.

## Deferred Validation

The remaining platform validation item for the current macOS release baseline is
a packaged universal `.app` smoke test on an Intel Mac.

Before claiming support for any additional platform or browser, run the relevant
manual smoke tests for both `object_placement` and `jrd` modes, including config
loading, fullscreen behaviour, trial start gate behaviour, response
finalisation, and data saving.
