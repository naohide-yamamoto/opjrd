# Config Schema

OPJRD uses JSON as the canonical settings representation. The GUI settings editor must read and write this same model.

This document describes the current config schema. Names are stable analysis/config tokens and should not be translated.

Config files should be saved as UTF-8 JSON. User-facing string values in
`config.json` may use any languages. This includes
fields such as `experimentName`, `response.trialStartGate.label`,
`response.trialStartGate.warningMessage`, and
`response.objectPlacement.moveRequiredWarningMessage`. OPJRD reads these values
as ordinary text and renders them directly.

The Tauri GUI settings editor edits common routine settings and writes
ordinary JSON config. It may expand omitted defaults when saving a file. For JRD
configs, the editor omits object-placement-specific settings from saved JSON.

## Top-Level Fields

- `appName`: application name recorded in output metadata as `app_name`. Defaults to `Object Placement and Judgement of Relative Direction Program`. It does not control the packaged app name, menu-bar name, browser page title, or experiment start-screen heading.
- `experimentName`: experiment name used in output filenames and session metadata.
- `taskMode`: `object_placement` or `jrd`. Defaults to `object_placement`.
- `locale`: locale file tag such as `en-AU` or `ja-JP`. The GUI settings editor lists locale JSON files bundled under `public/locales`; add a UTF-8 JSON file such as `ja-JP.json` there, then reload the dev server or rebuild the app so it appears in the dropdown.
- `locationsFile`: required non-empty `.csv` path to the locations file, resolved relative to the experiment config folder. It must use the `.csv` extension. The GUI settings editor also rejects missing files when a local config folder is known.
- `trialsFile`: required non-empty `.csv` path to the trials file, resolved relative to the experiment config folder. It must use the `.csv` extension. The GUI settings editor also rejects missing files when a local config folder is known.
- `zeroDirection`: non-zero vector defining the experimenter-defined 0-degree direction. If omitted, OPJRD uses `{ "x": 0, "y": 1 }`. If provided, both `x` and `y` are required finite numbers, and they must not form a zero-length vector.
- `randomiseTrials`: whether to randomise trial order.
- `timing`: shared timing settings.
- `response`: response-interface settings.
- `save`: output and save-adapter settings.
- `participantMetadata`: optional participant-metadata settings block. If omitted, OPJRD uses `provider: "none"` and does not collect participant metadata.

## Config Loading and Validation

Experiment runs use strict config loading and stop before trials begin when a
config contains invalid field values. The Tauri GUI settings editor can open an
existing config through a more tolerant draft-loading path for recoverable
field-level problems, such as unsupported file extensions, zero-length
`zeroDirection` vectors, blank required paths, invalid numeric bounds, and
unsupported filename-template tokens. Saving from the editor still uses strict
config loading, so these problems must be corrected before the edited config can
be written.

## Experiment Config Folder and Relative Paths

In ordinary browser runs, relative config paths resolve as browser URLs relative
to the loaded config URL. In Tauri desktop runs started without a `?config=...`
URL override, OPJRD asks the user to choose a local config file for running or
editing an existing config. For `New config`, OPJRD first asks the user to
choose the experiment config folder. The editor validates local CSV and image
paths relative to that selected folder and suggests `config.json` when saving.

`locationsFile`, `trialsFile`, and stimulus image paths are resolved inside the
experiment config folder. Tauri local paths must be relative and must stay inside
that folder. For this reason, distributable experiment folders should be
self-contained rather than relying on `../` paths to shared fixture files. The
recommended convention is to place local assets in an `assets/` folder next to
`config.json`, for example `assets/object-a.svg`.

## CSV Inputs

`locations.csv` must include:

- `location` or `name`
- `x`
- `y`

Location names must be non-empty and unique.

`trials.csv` must include:

- `trial_id` or `trialId`
- `location`
- `direction`
- `target`

Trial IDs must be non-empty and unique.

## Stimulus Rendering Settings

By default, trials render object symbols as canvas-drawn text labels.
Object-label typography is configurable through `response.text.objectLabels`.

OPJRD supports optional image-based object rendering through `response.stimuli`.
The default mode is `text`. When `mode` is `image`, OPJRD uses any image path
configured for the current object name and falls back to the text label for
objects without a configured image path.

Configured image paths must use supported image file extensions (`.svg`, `.png`,
`.jpg`, `.jpeg`, `.webp`, `.gif`, or `.bmp`) and must load successfully.

## Timing

```json
{
  "timing": {
    "aToBDelayMsec": 1000,
    "bToCDelayMsec": 500,
    "latencyStartEvent": "a_onset",
    "interTrialIntervalMsec": 750,
    "firstTrialStartDelayMsec": 1000
  }
}
```

