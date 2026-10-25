# Copilot instructions — Bank API

## Project shape

TypeScript REST API on Express 4, Prisma 5 (PostgreSQL), Zod for request
validation and `swagger-jsdoc` for API documentation. The package is **native
ESM** (`"type": "module"`).

## Rules that are easy to get wrong

1. **Relative imports must end in `.js`**, even from a `.ts` file —
   `import { validate } from '../middlewares/validate.js'`. The build will not
   rewrite extensions for you.
2. **There is no `__dirname`.** Use `import.meta.url` with `fileURLToPath` when
   a module needs its own location.
3. **Never edit `docs/api-reference.md` or `docs/openapi.json` by hand.** They
   are generated. Run `npm run docs:sync` instead.
4. **Every new route needs an `@openapi` annotation** directly above its
   registration. CI fails with `DOCUMENTATION_DRIFT` otherwise.

## Adding or changing an endpoint

1. Add the Zod schema in `src/schemas/`.
2. Add the handler in `src/controllers/` and the business logic in
   `src/services/`.
3. Register the route in `src/routes/*.routes.ts` with an `@openapi` block
   above it containing a `summary`, a `description`, `tags`, every parameter,
   the `requestBody` where applicable, and **every** response status. Include
   `example` values — they are rendered into the Markdown reference.
4. Run `npm run docs:sync` and commit the regenerated `docs/` files.
5. Run `npm run verify`.

## Documentation sync internals

Source lives in `src/docs/`:

| Module | Role |
| --- | --- |
| `specOptions.ts` | Shared OpenAPI definition and source globs, used by the generator **and** the runtime Swagger UI. |
| `routeScanner.ts` | Statically discovers routes. Does not boot Express. |
| `buildSpec.ts` | Runs `swagger-jsdoc`; sorts paths for determinism. |
| `coverage.ts` | Compares code against annotations — the drift detector. |
| `markdown.ts` | Pure renderer, no I/O. |
| `documentationSync.ts` | The only module that touches the filesystem. |

Constraints to preserve when modifying this code:

- **Determinism.** No timestamps, absolute paths or other volatile data in the
  output; re-running must produce byte-identical files.
- **No caller-supplied paths.** Directories come from constructor options only.
- **CRLF tolerance.** Compare normalised content when reading generated files.
- **No runtime dependencies.** The check must pass with no database and no
  network.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run docs:sync` | Regenerate the committed documentation. |
| `npm run docs:check` | Verify it without writing; non-zero on failure. |
| `npm test` | Run the vitest suite. |
| `npm run verify` | Build, lint, test and documentation check — the CI gate. |

## Failure codes

| Code | Meaning | Fix |
| --- | --- | --- |
| `SOURCE_NOT_FOUND` | The routes directory could not be read. | Restore the path. |
| `DOCUMENTATION_DRIFT` | A route has no `@openapi` annotation. | Annotate the route. |
| `DOCUMENTATION_STALE` | Committed documentation differs from the source. | Run `npm run docs:sync`. |

## Style

Two-space indentation, single quotes, semicolons. Prefer `unknown` over `any`.
Comment only what genuinely needs clarification.
