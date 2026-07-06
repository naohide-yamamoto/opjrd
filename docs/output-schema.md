# Output Schema

JSON is OPJRD's canonical output. CSV is an optional secondary export.

## JSON Session Envelope

Each JSON session contains:

- `session_id`
- `app_name`
- `app_version`
- `experiment_name`
- `task_mode`
- `locale`
- `timestamp_iso`
- `timestamp_local`
- `config_path`
- `config_hash`
- `zero_direction`
- `runtime`
- `participant_metadata`
- `rows`

`config_path` records the config source used for the session. Browser runs store
the loaded config URL. Tauri local-config runs store a non-identifying label such
as `tauri-local:config.json`; OPJRD deliberately does not export the full local
machine path.

`runtime` contains the core-owned runtime metadata:

- `runtime_environment`
- `operating_system_name`
- `operating_system_version`
- `operating_system_version_source`
- `browser_name`
- `browser_version`
- `browser_version_source`
- `browser_engine`
- `webview_or_browser_version`
- `user_agent`
- `platform`
- `architecture`
- `architecture_source`
- `bitness`
- `user_agent_data_platform`
- `user_agent_data_platform_version`
- `user_agent_data_mobile`
- `browser_language`

`platform` is the raw browser-reported `navigator.platform` value. It is kept
for auditability, but it should not be interpreted as CPU architecture. For
example, Chromium browsers on Apple Silicon Macs may report `MacIntel`.

When available, OPJRD asks Chromium browsers for high-entropy User-Agent Client
Hints and uses them to harden runtime metadata. In those cases:

- `operating_system_version` is taken from `user_agent_data_platform_version`
  and `operating_system_version_source` is `user_agent_data`.
- `browser_version` and `webview_or_browser_version` are taken from the full
  User-Agent Client Hints browser version and `browser_version_source` is
  `user_agent_data`.
- `architecture` and `bitness` are populated from User-Agent Client Hints.

If the browser does not expose these values, OPJRD falls back to the ordinary
user-agent string where possible. The corresponding source fields are then
`user_agent`, or `null` when no reliable source is available.

`user_agent_data_mobile` is recorded only as browser-provided runtime metadata.
It does not indicate OPJRD mobile-platform support. Supported desktop runs should
normally record `false` when this value is available, or `null` when the runtime
does not expose User-Agent Client Hints.

`participant_metadata` contains:

- `provider`
- `values`

Participant metadata is optional. The `values` object may be empty.

Implemented participant-metadata providers are:

- `none`: records an empty `values` object.
- `form`: shows OPJRD's built-in participant metadata form before the ready
  screen in browser, Tauri, and JATOS runs, and records the entered values.
- `url`: reads configured URL query parameters, or `participant_id`,
  `participantId`, and `pid` by default.
- `manual`: records primitive values from `participantMetadata.manualValues`.
- `jatos`: records primitive values exposed by the JATOS runtime.

When the `form` provider uses the default `participantMetadata.fields`, the form
collects `participant_id` labelled `ID`, `age`, `gender`, and `condition`. `age`
is exported as a number. Ordinary radio and drop-down options export the
selected visible label. Free-text radio options export the participant-entered
text instead of the option label.

The `jatos` provider reads primitive values from JATOS study input, study
session data, batch session data, URL query parameters, and component input.
Objects and arrays are ignored.

`rows` contains canonical OPJRD trial rows only. Runtime/plugin bookkeeping fields such as `opjrd_row`, `stage`, `trial_type`, `trial_index`, `time_elapsed`, and `internal_node_id` are internal and are removed before JSON or CSV export.

## Shared Trial Row Fields

Every trial row includes:

- `task_mode`
- `trial_id`
- `location`
- `direction`
- `target`
- `latency_start_event`
- `a_onset_msec`
- `b_onset_msec`
- `c_onset_msec`
- `response_finalisation_msec`
- `resp_latency_msec`
- `trial_start_gate_enabled`
- `trial_gate_warning_shown`
- `imagined_heading`
- `imagined_heading_deg`

Mode-specific response and scoring fields are added to these shared fields.
When the trial start gate is enabled, `a_onset_msec` is also the elapsed time
from start-button appearance to the button click, so OPJRD does not export a
separate gate-latency field.

## Object-Placement Row Fields

Object-placement rows include at least:

- `true_x`
- `true_y`
- `placed_x`
- `placed_y`
- `true_angle`
- `true_angle_deg`
- `placed_angle`
- `placed_angle_deg`
- `angular_error_signed`
- `angular_error_signed_deg`
- `angular_error_absolute`
- `angular_error_absolute_deg`
- `true_distance`
- `placed_distance`
- `distance_error_signed`
- `distance_error_absolute`
- `position_error_euclidean`
- `c_initial_x`
- `c_initial_y`
- `c_moved`
- `movement_count`
- `finalisation_attempts`
- `blocked_finalisation_attempts`
- `finalisation_key`
- `move_required_warning_shown`

`finalisation_key` stores an analysis-friendly key label rather than a raw invisible key value. The space bar is exported as `space`.

## JRD Row Fields

JRD rows include at least:

- `true_angle`
- `true_angle_deg`
- `estimated_angle`
- `estimated_angle_deg`
- `angular_error_signed`
- `angular_error_signed_deg`
- `angular_error_absolute`
- `angular_error_absolute_deg`
- `pointer_x`
- `pointer_y`
- `pointer_moved`
- `finalisation_method`

## CSV Export

CSV export is enabled by `save.csvEnabled`.

JSON and CSV filenames use `save.filenameTemplate`. The default filename stem
is `{experimentName}_{participant_id}_{session_id}`. Only documented filename
tokens can be used; unsupported tokens are rejected before the experiment
starts. In filename templates, `{timestamp}` is a compact local-environment
timestamp formatted as `YYYYMMDD-HHMMSS`, and `{session_id}` uses the first
eight alphanumeric characters of the full session ID. If no participant
identifier is available in participant metadata, `{participant_id}` is rendered
as `no_participant_id`; if no condition is available, `{condition}` is rendered
as `no_condition`; if no group is available, `{group}` is rendered as
`no_group`.

With the default `save.destination` value of `local`, ordinary browser runs save
these files through browser downloads. In the Tauri desktop shell, OPJRD asks
the user to choose an output folder and then writes the generated JSON and
optional CSV files into that folder. The JSON session envelope and wide CSV rows
are the same across these internal save adapters. The `jatos` destination
submits the same JSON session envelope as JATOS result data. When JATOS
result-file upload is available, OPJRD also uploads the generated JSON result
file and the generated CSV result file when `save.csvEnabled` is `true`.

CSV uses one wide row per trial. It includes:

- participant metadata values, repeated on each row
- trial row fields

CSV does not repeat session metadata such as app version, runtime details, config hash, or timestamp.

If a participant metadata key collides with a trial row key, OPJRD prefixes the participant metadata column with `participant_`.
