# Dependency Versions and Provenance

OPJRD uses pinned project-managed dependency versions. JavaScript dependencies
are pinned in `package.json` and locked in `package-lock.json`. Rust/Tauri
direct dependencies are pinned with exact `=` requirements in
`src-tauri/Cargo.toml` and locked in `src-tauri/Cargo.lock`.

Dependencies should be upgraded deliberately, with geometry, timing, output,
browser, and Tauri checks run before release.

The development and CI Node.js baseline is `26.13.0` LTS, recorded in `.nvmrc`.

## JavaScript Runtime Dependencies

| Package | Version | Licence |
| --- | --- | --- |
| `@jspsych/plugin-html-button-response` | `2.1.0` | MIT |
| `@jspsych/plugin-html-keyboard-response` | `2.1.0` | MIT |
| `@tauri-apps/api` | `2.11.0` | Apache-2.0 OR MIT |
| `@tauri-apps/plugin-dialog` | `2.7.2` | MIT OR Apache-2.0 |
| `@tauri-apps/plugin-fs` | `2.5.2` | MIT OR Apache-2.0 |
| `jspsych` | `8.2.3` | MIT |

## JavaScript Development Dependencies

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

## Rust and Tauri Direct Dependencies

| Package | Version Requirement | Licence | Role |
| --- | --- | --- | --- |
| `base64` | `=0.23.1` | MIT OR Apache-2.0 | Encoding helper used by the Tauri shell |
| `tauri` | `=2.11.1` | Apache-2.0 OR MIT | Desktop application shell |
| `tauri-build` | `=2.6.1` | Apache-2.0 OR MIT | Tauri build helper |
| `tauri-plugin-dialog` | `=2.7.2` | Apache-2.0 OR MIT | Native file and folder dialogs |
| `tauri-plugin-fs` | `=2.5.2` | Apache-2.0 OR MIT | Local filesystem access for Tauri workflows |

The full Rust transitive dependency graph is locked in `src-tauri/Cargo.lock`.
Maintainers should review the locked Rust dependency graph and update
`THIRD_PARTY_NOTICES.md` when dependency licences or bundled dependency
provenance change.

## Known Dependency Limitation

The Rust lockfile contains `glib 0.18.5`, which is affected by
[RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)
(`GHSA-wrw7-89jp-8q8g`). It enters through Tauri's Linux GTK/WebKit desktop
dependencies. It is not selected for either macOS architecture or the
`x86_64` Windows target. OPJRD's browser and JATOS builds do not bundle this Rust
dependency, including when those builds are used in a Linux browser.

The advisory is fixed in `glib 0.20.0` and later, but the current GTK/WebKit
dependencies require `glib 0.18`. A direct lockfile update to the patched
version is therefore incompatible with those requirements.

This remains an unresolved limitation of the unsupported Linux desktop path,
not a fixed vulnerability. Keep it visible in dependency reviews and reassess
it when the Tauri/GTK/WebKit dependencies or supported targets change. Resolve
it before distributing a supported Linux desktop app. This assessment does
not establish Linux browser support; see [Platform Support](platform-support.md).

## Automated Dependency Checks

Audit the npm lockfile, including development dependencies:

```sh
npm run audit:npm
```

For the macOS desktop dependency check, install the same audit tool used by CI:

```sh
cargo install cargo-audit --version 0.22.2 --locked
npm run audit:rust:mac
```

These checks require network access to the npm registry, crates.io, and the
RustSec advisory database. The Rust command audits the full lockfile and
fails on vulnerabilities, unsoundness notices, and yanked crates. Its only
advisory exception is `RUSTSEC-2024-0429`, described above. Before applying
that exception, it verifies that `glib` is absent from both locked macOS
dependency trees with `tauri/custom-protocol` enabled. If either graph cannot
be checked or includes `glib`, the check fails. The exception is printed in
the output and does not approve a Linux desktop release.

Unmaintained-crate notices remain visible but do not fail the check. The
current graph reports these for `proc-macro-error` and the `unic-*` crates.
Review them during dependency updates and before releases; a passing audit
does not mean all dependency-maintenance concerns have been resolved.

To review the full Rust report without the macOS exception, run:

```sh
cargo audit --file src-tauri/Cargo.lock --deny unsound --deny yanked
```

This command currently fails because of the unresolved `glib` advisory. Use
the full report when reviewing additional desktop targets, and remove the
exception when upstream dependencies allow a compatible fix.

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

The JATOS integration uses the JATOS 3.10.x API and has been tested on JATOS
3.10.5 and 3.11.3. Browser coverage for each server version is summarised in
[Platform Support](platform-support.md#jatos-deployment). OPJRD does not bundle
JATOS or `jatos.js`; `dist/jatos.html` loads `jatos.js` from the JATOS server at
runtime. JATOS deployment therefore has a runtime server dependency rather
than an npm or Cargo dependency.

## Upgrade Process

When upgrading dependencies:

- update the pinned version in the relevant manifest
- refresh the corresponding lockfile
- run the npm and Rust dependency audits, reviewing all exceptions and notices
- rerun unit and golden-output tests
- rerun browser and Tauri smoke tests when runtime behaviour can be affected
- update `THIRD_PARTY_NOTICES.md` when licences, dependency names, or bundled
  assets change
