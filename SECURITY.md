# Security Policy

## Supported Versions

Security fixes are considered for the latest public release of OPJRD.

| Version | Supported |
| --- | --- |
| 0.2.0 | Yes |
| 0.1.2 and earlier | No |

The current support scope is:

- macOS browser use in recent Chrome, Safari, and Firefox
- Windows browser use in recent Chrome, Edge, and Firefox
- the signed and notarised packaged macOS app
- JATOS deployment on the validated JATOS workflow

Windows packaged apps, Linux workflows, and mobile workflows are not supported.

## Reporting a Vulnerability

Please report suspected security vulnerabilities through GitHub's private
vulnerability reporting feature on this repository's **Security** tab.

Do not open a public issue for suspected security vulnerabilities, and do not
include vulnerability details, exploit steps, secrets, participant data, or
private local paths in public discussions.

Useful reports include:

- affected OPJRD version
- affected runtime, such as browser mode or the Tauri macOS app
- affected operating system and browser version, when relevant
- concise reproduction steps
- whether participant data, config files, saved output, local filesystem access,
  or packaged-app distribution may be affected

The maintainer will triage security reports before ordinary public bug reports
when the issue could affect participant data, local files, release artefacts, or
the integrity of experiment output.
