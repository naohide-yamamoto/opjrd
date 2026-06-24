const SHARED_TRIAL_COLUMNS = [
  "task_mode",
  "trial_id",
  "location",
  "direction",
  "target",
  "latency_start_event",
  "a_onset_msec",
  "b_onset_msec",
  "c_onset_msec",
  "response_finalisation_msec",
  "resp_latency_msec",
  "trial_start_gate_enabled",
  "trial_gate_warning_shown",
  "imagined_heading",
  "imagined_heading_deg",
] as const;

const OBJECT_PLACEMENT_COLUMNS = [
  "true_x",
  "true_y",
  "placed_x",
  "placed_y",
  "true_angle",
  "true_angle_deg",
  "placed_angle",
  "placed_angle_deg",
  "angular_error_signed",
  "angular_error_signed_deg",
  "angular_error_absolute",
  "angular_error_absolute_deg",
  "true_distance",
  "placed_distance",
  "distance_error_signed",
  "distance_error_absolute",
  "position_error_euclidean",
  "c_initial_x",
  "c_initial_y",
  "c_moved",
  "movement_count",
  "finalisation_attempts",
  "blocked_finalisation_attempts",
  "finalisation_key",
  "move_required_warning_shown",
] as const;

const JRD_COLUMNS = [
  "true_angle",
  "true_angle_deg",
  "estimated_angle",
  "estimated_angle_deg",
  "angular_error_signed",
  "angular_error_signed_deg",
  "angular_error_absolute",
  "angular_error_absolute_deg",
  "pointer_x",
  "pointer_y",
  "pointer_moved",
  "finalisation_method",
] as const;

const MODE_COLUMNS = {
  object_placement: OBJECT_PLACEMENT_COLUMNS,
  jrd: JRD_COLUMNS,
} as const;

type TaskMode = keyof typeof MODE_COLUMNS;

function isTaskMode(value: unknown): value is TaskMode {
  return value === "object_placement" || value === "jrd";
}

function pickColumns(
  row: Record<string, unknown>,
  columns: readonly string[]
): Record<string, unknown> {
  return Object.fromEntries(
    columns
      .filter((column) => Object.hasOwn(row, column))
      .map((column) => [column, row[column]])
  );
}

export function canonicaliseTrialRow(
  row: Record<string, unknown>
): Record<string, unknown> {
  if (!isTaskMode(row.task_mode)) {
    throw new Error("Output row is missing a valid task_mode.");
  }

  return {
    ...pickColumns(row, SHARED_TRIAL_COLUMNS),
    ...pickColumns(row, MODE_COLUMNS[row.task_mode]),
  };
}

export function canonicaliseTrialRows(
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  return rows.map(canonicaliseTrialRow);
}
