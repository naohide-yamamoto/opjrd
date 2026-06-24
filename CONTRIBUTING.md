# Contributing

OPJRD is being developed as research software, so behavioural stability and transparent methods matter as much as code style.

## Local Checks

Before opening a pull request, run:

```sh
npm run lint
npm test
npm run build
```

## Language

Use English for:

- documentation
- code comments
- researcher-facing UI
- issue and pull-request text

Saved analysis field names should remain stable, language-independent tokens.

## Repository Hygiene

Do not commit:

- participant data
- unpublished manuscripts
- secrets or tokens
- machine-specific paths
- private server URLs
- third-party PDFs, images, or datasets without confirmed redistribution rights

Use relative paths and generic placeholders in examples.

## Behavioural Changes

For task or scoring changes, include tests or fixtures that show the intended behaviour. If a change affects timing, scoring, angle conventions, or exported field names, update the relevant documentation in `docs/`.
