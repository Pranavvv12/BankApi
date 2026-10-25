---
name: documentation-sync
description: Keep the Bank API's committed OpenAPI spec and Markdown reference in step with the Express routes. Use when adding, changing or removing an endpoint, or when CI reports DOCUMENTATION_DRIFT or DOCUMENTATION_STALE.
---

# Documentation sync

## When to use this skill

- A route is added, changed or removed in `src/routes/` or `src/app.ts`.
- CI fails with `DOCUMENTATION_DRIFT`, `DOCUMENTATION_STALE` or
  `SOURCE_NOT_FOUND`.
- Someone asks whether the API documentation is current.

## Mental model

The committed documentation is **derived**, never authored:

```
src/app.ts + src/routes/*.routes.ts   (the @openapi annotations)
            │
            ├── swagger-jsdoc ──────► docs/openapi.json
            │                         docs/api-reference.md
            └── static route scan ──► coverage report (drift detection)
```

`docs:check` fails when the two sides disagree. It never rewrites anything.

## Diagnosing a failure

| Code | Root cause | Fix |
| --- | --- | --- |
| `DOCUMENTATION_DRIFT` | A route is registered with no `@openapi` block. | Add the annotation. Regenerating will **not** help. |
| `DOCUMENTATION_STALE` | Annotations changed; artefacts were not regenerated. | `npm run docs:sync`, then commit `docs/`. |
| `SOURCE_NOT_FOUND` | The routes directory could not be read. | Restore the path; do not regenerate over it. |

Drift is always reported before staleness, because a missing annotation cannot
be fixed by regenerating.

## Writing a good annotation

Place the block immediately above the registration, and use the **full** path
as the client sees it — the mount prefix from `src/routes/index.ts` plus the
router sub-path, with `:id` written as `{id}`:

```ts
/**
 * @openapi
 * /accounts/{id}/balance:
 *   get:
 *     summary: Get account balance
 *     description: Retrieves the current balance of a specific account
 *     tags:
 *       - Accounts
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Account ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Account balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accountId:
 *                   type: integer
 *                   example: 1
 *       404:
 *         description: Account not found
 */
r.get('/:id/balance', validate(accountIdParamSchema), getBalance);
```

Checklist:

- The path matches the resolved route exactly, `{braces}` not `:colons`.
- `summary`, `description` and `tags` are present — anything omitted renders as
  `Not Found` in the reference.
- Every error status the service can throw is listed. `getAccountOrThrow`
  raises `notFound`, and `TransfersService` raises `badRequest` for insufficient
  funds.
- `requestBody` property types and constraints mirror the Zod schema in
  `src/schemas/`.
- `example` values are supplied; the renderer builds the sample payloads from
  them.

## Workflow

```bash
npm run docs:check   # diagnose
npm run docs:sync    # regenerate after fixing annotations
npm run verify       # build + lint + test + docs:check
```

Then commit the source change **and** the regenerated `docs/` files together.

## Pitfalls

- Editing `docs/api-reference.md` or `docs/openapi.json` directly — they are
  overwritten on the next sync.
- Annotating a sub-path (`/:id`) instead of the full path (`/accounts/{id}`).
- Forgetting that routes declared in `src/app.ts`, such as `/healthz`, are
  scanned too.
- Relaxing the gate to make CI pass. Fix the documentation instead.