`latencyStartEvent` must be one of:

- `a_onset`
- `b_onset`
- `c_onset`

`a_onset` is the default.

Durations must be non-negative millisecond values.
`firstTrialStartDelayMsec` is a one-off delay between pressing the space bar on
the ready screen and starting the first trial. It gives browser fullscreen
transitions time to settle before object labels or the start gate are shown. Set
it to `0` when this settling delay is not needed.

## Response

```json
{
  "response": {
    "abDistance": 4,
    "layoutRadius": 6,
    "canvas": {
      "objectPlacement": {
        "shape": "circle",
        "sizePx": 760,
        "visible": true
      },
      "jrd": {
        "shape": "square",
        "sizePx": 760,
        "visible": true
      }
    },
    "trialStartGate": {
      "enabled": true,
      "label": "Start",
      "position": { "x": 0, "y": 0 },
      "widthPx": null,
      "heightPx": null,
      "warningEnabled": true,
      "warningDelayMsec": 5000,
      "warningMessage": "Please click the {label} button to begin a trial."
    },
    "feedback": {
      "colour": "#0b5fff",
      "durationMsec": 1000
    },
    "text": {
      "objectLabels": {
        "colour": "#101828",
        "sizePx": 48,
        "fontFamily": "\"IBM Plex Sans\", Inter, system-ui, sans-serif"
      },
      "supportLabels": {
        "colour": "#475467",
        "sizePx": 28,
        "fontFamily": "\"IBM Plex Sans\", Inter, system-ui, sans-serif"
      },
      "supportLabelOffsets": {
        "at": { "x": 0, "y": 1 },
        "facing": { "x": 0, "y": 1 },
        "place": { "x": 0, "y": 0.85 },
        "pointTo": { "x": 0, "y": 1 }
      }
    },
    "stimuli": {
      "mode": "text",
      "imageSizePx": 72,
      "images": {
        "A": "assets/object-a.svg",
        "B": "assets/object-b.svg",
        "C": "assets/object-c.svg"
      }
    },
    "objectPlacement": {
      "finalisationKey": "space",
      "requireMoveBeforeFinalise": true,
      "moveRequiredWarningMessage": "Move the target object before pressing the {finalisationKey}.",
      "cInitialPosition": { "x": 0, "y": 4.75 }
    }
  }
}
```

`abDistance` and `layoutRadius` must be positive numbers. `abDistance` is the displayed A-to-B distance in response-coordinate units.

`layoutRadius` is the shared radial extent, in response-coordinate units, used when OPJRD scales the trial layout. It is independent of the canvas shape configured below. In JRD mode, OPJRD draws the visible response circle at this radius and draws the accepted-response rod just beyond it. In object-placement mode, this radius is not visibly drawn and does not constrain placement; C is constrained by the configured object-placement canvas shape instead. Larger values can add visual margin or make objects appear closer together inside the canvas.

`canvas.objectPlacement` and `canvas.jrd` control the visible trial canvas surface for each task mode. `shape` must be `circle`, `square`, or `rectangle`; `visible` controls whether OPJRD draws the white canvas surface, border, and shadow. Setting `visible` to `false` keeps the trial canvas mounted and keeps stimuli visible, but removes the visible canvas surface. The current defaults are a visible circular object-placement canvas and a visible square JRD canvas.

For `circle` and `square`, `sizePx` is the side length or diameter in CSS pixels and must be positive. OPJRD normalises `widthPx` and `heightPx` to the same value internally. For `rectangle`, use `widthPx` and `heightPx` to set the maximum rendered dimensions in CSS pixels; if either is omitted, it falls back to `sizePx`.

Example rectangular canvas:

```json
{
  "shape": "rectangle",
  "widthPx": 900,
  "heightPx": 540,
  "visible": true
}
```

In object-placement mode, `canvas.objectPlacement.shape` also controls the placement boundary: circular canvases clamp C to the circular canvas edge, while square and rectangular canvases clamp C to the canvas edges. In JRD mode, the canvas shape controls the visible trial surface; the JRD response circle and click-to-accept logic are unchanged.

`trialStartGate` controls the optional trial-start button. The gate is enabled
by default. When enabled, the button appears at the beginning of each trial and
clicking it reveals object A. This standardises the system cursor's practical
starting location across trials before response latency can begin.

`trialStartGate.position` is expressed in response coordinates, with `{ "x": 0,
"y": 0 }` at the centre of the response canvas. `widthPx` and `heightPx` are
optional CSS-pixel dimensions; use `null` or omit them to let the browser size
the button as tightly as possible around its label. Keeping the button small
minimises the residual variability caused by participants being able to click
anywhere inside the button.

