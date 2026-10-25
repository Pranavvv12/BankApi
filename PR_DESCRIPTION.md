# Automated Documentation Sync

## Summary

The Bank API documents itself with `@openapi` JSDoc annotations that
`swagger-jsdoc` turns into an OpenAPI document **at runtime only**. Nothing was
committed, which meant an API change was invisible in a pull request diff, a
route could be added without an annotation and silently vanish from `/docs`
forever, and consumers had no machine readable artefact to generate clients
from without booting the service against a live database.

This pull request generates the documentation from the source, commits it, and
verifies it in CI — so it cannot drift away from the code unnoticed.

The problem is not hypothetical. While building this, the new coverage checker
immediately found that **`/healthz` had never appeared in `/docs`**, and the
README was advertising **six endpoints that do not exist**.

## Changes made

### The documentation pipeline (`src/docs/`)

| Module | Role |
| --- | --- |
| `specOptions.ts` | Single shared OpenAPI definition, used by the generator **and** the runtime Swagger UI so the two cannot diverge. |
| `routeScanner.ts` | Statically discovers every registered route, resolving mount prefixes from `src/routes/index.ts` and converting `:id` to `{id}`. Does not boot Express. |
| `buildSpec.ts` | Runs `swagger-jsdoc` over the TypeScript sources and sorts the paths for determinism. |
| `coverage.ts` | The drift detector — compares registered routes against documented operations. |
| `markdown.ts` | Pure renderer for the human readable reference. |
| `documentationSync.ts` | Orchestrates generation, comparison and writing; the only module that touches the filesystem. |
| `errors.ts`, `types.ts` | Typed error codes and shared structural types. |

### Generated artefacts

- `docs/openapi.json` — OpenAPI 3.0, 6 paths.
- `docs/api-reference.md` — ~280 lines covering metadata, servers, a coverage
  summary, an endpoint index, and per-endpoint parameters, request bodies,
  response codes and example payloads.

### Tooling

- `npm run docs:sync` — regenerate. `npm run docs:check` — verify, non-zero on
  failure. `npm run verify` — build + lint + test + documentation check.
- GitHub Actions workflow running the full gate on every push and pull request.
- Optional `.githooks/pre-commit` that blocks a commit leaving docs out of sync.
- Vitest plus a 35-test suite.

### Copilot customisations

Repository instructions, a `sync-api-documentation` prompt, an
`api-documentation-reviewer` agent, and a `documentation-sync` skill.

### Fixes discovered along the way

| Fix | Detail |
| --- | --- |
| `/healthz` missing from `/docs` | It is annotated in `src/app.ts`, which the original globs did not cover. |
| `npm run lint` broken for everyone | The config was committed as `eslintrc.cjs`, not `.eslintrc.cjs`; ESLint exited with code 2. The `verify` gate depends on lint, so this had to be fixed. |
| README documented non-existent endpoints | `GET /customers`, `GET /customers/{id}`, `GET /accounts`, `GET /accounts/{id}`, `GET /transfers`, `GET /transfers/{id}` were all listed but never implemented. |

## Test evidence

```
npm run verify

build   tsc -p tsconfig.json           pass
lint    eslint .                       pass (0 errors, 7 pre-existing warnings)
test    vitest run                     5 files, 35 tests, all passing
docs    tsx src/scripts/docs.ts --check  Routes: 6 | documented: 6 | undocumented: 0 | orphaned: 0

exit code 0
```

**The gate was proven to fail, not just to pass.** Appending an unannotated
route produced:

```
DOCUMENTATION_DRIFT: Routes are registered without an @openapi annotation.
  - GET /customers/{id}/profile (src/routes/customers.routes.ts)
exit code 1
```

Edge cases covered by tests: missing routes directory, hand-edited reference,
deleted specification, undocumented route, newly annotated route, artefacts
checked out with CRLF line endings, empty specification, annotations missing
summary/tag/responses, paths appearing only inside comments, and repeated syncs
being no-ops.

Full detail in [`VERIFICATION.md`](./VERIFICATION.md).

## Known limitations

1. **Route discovery is static.** A route registered dynamically — a computed
   path or a loop — would not be found. Runtime introspection was rejected
   because it would require a live database in CI. Mitigated by a test that
   asserts the exact expected route list, so a missed route fails the build.
2. **Mount prefixes rely on the existing convention** of
   `import x from './x.routes.js'` plus `router.use('/x', x)`.
3. **Request bodies are not cross-checked against the Zod schemas**, so an
   annotation could in principle describe a field the validator rejects. The
   reviewer agent is instructed to check this manually; automating it is a
   follow-up.
4. **CI detects drift but does not auto-commit a fix.** This is deliberate — it
   avoids giving CI write access to protected branches and keeps the author
   responsible for their documentation.
5. **Pre-existing issues left alone:** 13 `npm audit` findings and 7
   `no-explicit-any` warnings in untouched controller and service code. Both
   are flagged in `CODE_REVIEW.md` §5 rather than fixed here.

## Reviewer checklist

- [ ] `requirements.md`, `architecture.md`, `design-review.md` and
      `impl-plan.md` describe the feature that was actually built.
- [ ] `docs/openapi.json` and `docs/api-reference.md` match the routes in
      `src/routes/` and `src/app.ts`.
- [ ] `npm run verify` passes locally.
- [ ] CI is green.
- [ ] The drift gate is understood: adding a route without an `@openapi` block
      will now fail the build.
- [ ] The ESLint rename and rule changes are acceptable.
- [ ] The known limitations above are acceptable for merge.
