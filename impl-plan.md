# Implementation Plan — Automated Documentation Sync

**Stage 4 of the Agentic SDLC workflow.** Derived from the approved
[`design-review.md`](./design-review.md).

## Task breakdown

Tasks are listed in dependency order. Each is independently verifiable.

| # | Task | Depends on | Deliverable | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| T-01 | Repair the ESLint configuration (`eslintrc.cjs` → `.eslintrc.cjs`) and align its rules with the codebase's `^_` convention. | — | `.eslintrc.cjs` | `npm run lint` exits 0 | Complete |
| T-02 | Extract the shared OpenAPI definition and source globs. | T-01 | `src/docs/specOptions.ts` | Imported by both the generator and `swagger.ts` | Complete |
| T-03 | Define typed errors and shared structural types. | T-02 | `src/docs/errors.ts`, `src/docs/types.ts` | `npm run build` | Complete |
| T-04 | Implement static route discovery with mount-prefix resolution and comment stripping. | T-03 | `src/docs/routeScanner.ts` | `tests/routeScanner.test.ts` | Complete |
| T-05 | Implement deterministic specification building over the TypeScript sources. | T-03 | `src/docs/buildSpec.ts` | Repository-level test | Complete |
| T-06 | Implement the coverage/drift comparison. | T-04, T-05 | `src/docs/coverage.ts` | `tests/coverage.test.ts` | Complete |
| T-07 | Implement the Markdown renderer including the coverage section, examples and `Not Found` placeholders. | T-06 | `src/docs/markdown.ts` | `tests/markdown.test.ts` | Complete |
| T-08 | Implement the orchestrating service with `sync`/`check`, write-on-change and CRLF-tolerant comparison. | T-07 | `src/docs/documentationSync.ts` | `tests/documentationSync.test.ts` | Complete |
| T-09 | Point the runtime Swagger UI at the shared definition. | T-02 | `src/swagger/swagger.ts` | `npm run build`; `/healthz` present in the spec | Complete |
| T-10 | Add the CLI adapter with `--check`. | T-08 | `src/scripts/docs.ts` | `npm run docs:sync`, `npm run docs:check` | Complete |
| T-11 | Add `test`, `docs:sync`, `docs:check` and `verify` scripts, and the vitest configuration. | T-10 | `package.json`, `vitest.config.ts` | `npm run verify` exits 0 | Complete |
| T-12 | Write the test suite, including the fixture project and the repository-level guard. | T-11 | `tests/*` | 35 tests pass | Complete |
| T-13 | Generate and commit the artefacts. | T-10 | `docs/openapi.json`, `docs/api-reference.md` | `npm run docs:check` exits 0 | Complete |
| T-14 | Add the CI workflow running the full `verify` gate. | T-11 | `.github/workflows/ci.yml` | Green run on the pull request | Complete |
| T-15 | Add the Copilot customisations: instructions, prompt, agent, skill and hook. | T-13 | `.github/copilot-instructions.md`, `.github/prompts/`, `.github/agents/`, `.github/skills/`, `.githooks/` | Files present and documented | Complete |
| T-16 | Document usage in the README. | T-13 | `README.md` | Manual read-through | Complete |
| T-17 | Demonstrate the drift gate failing on a deliberately undocumented route. | T-13 | Evidence in `VERIFICATION.md` | Exit code 1 observed | Complete |
| T-18 | Code review, verification record and pull request. | T-17 | `CODE_REVIEW.md`, `VERIFICATION.md`, `CHANGELOG.md`, `PR_DESCRIPTION.md` | Reviewed and merged | Complete |

## Test strategy

| Level | File | Covers |
| --- | --- | --- |
| Unit | `tests/routeScanner.test.ts` | Path normalisation, mount prefixes, comment stripping, `SOURCE_NOT_FOUND`. |
| Unit | `tests/coverage.test.ts` | Deterministic ordering, undocumented, orphaned, full coverage. |
| Unit | `tests/markdown.test.ts` | Metadata, servers, index table, request bodies, constraints, response examples, `Not Found`, empty document, determinism. |
| Integration | `tests/documentationSync.test.ts` | First write, idempotent re-run, passing check, hand-edited file, deleted file, drift, re-annotation, CRLF checkout, missing sources, custom output directory. |
| Repository guard | `tests/bankApiDocumentation.test.ts` | The real route list, zero drift, `/healthz` inclusion, committed artefacts current. |

Fixtures are generated into a temporary directory by `tests/fixtures.ts`, so no
test depends on a database, a network, or the developer's working tree.

## Rollout

1. All work lands on `feature/automated-documentation-sync`.
2. CI must be green before review.
3. Merge to `main`; the gate then protects every subsequent pull request.
4. After merge, re-run `npm run verify` on `main` to confirm the committed
   artefacts survive a fresh checkout — including line-ending translation.
