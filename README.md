# Object Placement and Judgement of Relative Direction Program (OPJRD)

**Object Placement and Judgement of Relative Direction Program (OPJRD)** is a browser-first spatial-memory application for running object-placement and judgement-of-relative-direction tasks from one shared experiment core.

## Task Structure and A/B/C Wording

OPJRD is designed for spatial-memory tasks in which participants first learn a
layout of named objects. On each trial, they are asked to imagine standing at
one object, facing a second object, and then indicate the position or direction
of a third object. When they indicate the position, it is called an object
placement task; when they indicate the direction only, it is called a judgement
of relative direction (JRD) task, which has been widely used in the spatial
memory literature.

OPJRD presents those three role objects as A, B, and C. A is the object where
the participant imagines standing, B is the object they imagine facing, and C is
the target object they place in object-placement mode or point to in JRD mode.
This shorthand appears throughout the app, config, data, and documentation. For
example, 'A-B response distance' in settings is the distance between the A and B
role objects as displayed on a trial interface.

## Current Status

The current release scope is macOS browser use in recent Chrome, Safari, and
Firefox, Windows browser use in recent Chrome, Edge, and Firefox, plus a signed
and notarised packaged macOS app. The macOS packaged app has been tested on
Apple Silicon and Intel Mac. The current browser core includes:

- current config, output, timing, geometry, and scoring documentation
- a Vite and jsPsych browser core
- JSON configuration loading
- locale loading with `en-AU` defaults
- shared trial-timing definitions
- shared geometry and scoring modules
- browser-first object-placement and JRD trial plugins
- a Tauri desktop shell
- a runtime fullscreen adapter with browser and Tauri implementations
- a Tauri local-save adapter that writes generated JSON and optional CSV files
  to a user-selected folder
- a Tauri local config/file-loading adapter that resolves experiment files from
  the selected config folder
- an initial Tauri GUI settings editor that creates and edits ordinary JSON
  config files
- a post-save screen for starting another session, selecting a different config,
  and, in the Tauri local-config workflow, returning to the initial screen
- optional per-object local image stimulus assets, with text labels as the
  default and fallback rendering mode
- row-based stimulus image selection in the Tauri GUI settings editor
- participant metadata collection through `none`, `form`, `url`, and `manual`
  providers, with JATOS kept internal
- fixture experiment assets
- automated tests for imagined headings, canonical transforms, scoring, and timing
- local browser download, Tauri local save, and a JATOS-oriented save-adapter
  path that is not publicly supported yet

## Development

```sh
npm install
npm run dev
npm test
npm run build
```

The initial Tauri shell can be started with:

```sh
npm run tauri:dev
```

This requires the normal Tauri system prerequisites, including Rust/Cargo. The
Tauri shell runs the same Vite/jsPsych app and adds the desktop window boundary,
Tauri-backed fullscreen handling, and local saving through a native output-folder
picker. Stop any existing Vite server on port `5173` before running this command,
because the Tauri dev command starts the frontend dev server itself.

When the Tauri shell is launched without a `?config=...` URL override, it shows a
native picker for choosing an experiment `config.json`. `locationsFile`,
`trialsFile`, and later local asset paths are resolved relative to the selected
config file's folder. The session output stores a non-identifying
`tauri-local:<filename>` config label rather than the full local machine path.
Experiment folders intended for Tauri local loading should be self-contained.
The same launch screen includes an initial GUI settings editor for creating a
new config or editing common settings from an existing config. In Tauri, `New
config` first asks for the experiment config folder. The editor then validates
local CSV and image paths relative to that selected folder and suggests
`config.json` when saving. Saved editor output is still ordinary JSON.

For packaged macOS testing, OPJRD uses a universal macOS build so the same app
can run on Apple Silicon Macs and Intel Macs. Install both macOS Rust targets
and build the desktop package with:

```sh
rustup target add aarch64-apple-darwin
rustup target add x86_64-apple-darwin
npm run tauri:build:mac
```

More detail is in `docs/desktop-packaging.md`.

The default fixture config is served from:

```text
public/assets/examples/basic/config.json
```

To pilot a different config in the browser, pass it as a query parameter:

```text
/?config=/assets/examples/basic/config.json
```

The included JRD fixture can be opened with:

```text
/?config=/assets/examples/jrd/config.json
```

Current trials render object symbols as canvas-drawn text with configurable font family, size, and colour by default. They can also use configured per-object local image assets, resolved relative to the experiment config folder, while preserving text labels as the fallback.

## Documentation

- `docs/user-guide.md`: running OPJRD and preparing experiment folders
- `docs/developer-guide.md`: development workflow and release hygiene
- `docs/config-schema.md`: canonical JSON config contract
- `docs/output-schema.md`: canonical JSON and CSV output contract
- `docs/trial-timing-model.md`: shared timing model
- `docs/desktop-packaging.md`: macOS Tauri packaging notes
- `docs/release-checklist.md`: public release preparation checklist
- `docs/platform-support.md`: current public platform support and known limits
- `docs/dependencies.md`: pinned dependencies and provenance notes
- `THIRD_PARTY_NOTICES.md`: direct third-party notices and bundled asset provenance

## Design Principles

- Keep the experiment core browser-pure.
- Use pinned, project-managed dependency versions.
- Keep JSON configuration as the canonical source of experiment settings.
- Keep the GUI settings editor aligned with the same JSON configuration model.
- Design save and deployment adapters early, including a future JATOS path, without exposing public JATOS workflows before they are minimally functional.

## Acknowledgements

OPJRD uses jsPsych (de Leeuw et al., 2023) for browser-based experiment sequencing and response-data
collection.

OPJRD's circle-and-rod interface for the JRD task was modelled on a custom-written program that was used by Amy Shelton and Timothy McNamara (Shelton & McNamara, 1997). Christopher Nolan later refined this interface, and OPJRD has adopted that refined version.

Development of OPJRD has been assisted by AI coding agents. All design decisions, code changes, tests, documentation, and releases remain under the responsibility of Naohide Yamamoto.

## Citation

If you use OPJRD in academic work, please cite it as:

> Yamamoto, N. (2026). _Object Placement and Judgement of Relative Direction Program_ (Version 0.1.2) [Computer software]. [https://github.com/naohide-yamamoto/opjrd](https://github.com/naohide-yamamoto/opjrd)

In addition, because OPJRD uses jsPsych, please cite de Leeuw et al. (2023) as well.

## References

de Leeuw, J.R., Gilbert, R.A., & Luchterhandt, B. (2023). jsPsych: Enabling an open-source collaborative ecosystem of behavioral experiments. _Journal of Open Source Software_, _8_(85), Article 5351. [https://doi.org/10.21105/joss.05351](https://doi.org/10.21105/joss.05351)

Shelton, A. L., & McNamara, T. P. (1997). Multiple views of spatial memory. _Psychonomic Bulletin & Review_, _4_(1), 102–106. [https://doi.org/10.3758/BF03210780](https://doi.org/10.3758/BF03210780)
