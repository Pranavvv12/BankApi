# Code-aware documentation updates

## Summary

This change adds a locally invoked Copilot agent that inspects code changes,
traces their effects to API endpoints, and updates OpenAPI annotations before
regenerating the JSON and Markdown documentation. It closes the gap in the
original annotation-based generator, which could pass verification even when
business logic changed without a corresponding annotation update. The included
customer-name validation change demonstrates the workflow end to end.

## Changes Made

Files added:

- `.github/agents/documentation-updater.agent.md` - implements the local
  authoring workflow, implementation tracing, ambiguity handling and validation.
- `src/docs/changeContext.ts` - discovers staged, unstaged, deleted, renamed
  and untracked files relative to HEAD or an explicit comparison commit.
- `src/scripts/docsChanges.ts` - exposes change discovery as a CLI with explicit
  failures and usage guidance; does not invoke AI itself.
- `tests/changeContext.test.ts` - adds six Git-backed tests, including a
  semantic-change scenario that the old documentation check cannot detect.

Files modified:

- `.github/prompts/sync-api-documentation.prompt.md` - invokes the updater
  rather than stopping when the annotation freshness check passes.
- `.github/copilot-instructions.md` - directs code-aware updates to the new
  agent and explains the limits of the generator.
- `.github/skills/documentation-sync/SKILL.md` - includes business-logic and
  validator changes in the workflow and documents the authoring step.
- `package.json` - adds `npm run docs:changes`.
- `src/schemas/customers.schema.ts` - retains the developer's change requiring
  customer names to contain at least three characters.
- `src/routes/customers.routes.ts` - documents `minLength: 3` and its meaning;
  preserves the developer's commented profile-route demo.
- `docs/openapi.json` - regenerated with the exact `minLength: 3` constraint.
- `docs/api-reference.md` - regenerated with the readable three-character limit.
- `README.md` - documents the explicit Copilot trigger, comparison scope,
  setup, interview demo and limitations.
- `requirements.md` - records acceptance criteria for code-aware authoring and
  distinguishes it from deterministic CI checks.
- `architecture.md` - describes the local authoring stage and its boundaries.
- `CODE_REVIEW.md` - records review of this extension and its remaining risks.
- `VERIFICATION.md` - records the current 41-test gate and live update evidence,
  distinguishing model authoring from deterministic tests.
- `CHANGELOG.md` - records the local agent, change-discovery command and the
  customer-name validation behaviour change.
- `PR_DESCRIPTION.md` - supplies this submission summary, complete file
  inventory, test evidence, limitations and reviewer checklist.

## Test Evidence

Local `npm run verify` result:

```text
> tsc -p tsconfig.json
Pass

> eslint .
0 errors, 7 pre-existing warnings

Test Files  6 passed (6)
     Tests  41 passed (41)

> tsx src/scripts/docs.ts --check
Routes: 6 | documented operations: 6 | undocumented: 0 | orphaned: 0
Documentation is up to date.
```

Live demonstration:

1. Changed `createCustomerSchema` from `.min(1)` to `.min(3)`.
2. Confirmed the old `docs:check` still passed, demonstrating its semantic gap.
3. Inspected the validator, route, controller and validation middleware.
4. Updated the `POST /customers` annotation and ran `npm run docs:sync`.
5. Verified `name.minLength === 3` in the generated OpenAPI request schema and
   "at least 3 characters" in the generated Markdown.
6. Ran the complete verification gate successfully.

The six new tests exercise Git change discovery and deterministic generation;
they do not invoke an AI model or guarantee model-authored accuracy. See
[`VERIFICATION.md`](./VERIFICATION.md) for evidence and the historical baseline.
GitHub Actions runs the same gate when this branch is pushed.

## Known Limitations

- **Explicit trigger:** run `/sync-api-documentation` in local Copilot Chat.
  Saving code, `docs:sync`, `docs:changes`, and `verify` do not invoke AI.
- **Copilot setup:** requires Copilot agent access and BankApi opened as the
  workspace. This session exercised the authoring workflow; prompt discovery
  in a separate VS Code Chat instance has not been independently verified.
- **Human review:** CI verifies route coverage and generated freshness, not
  semantic agreement with validators or business logic. The agent must flag
  uncertain behaviour instead of inventing documentation.
- **Comparison scope:** defaults to HEAD versus the working tree. Already
  committed changes require an explicit comparison ref or endpoint scope.
- **Static scanner:** computed/dynamic routes and alternative mounting
  conventions are not supported. The exact route inventory test must be
  deliberately updated when real endpoints are added or removed.
- **Remaining `Not Found` entries:** the `skip` and `take` query parameter
  examples for `GET /accounts/{id}/transactions` are unspecified. Their limits
  and defaults are documented; no example values were invented.
- **Out of scope:** hosted AI updates in CI, automatic commits, database/server
  integration testing, and automatically deriving all schemas from Zod.
- **Existing dependency findings:** the original baseline recorded 13 audit
  findings; dependency remediation is outside this change, and no new audit
  claim is made. Seven existing `no-explicit-any` warnings remain visible.

## Reviewer Checklist

- [ ] Confirm the three-character customer-name rule is intentional.
- [ ] Compare the validator with its annotation and both generated artefacts.
- [ ] Run `/sync-api-documentation` in Copilot Chat and confirm the prompt or
      `documentation-updater` agent is available in the BankApi workspace.
- [ ] Confirm the action investigates semantic changes even if `docs:check`
      initially passes, and reports contradictory code rather than inventing.
- [ ] Review all listed added/modified files and preserve developer edits.
- [ ] Run `npm run verify` and confirm all 41 tests pass.
- [ ] Confirm the PR's GitHub Actions checks are green.
- [ ] Accept the remaining `Not Found` entries and stated limitations.
- [ ] Confirm no credentials, temporary demo edits or unexpected files are
      included before approving.
