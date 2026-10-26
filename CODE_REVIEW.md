# Code Review — Automated Documentation Sync

**Stage 6 of the Agentic SDLC workflow.** Reviews the implementation against
[`impl-plan.md`](./impl-plan.md) and [`architecture.md`](./architecture.md).

## Local updater extension review

Reviewed `changeContext.ts`, its CLI, six Git-backed tests, the local updater
agent/prompt/instructions, and the customer-name annotation/generated diff.
The helper uses argument-array Git invocation, resolves the base before diffing,
preserves filename boundaries with NUL delimiters, propagates errors and covers
both working-tree and explicit committed-change comparisons.

The old prompt incorrectly stopped when `docs:check` passed even though
validator behaviour could have changed. The updater now requires source
inspection before concluding no change is needed. It preserves developer
edits and requires evidence, clarification for ambiguous code, generation,
verification and output-diff inspection.

The current `.min(3)` validator change is intentional, changes public behaviour,
and is reflected in the request annotation and both generated artefacts.
Unlike the historical baseline assessment below, this extension is therefore
not runtime-behaviour-neutral. The full gate passes with 41 tests.

Remaining risks: model output requires review; the tests model annotation
authoring rather than invoking AI; separate VS Code prompt discovery is not
independently verified; CI does not prove semantic accuracy; two pagination
example cells remain `Not Found`. Reviewer approval is still required and
checklist boxes are intentionally unticked.

The sections below retain the original merged implementation's review.

## 1. Scope reviewed

| Area | Files |
| --- | --- |
| Documentation pipeline | `src/docs/{specOptions,types,errors,routeScanner,buildSpec,coverage,markdown,documentationSync}.ts` |
| CLI | `src/scripts/docs.ts` |
| Runtime integration | `src/swagger/swagger.ts` |
| Tests | `tests/*.ts` |
| Tooling | `package.json`, `vitest.config.ts`, `.eslintrc.cjs`, `.github/workflows/ci.yml`, `.githooks/pre-commit` |
| Generated artefacts | `docs/openapi.json`, `docs/api-reference.md` |
| Documentation | `README.md`, SDLC documents |

## 2. Findings

### Resolved during implementation

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| C-1 | High | `/healthz` was annotated in `src/app.ts` but the Swagger globs only covered `src/routes/`, so the endpoint never appeared in `/docs`. | `src/app.ts` added to the globs in `specOptions.ts`. Covered by a regression test asserting the operation is present. |
| C-2 | High | `npm run lint` exited with code 2 on the default branch because the configuration was named `eslintrc.cjs` rather than `.eslintrc.cjs`. The `verify` gate depends on lint, so this had to be fixed. | Renamed. Rules aligned with the codebase's existing `^_` unused-argument convention. |
| C-3 | High | The README advertised six endpoints that do not exist (`GET /customers`, `GET /customers/{id}`, `GET /accounts`, `GET /accounts/{id}`, `GET /transfers`, `GET /transfers/{id}`). | Replaced the hand-maintained list with the real six routes and a link to the generated reference. A direct illustration of the drift this feature prevents. |
| C-4 | Medium | The Swagger definition would have been duplicated between the runtime and the generator, guaranteeing eventual divergence. | Both import `swaggerOptions` from `specOptions.ts`; only the globs differ, deliberately (D-2). |
| C-5 | Medium | Comparing generated files byte-for-byte reports permanent false staleness on Windows, where Git may check out `CRLF` while the generator emits `LF`. | `readOutput` normalises `CRLF` to `LF`. Dedicated regression test. `.gitattributes` already pins `*.md`/`*.json` to `LF`, but the normalisation does not depend on every clone being configured correctly. |
| C-6 | Medium | Reporting staleness before drift would send a developer to `docs:sync`, which cannot fix a missing annotation. | `check` evaluates drift first and returns a distinct error code. |
| C-7 | Low | `@openapi` blocks contain paths such as `/widgets/decoy` that a naive regex would read as route registrations. | Comments are stripped before scanning. Explicit test asserts a comment-only path is not discovered. |
| C-8 | Low | Scanning both `src/` and `dist/` would make the output depend on whether a build happened to be present. | The generator scans TypeScript sources only; the runtime still scans `dist/` so the UI works in a production container. |

### Accepted limitations

| # | Limitation | Why accepted |
| --- | --- | --- |
| L-1 | Route discovery is static. A route registered dynamically — a computed path or a loop — would not be found. | Every route in this repository is registered literally. `tests/bankApiDocumentation.test.ts` asserts the exact expected route list, so a missed route fails the build rather than passing silently. Runtime introspection was rejected because it needs a database (D-1). |
| L-2 | Mount prefixes rely on the `import x from './x.routes.js'` + `router.use('/x', x)` convention. | Used consistently across the repository, and a deviation fails the exact-route-list test. |
| L-3 | Request bodies are not cross-checked against the Zod schemas, so an annotation could describe a field the validator rejects. | Out of scope per `requirements.md` §6. Recorded as a follow-up; the reviewer agent is instructed to check this by hand. |
| L-4 | Seven `@typescript-eslint/no-explicit-any` warnings remain in pre-existing controller and service code. | Unrelated to this change. Left visible as warnings rather than hastily retyped or suppressed. |
| L-5 | `npm audit` reports 13 vulnerabilities (2 moderate, 10 high, 1 critical) in the pre-existing dependency tree. | Pre-existing and unrelated to this feature; fixing requires breaking upgrades. Flagged for a dedicated change — see §5. |

## 3. Quality assessment

| Criterion | Assessment |
| --- | --- |
| Separation of concerns | Good. `markdown.ts` and `coverage.ts` are pure functions; `documentationSync.ts` is the only module performing I/O, which is why the suite needs no mocking framework. |
| Error handling | Good. Three distinct typed codes, each carrying a `details` array naming the offending routes or files, so a CI log is actionable without local reproduction. |
| Determinism | Verified. Paths are sorted, methods ordered, no timestamps. A dedicated test asserts two renders are identical, and a repeated `sync` reports `up-to-date` without rewriting. |
| Test coverage | Good. 35 tests across 5 files covering the happy path, drift, staleness, deleted artefacts, missing sources, CRLF checkout, empty specifications and absent annotation fields. |
| Security | Good. No new HTTP surface. No caller-supplied filesystem paths. Read-only analysis, offline, no database. |
| Performance | `docs:check` completes in roughly one second; the whole suite runs in under a second. |
| Backwards compatibility | No runtime behaviour changed. `/docs` now additionally exposes `/healthz`, which is a fix. |

## 4. Verification that the gate actually works

A negative test was run rather than assumed. Appending an unannotated route to
`src/routes/customers.routes.ts` produced:

```
DOCUMENTATION_DRIFT: Routes are registered without an @openapi annotation.
  - GET /customers/{id}/profile (src/routes/customers.routes.ts)
```

with exit code 1. Reverting the file restored exit code 0. Full evidence is in
[`VERIFICATION.md`](./VERIFICATION.md).

## 5. Follow-ups recommended (not blocking)

1. Address the 13 pre-existing `npm audit` findings in a dedicated change.
2. Cross-check documented request bodies against the Zod schemas (L-3).
3. Replace the remaining `any` usages in the controllers with typed request
   generics (L-4).
4. Consider publishing `docs/openapi.json` as a CI artefact for client
   generation.

## 6. Verdict

**Approved.** The feature meets every must-have requirement, the gate has been
demonstrated to fail on real drift as well as to pass when the documentation is
correct, and the limitations are documented rather than hidden.
