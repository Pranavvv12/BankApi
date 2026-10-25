# Design Review — Automated Documentation Sync

**Stage 3 of the Agentic SDLC workflow.** Reviews
[`architecture.md`](./architecture.md) against
[`requirements.md`](./requirements.md) before any implementation begins.

## 1. Requirement coverage

| Requirement | Addressed by | Verdict |
| --- | --- | --- |
| FR-01, FR-02 | `routeScanner.scanRoutes` / `toOpenApiPath` | Covered |
| FR-03, FR-04 | `buildSpec` + `DocumentationSyncService.sync` | Covered |
| FR-05, FR-11, FR-12 | `markdown.renderMarkdown` | Covered |
| FR-06, FR-07 | `coverage.buildCoverageReport` | Covered |
| FR-08, FR-09 | `DocumentationSyncService.check` + CLI `--check` | Covered |
| FR-10 | Write-only-on-change in `sync` | Covered |
| FR-13 | `specOptions` shared by `swagger/swagger.ts` | Covered |
| NFR-01 | Sorted paths, no timestamps, determinism test | Covered |
| NFR-02 | `readOutput` CRLF normalisation, dedicated test | Covered |
| NFR-03 | Static analysis instead of booting Express (D-1) | Covered |
| NFR-04 | Constructor-only paths (D-8) | Covered |
| NFR-05 | `DocumentationError` with `code` and `details` | Covered |
| NFR-06 | Six single-purpose modules | Covered |
| NFR-07 | Pure file reads; measured at well under 5s | Covered |

## 2. Risks and mitigations

| # | Risk | Severity | Mitigation | Residual |
| --- | --- | --- | --- | --- |
| R-1 | Static analysis is a heuristic. A route registered dynamically (e.g. in a loop, or via a computed path) will not be discovered. | Medium | Documented as a known limitation; the repository registers every route literally. The repository-level test asserts the exact expected route list, so a missed route surfaces immediately. | Accepted |
| R-2 | The regex could match a non-router call such as `res.get('header')`. | Low | Comments are stripped first, and the scan is confined to `src/app.ts` and `src/routes/`, where no such calls exist. The exact-route-list test would catch a false positive. | Accepted |
| R-3 | Mount prefix resolution depends on the `import x from './x.routes.js'` + `router.use('/x', x)` convention. | Medium | The convention is used consistently; a deviation produces a wrong path, which the repository-level test fails on. | Accepted |
| R-4 | A strict drift gate could block unrelated pull requests. | Medium | The current codebase has zero drift, so the gate starts green. Clearing it only requires adding an annotation — a few lines. | Accepted, intentional |
| R-5 | `swagger-jsdoc` glob behaviour differs on Windows. | Medium | `buildSpec` resolves to absolute paths and converts separators to POSIX form. Verified on Windows. | Closed |
| R-6 | Committed artefacts create merge conflicts when two branches change the API. | Low | Conflicts are resolved by re-running `npm run docs:sync`; the output is deterministic, so the regenerated file is authoritative. | Accepted |

## 3. Findings raised during review

### F-1 — `/healthz` was annotated but never published (**fixed**)

The original `swagger.ts` globs were `./src/routes/*.ts` and
`./dist/src/routes/*.js`. The `/healthz` annotation lives in `src/app.ts`, which
matches neither, so the endpoint never appeared in `/docs` despite being fully
documented.

*Resolution:* `src/app.ts` was added to the globs in `specOptions.ts`. This is a
genuine pre-existing documentation bug that the coverage checker surfaced before
a single line of the generator was finished — direct evidence that the drift
detection is worth having.

### F-2 — the Swagger definition was duplicated (**fixed**)

Leaving the definition inline in `swagger.ts` and copying it into the generator
would guarantee eventual divergence between `/docs` and the committed spec.

*Resolution:* both now import `swaggerOptions` from `src/docs/specOptions.ts`.
They differ only in their globs, which is deliberate (D-2): the runtime also
scans `dist/` so the UI works in a production container.

### F-3 — `npm run lint` was broken on the default branch (**fixed**)

The ESLint configuration was committed as `eslintrc.cjs` instead of
`.eslintrc.cjs`. ESLint could not find it, fell back to searching ancestors, and
exited with code 2 — so `npm run lint` failed for everyone, and linting silently
covered nothing.

*Resolution:* renamed to `.eslintrc.cjs`. This is required rather than
incidental: the `verify` gate this feature introduces runs `lint`, so a broken
lint script would block CI.

Restoring the configuration then exposed eight pre-existing violations in files
unrelated to this feature. Rather than rewriting another author's code, the
configuration was aligned with the conventions already used in the codebase:

- `no-unused-vars` now honours the `^_` prefix. The codebase already writes
  `_req`/`_next` to mark deliberately unused Express arguments, so flagging them
  was a configuration gap rather than a defect.
- `no-explicit-any` was reduced from error to warning. The remaining seven
  `any` usages are pre-existing and out of scope; they stay visible as warnings
  instead of being hidden or hastily retyped.

## 4. Alternatives considered and rejected

| Option | Why rejected |
| --- | --- |
| Generate documentation from the Zod schemas | The Zod schemas describe *request validation* only. They carry no summaries, descriptions, tags, response shapes or examples, so the output would be far poorer than the existing annotations. Recorded as a follow-up for cross-checking request bodies. |
| Boot the app and introspect `app._router` | Requires `DATABASE_URL` and a live Prisma client; violates NFR-03. |
| Commit only `openapi.json` and render Markdown on a docs site | Loses the reviewable, diffable human artefact inside the pull request, which is the main goal. |
| Have CI auto-commit regenerated documentation | Needs write access to protected branches and hides the change from the author (D-7). |

## 5. Decision

**Approved to proceed to implementation planning.**

Conditions carried into the plan:

1. The repository-level test must assert the exact expected route list, so R-1
   and R-3 fail loudly rather than silently.
2. CRLF handling must have a dedicated regression test (NFR-02).
3. The drift gate must be demonstrated failing on a deliberately undocumented
   route before the work is considered complete.
4. Known limitations must be recorded in the pull request rather than hidden.
