# JATOS Deployment

This document describes OPJRD's JATOS integration path for validation and
deployment. JATOS support should be smoke-tested on the target server before it
is advertised as supported for a study.

## Target Runtime

The JATOS integration targets the JATOS 3.10.x `jatos.js` API. OPJRD uses
JATOS as a runtime adapter rather than bundling JATOS itself.

## Build Output

Build OPJRD from the project root:

```sh
npm run build
```

The production build creates both:

- `dist/index.html` for ordinary browser and Tauri-webview use
- `dist/jatos.html` for JATOS components

Use `jatos.html` as the component HTML file in JATOS. It loads `jatos.js`, waits
for `jatos.onLoad()`, and then starts the same OPJRD browser-first experiment
core used by ordinary browser and Tauri runs.

## Config Input

The recommended JATOS component input is:

```json
{
  "configPath": "assets/examples/basic/config.json"
}
```

`configPath` is resolved relative to the JATOS component page. The referenced
`config.json`, `locations.csv`, `trials.csv`, and stimulus image files should
be included in the study assets.

For simple validation runs, a config object may also be embedded directly:

```json
{
  "configPath": "assets/examples/basic/config.json",
  "config": {
    "experimentName": "OPJRD JATOS validation",
    "taskMode": "object_placement",
    "locationsFile": "locations.csv",
    "trialsFile": "trials.csv",
    "save": {
      "destination": "jatos"
    }
  }
}
```

When `config` is embedded, `configPath` is still useful because relative CSV and
image paths are resolved against it. If `configPath` is omitted, relative paths
are resolved against the component page.

If neither `configPath` nor `config` is supplied, OPJRD falls back to its normal
browser config path.

## Saving

Set:

```json
{
  "save": {
    "destination": "jatos"
  }
}
```

With `destination: "jatos"`, OPJRD submits the JSON session envelope as JATOS
result data. When JATOS result-file upload is available, OPJRD also uploads the
same JSON session as a `.json` result file and uploads the wide `.csv` result
file when `save.csvEnabled` is `true`.

After a successful JATOS save, OPJRD asks JATOS to end the study without
redirecting when the runtime exposes that function. This lets OPJRD show its
final saved-status screen while marking the JATOS run complete.

If `destination` is `jatos` outside a JATOS runtime, OPJRD fails clearly instead
of falling back to local saving. If CSV export is enabled but JATOS result-file
upload is unavailable, OPJRD also fails clearly before submitting partial data.

## Participant Metadata

`participantMetadata.provider` may still be `form`, `url`, `manual`, or `none`
in JATOS runs.

When it is set to `jatos`, OPJRD records primitive metadata values from these
JATOS sources:

- study input
- study session data
- batch session data
- URL query parameters exposed by JATOS
- component input

Objects and arrays are ignored as participant metadata values. This means an
embedded `config` object in component input is not copied into
`participant_metadata.values`.

## Validation Checklist

Before using JATOS for a real study, smoke-test at least:

- config loading from `configPath`
- participant metadata collection
- object-placement mode
- JRD mode
- JSON result-data submission
- JSON result-file upload
- CSV result-file upload when `save.csvEnabled` is `true`
- final study-completion behaviour in the JATOS result table
