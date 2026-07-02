# Platform Support

This document summarises OPJRD's current public support scope and known platform
limits.

## Current Support Scope

The current release is scoped to:

- macOS browser use in recent Chrome, Safari, and Firefox
- Windows browser use in recent Chrome, Edge, and Firefox
- a signed and notarised packaged macOS app

The packaged macOS app has been tested on Apple Silicon and Intel Mac. The
macOS app is built as a universal app.

## Validated Workflows

| Workflow | Current Status |
| --- | --- |
| macOS browser mode | Smoke-tested in Chrome, Safari, and Firefox |
| Windows browser mode | Smoke-tested in Chrome, Edge, and Firefox |
| Packaged macOS app | Smoke-tested on Apple Silicon and Intel Mac |

These checks cover both `object_placement` and `jrd` modes with representative
example configs. Browser checks include config loading, trial execution, local
JSON/CSV downloads, and post-save navigation. Packaged macOS app checks include
installation and launch, local config/file loading, trial execution, fullscreen
behaviour, local saving, post-save navigation, and GUI config editing.

## Browser Mode

Browser-mode OPJRD uses the browser Fullscreen API on a best-effort basis. If a
participant exits fullscreen during a trial, OPJRD attempts to restore
fullscreen at the next trial start when the browser allows it.

macOS may still reveal the menu bar or Dock when the system cursor
reaches the top or bottom of the desktop. This is ordinary operating-system
behaviour.

Browser-mode local saving uses browser downloads. JSON is always produced, and
CSV is produced when `save.csvEnabled` is `true`.

## Tauri macOS App

The packaged macOS app uses the same browser-first experiment core as browser
mode, with Tauri providing the desktop window, local config/file loading,
fullscreen handling, and local saving.

Tauri local saving asks the user to choose an output folder and writes JSON and
optional CSV files there. If the folder selection is cancelled, OPJRD returns to
the save screen so the session can still be saved.

Some cosmetic details of the packaged app, such as Dock icon sizing and
GUI-editor control sizing, may vary between Apple Silicon and Intel Mac. 
They are optimised for Apple Silicon Mac. These differences have not affected
experiment functionality in testing.

## Not Currently Supported

The current release does not claim support for:

- Windows packaged apps
- Linux browser workflows
- Linux packaged apps
- JATOS deployment
- mobile platforms

JATOS-related config and save-adapter paths are not publicly supported until the
JATOS workflow is validated.

## Additional Validation

Before claiming support for any additional platform or browser, run the
relevant manual smoke tests for both `object_placement` and `jrd` modes,
including config loading, fullscreen behaviour, trial start gate behaviour,
response finalisation, and data saving.
