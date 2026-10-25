---
description: Regenerate the Bank API documentation and resolve any drift it reports.
---

# Sync the API documentation

Bring the committed API documentation back in line with the Express sources.

## Steps

1. Run `npm run docs:check` and read the outcome carefully.

   - **Exit 0** — nothing to do. Stop and report that the documentation is
     already in sync.
   - **`DOCUMENTATION_DRIFT`** — one or more routes have no `@openapi`
     annotation. Continue at step 2.
   - **`DOCUMENTATION_STALE`** — the annotations changed but the artefacts were
     not regenerated. Skip to step 3.
   - **`SOURCE_NOT_FOUND`** — the routes directory is missing. Stop and report
     this; do not attempt to regenerate.

2. For every route listed as undocumented, open the file named in the error and
   add an `@openapi` block directly above the registration. It must include:

   - `summary` — one short line.
   - `description` — what the endpoint does, including noteworthy behaviour
     such as idempotency or pagination.
   - `tags` — the resource name, matching the other routes in the file.
   - `parameters` — every path, query and header parameter, each with a
     `schema`, a `description` and an `example`.
   - `requestBody` — for `POST`, `PUT` and `PATCH`, with `required`, the
     property types, constraints and `example` values. Mirror the Zod schema in
     `src/schemas/` so validation and documentation agree.
   - `responses` — **every** status the handler can return, including the error
     statuses produced by the service layer, each with a `description` and,
     where useful, a response schema with examples.

3. Run `npm run docs:sync` to regenerate `docs/openapi.json` and
   `docs/api-reference.md`.

4. Run `npm run verify` and confirm it exits 0.

5. Report what changed: the routes annotated, and whether the artefacts were
   updated or were already current.

## Rules

- Never hand-edit `docs/openapi.json` or `docs/api-reference.md`.
- Never silence the check by loosening the gate; fix the documentation instead.
- Do not invent endpoint behaviour. Read the controller and service to confirm
  the real status codes and payload shapes before describing them.