`trialStartGate.warningEnabled` controls whether OPJRD can show the
start-gate warning while the start gate itself remains enabled.
`trialStartGate.warningDelayMsec` controls how long OPJRD waits before showing a
start-gate warning when `warningEnabled` is `true`. `trialStartGate.warningMessage`
supports `{label}`, which OPJRD replaces with the configured button label.

Disabling `trialStartGate.enabled` streamlines trial execution by removing the
extra movement and click between trials. This is useful when response latency
will not be analysed or when the small non-systematic latency variability caused
by different system-cursor starting locations can be safely disregarded.

`feedback.colour` controls the colour used for accepted-response feedback in both modes. In object-placement mode, OPJRD draws the placed C label in this colour after a valid finalisation. In JRD mode, OPJRD draws the accepted rod in this colour after a valid click. `feedback.durationMsec` controls how long the accepted-response feedback is shown and must be non-negative. Set it to `0` to skip accepted-response feedback.

`text.objectLabels` controls canvas-drawn object labels such as A, B, and C. `text.supportLabels` controls canvas-drawn support labels such as `At`, `Facing`, `Place`, and `Point to`.

The response plugins use in-canvas support labels. The default `en-AU` locale provides `At`, `Facing`, `Place`, and `Point to`; translated locale files should provide equivalent `trial.atLabel`, `trial.facingLabel`, `trial.placeLabel`, and `trial.pointToLabel` strings.

Each text style has:

- `colour`: canvas text colour
- `sizePx`: font size in CSS pixels; must be positive
- `fontFamily`: CSS canvas font-family string, for example `"Arial, sans-serif"` or `"\"IBM Plex Sans\", Inter, system-ui, sans-serif"`

For non-Latin scripts, configure a font stack that includes fonts with the
required glyph coverage. For Japanese canvas labels, for example, use a stack
such as `"\"Hiragino Sans\", \"Yu Gothic\", \"Noto Sans JP\", system-ui, sans-serif"`.
Normal DOM text, such as start-gate and warning messages, also accepts
multilingual strings and will generally use browser font fallback.

`text.supportLabelOffsets` controls support-label positions relative to their object labels, in response-coordinate units. Positive `x` moves a support label right; positive `y` moves it up. The offsets are:

- `at`: relative to the location object label, A in the usual A/B/C wording
- `facing`: relative to the direction object label, B in the usual A/B/C wording
- `place`: relative to the current target object label in object-placement mode
- `pointTo`: relative to the target object label in JRD mode

The default offsets keep the English labels above their anchored object labels.

`stimuli.mode` controls object-symbol rendering. Supported values are:

- `text`: draw object names such as `A`, `B`, and `C` with `text.objectLabels`.
- `image`: draw configured image assets where available, falling back to text labels for objects without an image entry.

`stimuli.imageSizePx` is the maximum rendered width or height for an image stimulus, in CSS pixels. It must be a positive number. If omitted, it defaults to `72`. OPJRD preserves the image's aspect ratio and scales the image so its longer side equals `imageSizePx`. For example, with `imageSizePx: 72`, a `160 x 160` image renders as `72 x 72`, a `200 x 100` image renders as `72 x 36`, and a `100 x 200` image renders as `36 x 72`. OPJRD does not currently use original image dimensions as the rendered size.

`stimuli.images` maps object names to relative image paths, for example `"A": "assets/object-a.svg"`. The keys must match the object names used in `locations.csv` and `trials.csv`. When `stimuli.mode` is `"image"`, experiment runs reject unsupported image file extensions before trials begin. When editing an existing local config, the editor's image picker writes relative paths for selected image files inside the experiment config folder. When creating a new local config, the editor asks for the experiment config folder before the form opens, so the same image picker and typed-path validation are available immediately. If paths are typed directly, the editor rejects unsupported file extensions and, when a local config folder is known, missing files.

`cInitialPosition` applies only to `object_placement` mode. If omitted, it defaults to just above B at `(0, response.abDistance + 0.75)` in response coordinates.

`objectPlacement` may be omitted from JRD-mode config files; OPJRD still normalises an internal object-placement settings block so both modes share one internal config shape.

`finalisationKey` applies only to object-placement finalisation. Use `"space"` for the space bar. If provided explicitly, it must not be empty. OPJRD normalises this to the browser key value internally, displays it as `space bar` in warning messages, and exports it as `space` in JSON/CSV.

