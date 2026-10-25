# Verification — Automated Documentation Sync

**Stage 7 of the Agentic SDLC workflow.**

Environment: Windows, Node v24.19.0, npm 11, TypeScript 5.4, vitest 2.1.9.

## 1. Full gate

```
npm run verify
```

| Step | Command | Result |
| --- | --- | --- |
| Compile | `tsc -p tsconfig.json` | Pass — no errors |
| Lint | `eslint .` | Pass — 0 errors, 7 pre-existing warnings |
| Test | `vitest run` | Pass — 5 files, 35 tests |
| Documentation | `tsx src/scripts/docs.ts --check` | Pass — exit 0 |

Overall exit code: **0**.

## 2. Test results

```
 ✓ tests/coverage.test.ts              (4 tests)
 ✓ tests/markdown.test.ts              (11 tests)
 ✓ tests/routeScanner.test.ts          (6 tests)
 ✓ tests/bankApiDocumentation.test.ts  (4 tests)
 ✓ tests/documentationSync.test.ts     (10 tests)

 Test Files  5 passed (5)
      Tests  35 passed (35)
   Duration  ~0.8s
```

### Requirement traceability

| Requirement | Evidence |
| --- | --- |
| FR-01, FR-02 | `scanRoutes` discovers application and mounted routes; `toOpenApiPath` converts `:id` to `{id}` |
| FR-03, FR-04 | `sync` writes `docs/openapi.json` containing all six paths |
| FR-05 | `docs/api-reference.md` renders parameters, request bodies, responses and examples |
| FR-06 | Drift test and the live negative test in §4 |
| FR-07 | `buildCoverageReport` flags `/legacy` as orphaned |
| FR-08, FR-09 | `check` throws `DOCUMENTATION_DRIFT` before `DOCUMENTATION_STALE` |
| FR-10 | Repeated `sync` returns `up-to-date` with an unchanged file mtime |
| FR-11 | Coverage table present in the generated reference |
| FR-12 | `Not Found` rendered for absent summaries, tags and responses |
| FR-13 | `/healthz` present in the spec built from the shared definition |
| NFR-01 | Determinism test — two renders are byte-identical |
| NFR-02 | CRLF test — artefacts rewritten with `\r\n` still verify as up to date |
| NFR-03 | The whole suite runs with no database and no network |
| NFR-05 | Typed errors asserted by code, with populated `details` |

## 3. Generated output

| Artefact | Size | Contents |
| --- | --- | --- |
| `docs/openapi.json` | 6 paths, 6 operations | Machine readable OpenAPI 3.0 |
| `docs/api-reference.md` | ~280 lines | Metadata, servers, coverage summary, endpoint index, and a detailed section per endpoint |

Coverage reported by the generator:

```
Routes: 6 | documented operations: 6 | undocumented: 0 | orphaned: 0
```

Routes discovered:

| Method | Path | Source |
| --- | --- | --- |
| `GET` | `/healthz` | `src/app.ts` |
| `POST` | `/customers` | `src/routes/customers.routes.ts` |
| `POST` | `/accounts` | `src/routes/accounts.routes.ts` |
| `GET` | `/accounts/{id}/balance` | `src/routes/accounts.routes.ts` |
| `GET` | `/accounts/{id}/transactions` | `src/routes/accounts.routes.ts` |
| `POST` | `/transfers` | `src/routes/transfers.routes.ts` |

## 4. Negative test — the gate actually fails

The gate was proven rather than assumed. An unannotated route was appended to
`src/routes/customers.routes.ts`:

```ts
r.get('/:id/profile', createCustomer);
```

Running the check:

```
> npm run docs:check

DOCUMENTATION_DRIFT: Routes are registered without an @openapi annotation.
  - GET /customers/{id}/profile (src/routes/customers.routes.ts)

exit code 1
```

The file was reverted and the check re-run:

```
Routes: 6 | documented operations: 6 | undocumented: 0 | orphaned: 0
Documentation is up to date.

exit code 0
```

**Confirmed:** the error names the method, the resolved full path and the file,
and the non-zero exit stops CI.

## 5. Pre-commit hook

```
> sh .githooks/pre-commit

pre-commit: verifying API documentation is in sync...
Routes: 6 | documented operations: 6 | undocumented: 0 | orphaned: 0
Documentation is up to date.

exit code 0
```

Enabled per clone with `git config core.hooksPath .githooks`.

## 6. Edge cases confirmed

| Case | Expected | Observed |
| --- | --- | --- |
| Missing routes directory | `SOURCE_NOT_FOUND` | Confirmed |
| Hand-edited reference | `DOCUMENTATION_STALE` naming the file | Confirmed |
| Deleted `openapi.json` | `DOCUMENTATION_STALE` naming the file | Confirmed |
| Route added without annotation | `DOCUMENTATION_DRIFT` naming the route | Confirmed |
| Route annotated, then regenerated | `updated`, zero undocumented | Confirmed |
| Artefacts checked out as CRLF | `up-to-date`, not stale | Confirmed |
| Specification with no endpoints | Explicit guidance, not a blank file | Confirmed |
| Annotation missing summary/tag/responses | `Not Found` rendered | Confirmed |
| Path appearing only in a comment | Not treated as a route | Confirmed |
| Repeated sync | `up-to-date`, file not rewritten | Confirmed |

## 7. Known issues not addressed

| Issue | Status |
| --- | --- |
| 13 `npm audit` findings in the pre-existing dependency tree | Pre-existing, out of scope; flagged in `CODE_REVIEW.md` §5 |
| 7 `no-explicit-any` warnings in pre-existing controllers and services | Pre-existing, left visible as warnings |
| Dynamically registered routes would not be discovered | Documented limitation L-1; no such routes exist in this repository |

## 8. Post-merge check

After merging to `main`, `npm run verify` must be re-run on a fresh checkout to
confirm the committed artefacts survive Git's line-ending translation. Result
recorded in the pull request.
