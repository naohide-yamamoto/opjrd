# Security Policy

## Supported Versions

Security fixes are considered for the latest public release of OPJRD.

| Version | Supported |
| --- | --- |
| 0.1.1 | Yes |

## Reporting a Vulnerability

Please do not open a public issue for suspected security vulnerabilities.

After this repository is public, use GitHub's private vulnerability reporting
feature if it is available on the repository's **Security** tab. If that option
is not available, open a minimal public issue asking for a private reporting
channel, without including vulnerability details, exploit steps, secrets,
participant data, or private local paths.

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
