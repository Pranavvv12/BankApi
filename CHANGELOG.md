# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Local code-aware Copilot `documentation-updater` agent, invoked with
  `/sync-api-documentation`. It traces changed validators, handlers and services
  to affected API annotations even when route-coverage checks pass, regenerates
  the artefacts and verifies the result. It asks for clarification on ambiguous
  behaviour instead of inventing documentation.
- `npm run docs:changes` discovers staged, unstaged and untracked changes for
  that action, with optional `-- --base <ref>` for committed changes.

- **Automated documentation sync.** The OpenAPI specification and a Markdown API
  reference are now generated from the `@openapi` annotations and committed to
  `docs/`, so API changes are visible and reviewable in a pull request diff.
  - `docs/openapi.json` — machine readable OpenAPI 3.0 document.
  - `docs/api-reference.md` — human readable reference with parameters, request
    bodies, response codes and example payloads for every endpoint.
- **Drift detection.** `npm run docs:check` fails when a route is registered
  without an `@openapi` annotation (`DOCUMENTATION_DRIFT`), when the committed
  artefacts no longer match the source (`DOCUMENTATION_STALE`), or when the
  routes directory cannot be read (`SOURCE_NOT_FOUND`). Each failure names the
  offending routes or files.
- **Documentation coverage report** embedded in the generated reference,
  including any orphaned operations left behind after a route was deleted.
- `npm run docs:sync` to regenerate the artefacts and `npm run verify` to run
  the complete gate (build, lint, test, documentation check).
- Vitest test runner and a 35-test suite covering route discovery, coverage
  analysis, Markdown rendering and the sync service.
- GitHub Actions workflow running the full gate on every push and pull request.
- Optional pre-commit hook in `.githooks/` that blocks a commit leaving the
  documentation out of sync.
- Copilot customisations: repository instructions, a documentation sync prompt,
  an API documentation reviewer agent, and a documentation sync skill.
- SDLC records: `requirements.md`, `architecture.md`, `design-review.md`,
  `impl-plan.md`, `CODE_REVIEW.md` and `VERIFICATION.md`.

### Fixed

- `/healthz` was annotated in `src/app.ts` but excluded from the `swagger-jsdoc`
  globs, so it never appeared in `/docs`. It is now included.
- `npm run lint` failed with exit code 2 on every machine because the ESLint
  configuration was committed as `eslintrc.cjs` instead of `.eslintrc.cjs`.
- The README documented six endpoints that do not exist (`GET /customers`,
  `GET /customers/{id}`, `GET /accounts`, `GET /accounts/{id}`,
  `GET /transfers`, `GET /transfers/{id}`). The endpoint list now reflects the
  six routes the application actually serves.

### Changed

- Customer names now require at least three characters. The `POST /customers`
  annotation and generated JSON/Markdown reference reflect the validator.
- The runtime Swagger UI and the documentation generator now share a single
  OpenAPI definition in `src/docs/specOptions.ts`, so `/docs` and the committed
  specification cannot diverge.
- ESLint now honours the `^_` prefix for intentionally unused arguments, which
  the codebase already used, and reports `no-explicit-any` as a warning.