`moveRequiredWarningMessage` supports `{finalisationKey}`, which OPJRD replaces with the display label for the configured finalisation key.

## Save

```json
{
  "save": {
    "destination": "local",
    "csvEnabled": false,
    "filenameTemplate": "{experimentName}_{participant_id}_{session_id}"
  }
}
```

`destination` must be:

- `local`
- `jatos`

JSON output is always produced. CSV export is optional and controlled by `csvEnabled`.
The default `local` destination saves locally in the runtime-appropriate way:
ordinary browser runs use browser downloads, and the Tauri desktop shell asks
the user to choose an output folder before writing the generated JSON filename
and, when CSV export is enabled, the generated CSV filename into that folder.
The `jatos` destination is reserved for the JATOS workflow. Until that workflow
is publicly supported, OPJRD fails if `destination` is `jatos` but OPJRD
is not running inside an available JATOS runtime.

`filenameTemplate` controls the filename stem used for JSON and CSV output.
OPJRD appends `.json` and `.csv` after rendering and sanitising the stem. Only
the documented filename tokens below can be used; configs containing any other
token are rejected before the experiment starts.

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

`{participant_id}` is read from participant metadata using `participant_id`, `participantId`, or `pid`, in that order. If no participant identifier is available, OPJRD uses `no_participant_id`. `{condition}` is read from participant metadata using `condition`; if no condition is available, OPJRD uses `no_condition`. `{group}` is read from participant metadata using `group`; if no group is available, OPJRD uses `no_group`.

`{timestamp}` uses a compact local-environment timestamp formatted as `YYYYMMDD-HHMMSS`, for example `20260511-185430`. The hyphen separates date and time inside the timestamp field, while underscores separate different filename fields. `{timestamp_local}` uses the full local-environment timestamp saved in the JSON session. `{timestamp_iso}` uses the UTC ISO timestamp. `{session_id}` uses the first eight alphanumeric characters of the full session ID; `{session_id_full}` uses the complete session ID.

## Participant Metadata

```json
{
  "participantMetadata": {
    "provider": "none",
    "fields": [
      { "name": "participant_id", "label": "ID", "type": "text" },
      { "name": "age", "label": "Age", "type": "number" },
      {
        "name": "gender",
        "label": "Gender",
        "type": "radio",
        "options": [
          "Woman/Female",
          "Man/Male",
          "Non-binary",
          { "label": "Different term", "freeText": true },
          "Prefer not to say"
        ]
      },
      {
        "name": "condition",
        "label": "Condition",
        "type": "radio",
        "options": ["Condition 1", "Condition 2"]
      }
    ],
    "manualValues": {},
    "urlParameters": []
  }
}
```

`provider` must be one of:

- `none`
- `form`
- `url`
- `manual`
- `jatos`

`fields` is the ordered list of participant-metadata fields collected by the
interactive metadata provider, `form`. If it is omitted, OPJRD uses the default
field set shown above: `participant_id`, `age`, `gender`, and `condition`. Each
field must be an object with:

- `name`: the exported metadata key.
- `label`: the text shown beside or above the control in the participant form.
- `type`: one of `text`, `number`, `radio`, or `select`.
- `options`: required for `radio` and `select`, and omitted for `text` and
  `number`.

Field names become keys in `participant_metadata.values`, repeated CSV
participant-metadata columns, and filename-template participant-ID lookup when
the key is `participant_id`, `participantId`, or `pid`.

When `provider` is `form`, OPJRD shows its built-in participant metadata form
before the ready screen. The same provider is used in browser runs and in the
Tauri app; the runtime environment is recorded separately in `runtime`.

`text` fields are required free-text entries. `number` fields are required
whole-number entries greater than or equal to 0. `radio` fields render ordered
radio buttons. `select` fields render an ordered drop-down menu. Ordinary
`radio` and `select` options are written as strings, and OPJRD exports the
selected visible label as the saved metadata value.

For `radio` fields, an option may instead be an object with a required `label`
and optional `freeText` boolean. When an option has `"freeText": true`,
selecting it shows an adjacent text box, requires a participant-entered value,
and saves that entered value instead of the option label. Free-text options are
not supported for `select` fields.

`manualValues` may contain string, number, boolean, or null values. Nested objects and arrays are not allowed.

`urlParameters` is an optional list of URL query parameter names to collect when `provider` is `url`. If omitted, OPJRD checks `participant_id`, `participantId`, and `pid`.

The built-in participant form is shown only when the selected provider needs an
interactive form. Collection remains disabled by default because the default
provider is `none`; enable `form` only when participant metadata collection is
part of the experiment metadata plan.
