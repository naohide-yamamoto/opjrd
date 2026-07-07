# Release Checklist

This checklist is for maintainers preparing a public OPJRD release. It should be
completed before tagging a release or attaching packaged artefacts.

## Scope Check

- Confirm the release version in `package.json`, `src-tauri/Cargo.toml`, and
  `CITATION.cff`.
- Confirm the public support scope in `docs/platform-support.md`.
- Confirm the JATOS support statement matches the current JATOS validation
  status.
- Confirm the release remains compatible with OPJRD's free and open-source
  distribution model under the MIT licence, including dependency licences and
  bundled asset redistribution rights.
- Confirm the release notes match the tested support scope.

## Automated Checks

Run these checks from the public project root:

```sh
npm test
npm run build
npm run lint
```

If `npm run lint` is not run, run the privacy scan separately:

```sh
npm run privacy:scan
```

For macOS desktop release candidates, also build the universal app:

```sh
npm run tauri:build:mac
```

For a distributable macOS package, follow `docs/desktop-packaging.md` for DMG
creation, signing, notarisation, stapling, checksum generation, and Gatekeeper
verification.

If notarisation or stapling changes the DMG after the build command writes the
checksum, regenerate the checksum before uploading release artefacts:

```sh
npm run release:checksum:mac-dmg
```

## Manual Smoke Tests

Run at least one object-placement session and one JRD session in each supported
runtime being claimed for the release.

For each runtime, check:

- app launch or browser startup
- config loading
- participant metadata form when enabled
- fullscreen entry and restoration
- trial start gate
- object-placement drag and finalisation
- JRD rod movement and click finalisation
- local JSON saving
- optional CSV saving
- post-save navigation

## Privacy and Local-Machine-Detail Review

Before release, review public files for:

- participant data
- secrets, tokens, credentials, or private server URLs
- local machine paths
- unpublished manuscripts or private notes
- third-party PDFs, images, datasets, or code without confirmed redistribution
  rights

Use generic relative paths in documentation and examples.

## Screenshot and Output Sanitisation

If screenshots, videos, example outputs, or release notes are published, confirm
they do not include:

- participant identifiers or demographic values from real participants
- local usernames or absolute local paths
- private folder names
- unreviewed config values from real studies
- unsupported platform claims

Example JSON/CSV outputs should use fixture or synthetic data only.

## Public Documentation Review

Review public documentation for:

- current-state wording rather than internal development history
- documented config and output fields matching the implementation
- clear statements of unsupported or pending workflows
- no references to material that is not in the public repository

The public documentation index in `README.md` should link to the main user,
developer, config, output, platform-support, packaging, dependency, and release
documents.

## Known Limitations and Deferred Validation

Before release, confirm that known limitations are documented in
`docs/platform-support.md` and release notes. For the current validated
baseline, the public limitations are:

- macOS Chrome, Safari, and Firefox browser workflows have passed smoke testing
  in the current development baseline.
- Windows Chrome, Edge, and Firefox browser workflows have passed smoke testing
  in the current development baseline.
- The packaged macOS app has been tested on Apple Silicon and Intel Mac.
- Windows packaged apps are not supported.
- Linux browser workflows are not supported.
- Linux packaged apps are not supported.
- JATOS deployment has passed pilot-style testing on JATOS 3.10.5 with the
  validated macOS and Windows desktop browser set; repeat representative JATOS
  smoke testing when the target server or participant browser set changes.
- Mobile platforms are not supported.

Do not claim support for a platform, browser, or deployment workflow until both
task modes have passed a representative smoke test there.
