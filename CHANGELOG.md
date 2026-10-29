# Changelog

## Unreleased

### Changed

- Moved the development and CI baseline to Node.js 26.13.0 LTS.
- Updated ESLint, TypeScript lint tooling, and Node.js types, along with the
  Tauri CLI, dialog/filesystem plugins, and Rust base64 dependency.
- Preserved underlying causes in config/file-loading errors without changing
  their user-facing messages, and added a native image-encoding regression test.
- Confirmed JATOS 3.11.3 compatibility in Chrome on macOS for both task modes.
- Verified the updated universal macOS app on Apple Silicon for both task
  modes, image stimuli, local saving, and config-editor save/reopen.

## 0.2.1 - 2026-10-26

### Security

- Updated Vite, Vitest, and affected npm transitive dependencies to address
  known security advisories.
- Updated Rust dependencies, including `serde_with`, `anyhow`, `tokio`, and
  `quick-xml`, to address known security advisories.
- Added automated npm and macOS-scoped Rust dependency audits. The unresolved
  `glib` advisory remains documented for the unsupported Linux desktop path;
  it does not affect the packaged macOS app or browser/JATOS builds.

### Changed

- Hardened CI with commit-pinned GitHub actions, read-only permissions, and
  separate Apple Silicon and Intel Mac build checks.
- Updated dependency and release guidance. Experiment configuration, trial
  timing, scoring, and output schemas are unchanged.

## 0.2.0 - 2026-07-07

### Added

- Added the initial JATOS component entry, config-loading path, result-data
  save adapter, result-file upload support, and participant-metadata provider
  behaviour for JATOS validation.
- Added JATOS deployment documentation.
- Documented JATOS pilot-style testing on JATOS 3.10.5 across the validated
  macOS and Windows desktop browser set.

## 0.1.2 - 2026-07-02

### Changed

- Documented macOS Firefox smoke-test results.
- Documented Windows Chrome, Edge, and Firefox browser smoke-test results.
- Documented packaged macOS app smoke-test results on Intel Mac and Apple
  Silicon.
- Streamlined the public platform-support summary.
- Improved the macOS DMG window with a drag-to-Applications background.

### Fixed

- Improved missing-file errors for locations, trials, and stimulus image files.
- Improved config-editor save-dialog compatibility on older macOS versions.
- Improved config-editor field focus for missing local file warnings.

## 0.1.1 - 2026-06-24

### Added

- Initial public release of OPJRD.
- This release includes browser and packaged macOS workflows for object-placement and judgement-of-relative-direction tasks, JSON configuration,
the Tauri GUI settings editor, participant metadata collection, local data
saving, optional CSV export, and documented output/timing/scoring contracts.
