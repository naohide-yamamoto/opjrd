# Browser-First Architecture

OPJRD uses a browser-first architecture. The experiment core runs in an ordinary browser and is wrapped by deployment-specific adapters for desktop and future hosted workflows.

## Packages

The repository structure keeps the experiment core separate from deployment-specific code:

- `src/core/` contains configuration, parsing, geometry, scoring, timing, and trial-model logic.
- `src/modes/` selects task-mode-specific jsPsych timeline entries.
- `src/i18n/` loads participant-facing locale files.
- `src/data/` owns session metadata and save adapters.
- `src/runtime/` owns deployment-runtime adapters such as fullscreen handling.
- `src-tauri/` contains the Tauri desktop shell.
- `public/assets/examples/` contains redistributable fixture experiments.
- `public/locales/` contains participant-facing strings.

The Tauri desktop shell should stay thin. Its role is to provide the desktop window, local file access, packaging, and local save conveniences without duplicating experiment logic.

The macOS packaging path builds a universal app by default so the same `.app`
can run on Apple Silicon and Intel Macs. Public macOS packages should be signed
and notarised before distribution. DMG creation is available as an optional
build script, and release DMG signing, notarisation, stapling, and Gatekeeper
verification are maintainer release tasks.

## Deployment Adapters

The browser core should not care whether it is running in:

- a static browser pilot
- the Tauri desktop shell
- a JATOS deployment

Save behaviour is therefore routed through internal adapters. JSON session
output is mandatory. CSV export is optional and controlled by configuration.
The public `save.destination` setting is `local` by default: browser runs use
browser downloads, while Tauri desktop runs automatically use the Tauri local
save adapter, which asks the user to choose an output folder and writes the
generated JSON and optional CSV files there. The public `jatos` destination is
handled by the JATOS adapter. It submits the JSON session envelope as JATOS
result data, uploads generated JSON/CSV result files when the runtime exposes
result-file upload, and fails clearly if `jatos` is selected without an
available JATOS runtime rather than falling back to local saving.

After a successful save, OPJRD shows a post-save screen rather than leaving the
participant at a dead end. From there the user can start another session with
the same config or choose a different config. Browser runs use a config path or
URL entry field for different configs. Tauri local-config runs use the native
config picker for different local configs and additionally offer a return to the
app's initial launcher screen.

## Runtime Metadata

OPJRD owns session/runtime metadata in the browser core so that browser, Tauri,
and JATOS output can share one JSON session envelope. Browser runtime metadata is
best-effort because browsers deliberately reduce or normalise some values for
privacy and compatibility. The implementation therefore records source fields
for derived operating-system and browser versions.

In Chromium browsers, OPJRD requests high-entropy User-Agent Client Hints during
session finalisation. When available, these values provide fuller browser
versions, operating-system versions, CPU architecture, bitness, and the
User-Agent Client Hints platform. The raw `navigator.platform` value is still
exported separately for auditability and may report compatibility values such as
`MacIntel` on Apple Silicon Macs.

## Trial Surface

jsPsych remains responsible for trial sequencing and final data collection, but OPJRD keeps its canvas trial surface mounted outside jsPsych's cleared display element during a task block. The mode plugins reuse that surface across trials and render the inter-trial interval as a neutral canvas state instead of inserting a separate blank DOM trial. The canvas is fully redrawn for each frame; static/dynamic canvas layers can be added if profiling or manual testing shows a need.

## Fullscreen Handling

Trial fullscreen handling is routed through `src/runtime/fullscreen.ts`. The browser adapter uses the browser Fullscreen API on a best-effort basis: if the request is unavailable or rejected, the trial continues. The Tauri adapter uses Tauri window-level fullscreen commands when OPJRD runs inside the desktop shell. After the ready-screen space-bar response, OPJRD can apply `timing.firstTrialStartDelayMsec` before the first trial starts so fullscreen transitions can settle before response content appears. Each trial start re-enters fullscreen when the runtime allows it, so if a participant exits fullscreen during a trial, OPJRD attempts to restore fullscreen at the next trial. Before the final save screen is displayed, OPJRD exits fullscreen through the same adapter so saving and post-save controls run outside trial fullscreen. Browser fullscreen still cannot fully suppress operating-system edge affordances such as the macOS menu bar or Dock when the system cursor reaches the top or bottom of the desktop.

