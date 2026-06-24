# Geometry and Scoring

## Experimenter-Defined Zero Direction

Each experiment must define a 0-degree direction as a vector in the same coordinate system as the object locations.

Example:

```json
{
  "zeroDirection": { "x": 0, "y": 1 }
}
```

The zero vector is invalid and is rejected during validation.

All absolute layout headings are measured relative to this vector, with anticlockwise as positive and degree values in `[0, 360)`.

## Imagined Heading

For each trial, `imagined_heading` is the A-to-B heading relative to the experimenter-defined 0-degree direction. It is stored in radians in `[0, 2pi)`.

`imagined_heading_deg` is the same value in degrees in `[0, 360)`.

If A is `(1, 0)`, B is `(0, 1)`, C is `(1, 1)`, and the experimenter-defined 0-degree direction is the positive y-axis, then:

- A-to-B is `45` degrees.
- A-to-C is `0` degrees.
- B-to-A is `225` degrees.

## Canonical Transform

For each trial, the scoring transform:

1. translates the studied layout so object A is at `(0, 0)`
2. rotates the layout so the vector from A to B points straight up along the positive y-axis
3. scales the layout so the A-to-B distance matches the configured response-interface A-B distance
4. treats transformed C as the correct response position

The same transform is used by trial rendering, scoring, tests, and future validation analyses.

## Angle Convention

OPJRD uses this response-relative angle convention:

- `0` means straight up in the response interface.
- anticlockwise is positive.
- left is `+90` degrees.
- right is `-90` degrees.
- down is `+180` degrees.
- response-relative angles and signed angular errors are wrapped to `(-pi, pi]`, so exact opposite-direction values are `+pi` / `+180` rather than `-pi` / `-180`.

Absolute imagined headings use `[0, 2pi)` instead because they describe layout headings rather than signed response errors.

## Scoring Fields

In `object_placement` mode, OPJRD scores both direction and distance:

- `true_angle` and `placed_angle` are response-relative angles of the transformed correct C position and the participant's placed C position.
- `angular_error_signed` is `placed_angle - true_angle`, wrapped to `(-pi, pi]`.
- `angular_error_absolute` is the absolute signed angular error.
- `true_distance` and `placed_distance` are radial distances from the response origin.
- `distance_error_signed` is `placed_distance - true_distance`.
- `distance_error_absolute` is the absolute signed distance error.
- `position_error_euclidean` is the straight-line distance between the transformed correct C position and the participant's placed C position.

In `jrd` mode, OPJRD scores direction only:

- `true_angle` is the response-relative target angle.
- `estimated_angle` is the accepted response angle.
- signed and absolute angular errors use the same wrapping convention as object-placement scoring.
