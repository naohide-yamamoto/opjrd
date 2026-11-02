# Third-Party Notices

This notice summarises OPJRD's direct third-party dependencies and bundled
asset provenance.

## Direct JavaScript Runtime Dependencies

| Package | Version | Licence |
| --- | --- | --- |
| `@jspsych/plugin-html-button-response` | `2.1.0` | MIT |
| `@jspsych/plugin-html-keyboard-response` | `2.1.0` | MIT |
| `@tauri-apps/api` | `2.11.0` | Apache-2.0 OR MIT |
| `@tauri-apps/plugin-dialog` | `2.7.2` | MIT OR Apache-2.0 |
| `@tauri-apps/plugin-fs` | `2.5.2` | MIT OR Apache-2.0 |
| `jspsych` | `8.2.3` | MIT |

## Direct JavaScript Development Dependencies

| Package | Version | Licence |
| --- | --- | --- |
| `@eslint/js` | `10.0.1` | MIT |
| `@tauri-apps/cli` | `2.11.4` | Apache-2.0 OR MIT |
| `@types/node` | `26.6.6` | MIT |
| `eslint` | `10.13.0` | MIT |
| `typescript` | `5.9.3` | Apache-2.0 |
| `typescript-eslint` | `8.72.1` | MIT |
| `vite` | `8.1.6` | MIT |
| `vitest` | `4.1.12` | MIT |

## Overridden Development Dependency

The lint toolchain uses a temporary `minimatch` override for a security fix.
These packages are development-only and are not bundled in OPJRD's browser,
JATOS, or macOS app runtime.

| Package | Locked Version | Licence |
| --- | --- | --- |
| `minimatch` | `11.0.1` | BlueOak-1.0.0 |
| `@isaacs/nonrecursive-glob-match` | `1.0.3` | BlueOak-1.0.0 |

## Direct Rust and Tauri Dependencies

| Package | Version Requirement | Licence | Role |
| --- | --- | --- | --- |
| `base64` | `=0.23.1` | MIT OR Apache-2.0 | Encoding helper used by the Tauri shell |
| `tauri` | `=2.11.1` | Apache-2.0 OR MIT | Desktop application shell |
| `tauri-build` | `=2.6.1` | Apache-2.0 OR MIT | Tauri build helper |
| `tauri-plugin-dialog` | `=2.7.2` | Apache-2.0 OR MIT | Native file and folder dialogs |
| `tauri-plugin-fs` | `=2.5.2` | Apache-2.0 OR MIT | Local filesystem access for Tauri workflows |

The JavaScript transitive dependency graph is locked in `package-lock.json`.
The Rust transitive dependency graph is locked in `src-tauri/Cargo.lock`.
Maintainers should review the locked dependency graphs and update this notice
when dependency licences or bundled dependency provenance change.

## Bundled Assets and Provenance

The public fixture CSV files and placeholder stimulus image assets under
`public/assets/examples/` are project-authored examples for OPJRD.

The source app icon is `src-tauri/icons/opjrd-icon.svg`. Desktop icon files
under `src-tauri/icons/` are generated from that project-owned source.

Locale JSON files under `public/locales/` are project-authored OPJRD interface
strings.

No third-party PDFs, private support materials, participant data, secrets, or
redistribution-uncleared local materials should be copied into this public
repository.
