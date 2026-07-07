# Dependency Versions and Provenance

OPJRD uses pinned project-managed dependency versions. JavaScript dependencies
are pinned in `package.json` and locked in `package-lock.json`. Rust/Tauri
direct dependencies are pinned with exact `=` requirements in
`src-tauri/Cargo.toml` and locked in `src-tauri/Cargo.lock`.

Dependencies should be upgraded deliberately, with geometry, timing, output,
browser, and Tauri checks run before release.

## JavaScript Runtime Dependencies

| Package | Version | Licence |
| --- | --- | --- |
| `@jspsych/plugin-html-button-response` | `2.1.0` | MIT |
| `@jspsych/plugin-html-keyboard-response` | `2.1.0` | MIT |
| `@tauri-apps/api` | `2.11.0` | Apache-2.0 OR MIT |
| `@tauri-apps/plugin-dialog` | `2.7.1` | MIT OR Apache-2.0 |
| `@tauri-apps/plugin-fs` | `2.5.1` | MIT OR Apache-2.0 |
| `jspsych` | `8.2.3` | MIT |

## JavaScript Development Dependencies

| Package | Version | Licence |
| --- | --- | --- |
| `@eslint/js` | `9.39.1` | MIT |
| `@tauri-apps/cli` | `2.11.1` | Apache-2.0 OR MIT |
| `@types/node` | `25.6.0` | MIT |
| `eslint` | `9.39.1` | MIT |
| `typescript` | `5.9.3` | Apache-2.0 |
| `typescript-eslint` | `8.59.2` | MIT |
| `vite` | `8.0.16` | MIT |
| `vitest` | `4.1.5` | MIT |

## Rust and Tauri Direct Dependencies

| Package | Version Requirement | Licence | Role |
| --- | --- | --- | --- |
| `base64` | `=0.22.1` | MIT OR Apache-2.0 | Encoding helper used by the Tauri shell |
| `tauri` | `=2.11.1` | Apache-2.0 OR MIT | Desktop application shell |
| `tauri-build` | `=2.6.1` | Apache-2.0 OR MIT | Tauri build helper |
| `tauri-plugin-dialog` | `=2.7.1` | Apache-2.0 OR MIT | Native file and folder dialogs |
| `tauri-plugin-fs` | `=2.5.1` | Apache-2.0 OR MIT | Local filesystem access for Tauri workflows |

The full Rust transitive dependency graph is locked in `src-tauri/Cargo.lock`.
Maintainers should review the locked Rust dependency graph and update
`THIRD_PARTY_NOTICES.md` when dependency licences or bundled dependency
provenance change.

## Bundled Project Assets

The public fixture CSV files and placeholder object image assets under
`public/assets/examples/` are project-authored examples for OPJRD. They are not
copied from private support materials.

The app icon source is `src-tauri/icons/opjrd-icon.svg`. Desktop icon assets in
`src-tauri/icons/` are generated from that source. Generated Android and iOS
icon directories are intentionally not kept because OPJRD is not targeting
mobile apps.

Locale files under `public/locales/` are project-authored OPJRD interface
strings.

## JATOS

The JATOS integration targets JATOS 3.10.x and has passed pilot-style testing
on JATOS 3.10.5. OPJRD does not bundle JATOS or `jatos.js`; `dist/jatos.html`
loads `jatos.js` from the JATOS server at runtime. JATOS deployment therefore
has a runtime server dependency rather than an npm or Cargo dependency.

## Upgrade Process

When upgrading dependencies:

- update the pinned version in the relevant manifest
- refresh the corresponding lockfile
- rerun unit and golden-output tests
- rerun browser and Tauri smoke tests when runtime behaviour can be affected
- update `THIRD_PARTY_NOTICES.md` when licences, dependency names, or bundled
  assets change
