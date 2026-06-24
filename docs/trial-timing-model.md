# Shared Trial-Timing Model

Trial onset is the moment a trial becomes active. If the trial start gate is
enabled, trial onset is the appearance of the start button. If the gate is
disabled, trial onset is the moment object A first appears.

## Shared Raw Timing Fields

Each response mode records the same core timing fields:

- `a_onset_msec`: elapsed milliseconds from trial onset until object A appears.
- `b_onset_msec`: elapsed milliseconds from trial onset until object B appears.
- `c_onset_msec`: elapsed milliseconds from trial onset until object C appears and the response state begins.
- `response_finalisation_msec`: elapsed milliseconds from trial onset until the mode-specific final response action.
- `latency_start_event`: the configured event used to calculate the primary response latency.
- `resp_latency_msec`: `response_finalisation_msec` minus the selected latency-start time.
- `trial_gate_warning_shown`: whether the start-gate warning was shown.

The supported latency-start events are:

- `a_onset`, meaning object A onset.
- `b_onset`, meaning object B onset.
- `c_onset`, meaning object C onset and the beginning of the response state.

`a_onset` is the default. When the start gate is enabled, `a_onset` is the
earliest event that can be used as the response-latency start because object A is
not revealed until the button is clicked. In that case, `a_onset_msec` records
the elapsed time from start-button appearance to button click, so a separate
gate-latency field would be redundant and is not exported.

## Trial Start Gate

By default, OPJRD uses a trial start gate in both object-placement and JRD modes.
A small button appears at the beginning of each trial. Clicking it reveals object
A and sets `a_onset_msec`.

The gate is intended to standardise the system cursor's starting location across
trials. This is important for fair response-latency measurement, especially in
object-placement mode when the measured response latency includes time spent
moving to grab object C. The standardisation is not strict because participants
can click anywhere inside the button. For that reason, the default button is
sized as tightly as possible around the word `Start`, and researchers should keep
custom button sizes small unless there is a study-specific reason not to.

If the participant does not click the start gate within the configured warning
delay, OPJRD shows the configured start-gate warning at the same warning location
used by object-placement movement warnings. The default warning is `Please click
the {label} button to begin a trial.`

This warning can be disabled independently with
`response.trialStartGate.warningEnabled: false`. In that case the start gate
still appears, but OPJRD does not show the delayed prompt to click it and records
`trial_gate_warning_shown: false`.

The gate can be disabled with `response.trialStartGate.enabled: false`. This is
useful when cursor-start standardisation is not needed—for example, when
response latency will not be used for analysis or when small non-systematic
latency variability can be safely disregarded. Disabling the gate streamlines
trial execution by removing the extra mouse movement and click between trials.

## Mode-Specific Finalisation

In `object_placement` mode, OPJRD uses the same broad in-canvas feel as JRD mode: an `At` state, a `Facing` state, then the response state with object C shown at its configured initial position and a brief `Place` cue. Response finalisation is the configured finalisation keypress. The default key is the space bar. By default, finalisation is valid only after object C has been moved at least once. This is controlled by `response.objectPlacement.requireMoveBeforeFinalise`, which defaults to `true`.

For this rule, "moved" means any pointer drag at all. No minimum distance threshold is required. If object C is dragged and then returned to its initial position, it still counts as having been moved.

If `requireMoveBeforeFinalise` is `true` and the participant presses the finalisation key before moving object C, the object-placement trial keeps the trial active, keeps the response timer running, and shows the configured `response.objectPlacement.moveRequiredWarningMessage`. The default warning message is `Move the target object before pressing the {finalisationKey}.` The trial renderer replaces `{finalisationKey}` with the configured key label when presenting the message. User-authored config should use `finalisationKey: "space"` for the space bar; OPJRD normalises this internally to the browser key value, displays it as `space bar`, and exports it as `space`. If `requireMoveBeforeFinalise` is `false`, finalisation without movement is allowed and the trial data records that C was never moved.

In `jrd` mode, response finalisation is the click that accepts the rod direction.

## Trial Surface and Feedback Timing

The trial shell and canvas stay mounted across trials within a mode. jsPsych still owns trial sequencing and data collection, but OPJRD renders trial content and the inter-trial interval into the same persistent canvas surface to reduce visual flashes from DOM teardown. Canvas frames are fully redrawn each frame.

When the participant presses the space bar on the ready screen, OPJRD requests fullscreen and then waits for `timing.firstTrialStartDelayMsec` before starting the first trial. This one-off delay lets fullscreen transitions settle before the first trial start gate or object labels are displayed. The delay is configurable and can be set to `0`.

Trials request fullscreen mode through OPJRD's runtime fullscreen adapter at trial start. Fullscreen implementation details and platform caveats are described in `docs/architecture.md` and `docs/platform-support.md`.

After a valid response finalisation, OPJRD records `response_finalisation_msec` immediately. If `response.feedback.durationMsec` is greater than `0`, OPJRD then shows accepted-response feedback for that duration before entering the neutral inter-trial interval state. If the duration is `0`, OPJRD skips accepted-response feedback and proceeds directly to the inter-trial interval.

## Inter-Trial Interval

The inter-trial interval is the configured interval from the end of one trial to
the next trial's start-gate appearance when the gate is enabled, or to object A
onset when the gate is disabled.

## Derived Timing Rule

Mode-specific timing summaries should be derived from the shared raw timing fields. `resp_latency_msec` is stored explicitly for analysis convenience, but it is still calculated from the shared timing events rather than measured independently.
