# User Guide

This guide is for running OPJRD experiments and preparing routine experiment
folders. Detailed configuration and output-field references are in
`docs/config-schema.md` and `docs/output-schema.md`.

## Current Support Scope

The current release support scope is macOS browser use in recent Chrome, Safari,
and Firefox, Windows browser use in recent Chrome, Edge, and Firefox, plus a
signed and notarised packaged macOS app. The packaged app has been tested on
Apple Silicon and Intel Mac.

The JATOS workflow is documented separately in `docs/jatos-deployment.md`. It
has passed initial smoke-testing on JATOS 3.10.5 with Chrome on macOS. Validate
it on the target JATOS server before using it for a real online study.

## Running OPJRD in a Browser

Install dependencies once from the public project root:

```sh
npm install
```

Start the browser development server:

```sh
npm run dev
```

Open the default object-placement fixture:

```text
http://127.0.0.1:5173/
```

Open the included JRD fixture:

```text
http://127.0.0.1:5173/?config=/assets/examples/jrd/config.json
```

Browser runs save data through browser downloads. JSON is always produced; CSV
is also produced when `save.csvEnabled` is `true`.

## Running OPJRD in JATOS

Build OPJRD with:

```sh
npm run build
```

Use `dist/jatos.html` as the JATOS component HTML file. The recommended JATOS
component input points to a config file included with the study assets:

```json
{
  "configPath": "assets/examples/basic/config.json"
}
```

Set `save.destination` to `jatos` in that config when JATOS should own the
result submission. See `docs/jatos-deployment.md` for the full workflow.

## Running OPJRD in the Tauri App

For development builds, start the Tauri app from the public project root:

```sh
npm run tauri:dev
```

The first screen lets you:

- run an experiment by selecting a `config.json`
- edit an existing config
- create a new config

Tauri runs write data through a native output-folder picker. If the folder
selection is cancelled, OPJRD returns to the save screen so the session can
still be saved.

## Experiment Config Folders

An experiment config folder is the folder that contains `config.json`.

In local Tauri workflows, `locationsFile`, `trialsFile`, and stimulus image
paths are resolved relative to this folder. A distributable experiment folder
should therefore be self-contained. A typical folder is:

```text
my-experiment/
  config.json
  locations.csv
  trials.csv
  assets/
    object-a.svg
    object-b.svg
    object-c.svg
```

In browser workflows, config and asset paths resolve as browser URLs relative
to the loaded config URL.

## Creating or Editing Configs

`config.json` is the canonical OPJRD settings file. It can be edited directly
or through the Tauri GUI settings editor.

The GUI editor is intended for common routine settings. When it opens an
imperfect existing config, it may allow recoverable problems to be corrected,
but saving is still strict. OPJRD will not write a config that fails validation.

When creating a new config in Tauri, OPJRD first asks for the experiment config
folder. This gives the editor enough context to validate CSV and image paths
against the folder before saving.

## Task Structure and A/B/C Wording

OPJRD experiments use object-placement and judgement-of-relative-direction task
structures. Participants first learn a spatial layout of named objects. Each
trial then asks them to imagine standing at one object, facing another object,
and placing or pointing to a target object.

OPJRD refers to these three trial roles as A, B, and C. A is the object at which
the participant imagines standing, B is the object they imagine facing, and C is
the target object they place in object-placement mode or point to in JRD mode.
These are role labels for the current trial, not necessarily the literal object
names from the layout.

The same shorthand appears in the app, config, data, and documentation. For
example, `aToBDelayMsec` means the delay between showing A and B, and "A-B
response distance" in the GUI settings editor means the displayed distance
between the A and B role objects.

## Location and Trial Files

`locations.csv` defines object names and layout coordinates. The expected
columns are:

```text
location,x,y
```

`trials.csv` defines the trials to run. The expected columns are:

```text
trial_id,location,direction,target
```

In these trial files, `location` supplies A, `direction` supplies B, and
`target` supplies C.

Every experiment must define `zeroDirection` in `config.json`. OPJRD uses this
experimenter-defined 0-degree direction to compute absolute headings, imagined
headings, and angular response measures. Anticlockwise rotation is positive,
and degree values are recorded in `[0, 360)` where appropriate.

## Trial Start Gate

The trial start gate is enabled by default. It shows a small `Start` button at
the beginning of each trial. Clicking the button reveals object A and gives the
system cursor a standardised practical starting location across trials.

This standardisation is not exact because participants can click anywhere
inside the button. Keeping the button small minimises that residual variation.

The start gate can be disabled when response latency will not be analysed, or
when the small non-systematic cursor-location variability can be safely
disregarded.

## Trial Interaction

In object-placement mode, participants drag the target object within the
configured response canvas and finalise the response with the configured
finalisation key. The default finalisation key is the space bar. If movement of
the target object is required before finalisation, OPJRD keeps the trial active
and shows the configured warning until the target object has been dragged.

In JRD mode, participants point by moving the pointer away from the centre of
the response canvas. The response line is hidden until the pointer has moved far
enough from the centre, and a click accepts the current rod direction. Keyboard
finalisation is not used in the JRD response interface.

## Participant Metadata

Implemented metadata providers are:

- `none`: records no participant metadata
- `form`: shows OPJRD's built-in metadata form in browser, Tauri, and JATOS runs
- `url`: reads configured URL parameters
- `manual`: records fixed primitive values from `config.json`
- `jatos`: records primitive values exposed by the JATOS runtime

The default form fields are ID, age, gender, and condition. Fields are
configured in `participantMetadata.fields`. Supported field types are `text`,
`number`, `radio`, and `select`.

For `radio` and `select` fields, ordinary options export the visible option
label. A free-text radio option exports the text entered by the participant
instead of the option label.

## Saving Data

`save.destination` is `local` by default. In browser mode, local saving means
browser downloads. In Tauri mode, local saving means writing to a user-selected
folder. In JATOS mode, `jatos` submits the JSON session envelope to JATOS and
can upload JSON/CSV result files when the JATOS runtime exposes result-file
upload.

The default filename template is:

```text
{experimentName}_{participant_id}_{session_id}
```

Only documented filename tokens can be used. Current tokens are:

- `{experimentName}`
- `{participant_id}`
- `{condition}`
- `{group}`
- `{timestamp}`
- `{timestamp_local}`
- `{timestamp_iso}`
- `{session_id}`
- `{session_id_full}`
- `{task_mode}`

If no participant ID, condition, or group is available, OPJRD uses
`no_participant_id`, `no_condition`, or `no_group`.

## Object Stimuli

OPJRD renders object labels as text by default. Image-based stimuli can be
enabled with `response.stimuli.mode` set to `image`.

Image paths are resolved relative to the experiment config folder in Tauri
local workflows. Supported image formats are `.svg`, `.png`, `.jpg`, `.jpeg`,
`.webp`, `.gif`, and `.bmp`. Objects without a valid configured image fall back
to text labels.

`response.stimuli.imageSizePx` controls image rendering size. When it is a
single number, OPJRD draws each image within that square while preserving the
image aspect ratio.

## Locales

Locale files live under:

```text
public/locales/
```

The `locale` value in `config.json` selects a locale file by name without the
`.json` extension, such as `en-AU` or `ja-JP`. If you add a new locale file,
reload the dev server or rebuild the app so the GUI editor can list it.

User-facing strings in `config.json` may be written in any language. For non-Latin scripts, make sure configured canvas fonts support the required glyphs. Config keys themselves should stay as documented OPJRD tokens.