Browser-core trial code calls the shared fullscreen adapter; only the runtime adapter module depends on the Tauri JavaScript API. The Tauri save adapter follows the same boundary rule: session construction and filename generation remain in the browser core, while the desktop adapter owns only the native folder picker and filesystem write calls.

Local experiment loading follows the same pattern. Browser runs load
`config.json`, `locations.csv`, `trials.csv`, and configured stimulus images
from URLs resolved relative to the config URL. Tauri runs without an explicit
`?config=...` URL override first ask the user to choose a local config file. A
narrow backend command then reads the selected config and related files from
inside that config folder. Text and CSV files are returned as strings; image
assets are returned to the browser core as data URLs. This avoids granting broad
frontend filesystem read access while keeping local assets relative to the
selected experiment config folder.

JATOS loading uses a separate HTML entry, `jatos.html`, so ordinary browser runs
do not load `jatos.js`. The JATOS entry loads the server-provided JATOS runtime,
waits for `jatos.onLoad()`, and then starts the same main OPJRD application. A
JATOS component or study input can provide `configPath`, an embedded `config`
object, or both. If `configPath` is supplied, OPJRD records a non-identifying
`jatos:` config label in session output instead of exporting the full server
URL.

Current public platform support is recorded in `docs/platform-support.md`.

Desktop packaging instructions are recorded in `docs/desktop-packaging.md`.

## Configuration

JSON configuration is the canonical representation of experiment settings. The GUI settings editor must read and write this same model rather than inventing a second source of truth.

The config model includes:

- `taskMode`, defaulting to `object_placement`
- `locale`
- `locationsFile`
- `trialsFile`
- `zeroDirection`
- shared timing settings
- shared trial-start gate settings
- object-placement response settings
- response-interface dimensions
- per-mode response canvas shape, size or dimensions, and visible surface
- stimulus rendering settings for text labels or per-object local image assets
- save destination
- optional CSV export
- optional participant-metadata provider settings

Participant metadata is collected before jsPsych starts a session. This keeps
filename generation, JSON session output, and wide CSV participant columns in
one shared path. The `form` participant-metadata provider uses OPJRD's built-in
participant form in browser, Tauri, and JATOS runs, feeding the same
`participant_metadata` block rather than creating deployment-specific output
schemas.

The config contract is documented in `docs/config-schema.md`. The JSON and CSV output contract is documented in `docs/output-schema.md`.

The Tauri GUI settings editor is a desktop launch-screen workflow. It can
create a config from defaults or load an existing local config, expose common
routine settings through form controls, validate required and bounded fields, and
save ordinary JSON through the same config model. New local configs first choose
an experiment config folder, validates CSV and image paths relative to that
selected folder before the config exists, and suggests `config.json` when
saving. For stimulus images, the editor exposes the canonical
`response.stimuli.images` map as editable object rows and uses a native image
picker plus typed-path validation when a local config folder is known.
Experiment runs use strict config loading, and edited configs are also passed
through strict config loading before they can be saved. The editor uses a
separate draft-loading path for existing configs so recoverable field-level
problems, such as unsupported file extensions, zero-length `zeroDirection`
vectors, blank required paths, and invalid numeric bounds, can be corrected in
the form instead of preventing the editor from opening. The editor additionally
validates the existence of typed image, `locationsFile`, and `trialsFile` paths
when a local config folder is known. It is intentionally not a second runtime
format.

## Stimulus Rendering

Browser trials use procedural canvas rendering for support labels and either text or image rendering for object symbols. Text labels remain the default. When `response.stimuli.mode` is `image`, OPJRD preloads configured per-object image assets before trials begin and draws the image for matching object names. Objects without configured images fall back to text. This choice does not change trial timing, geometry, scoring, or output semantics.

## Dependency Policy

Runtime dependencies are pinned in `package.json`; Tauri Rust dependencies are pinned in `src-tauri/Cargo.toml`. No core library should be fetched from a CDN at runtime.
