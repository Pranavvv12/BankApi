# Requirements — Automated Documentation Sync

**Stage 1 of the Agentic SDLC workflow.**

## 1. Problem statement

The Bank API documents its HTTP surface with `@openapi` JSDoc annotations that
`swagger-jsdoc` turns into an OpenAPI document at runtime and serves from
`/docs`. That specification only ever exists **in memory**:

- Nothing is committed, so an API change is invisible in a pull request diff.
  A reviewer cannot tell whether a change is additive or breaking.
- A developer can add a route and forget the annotation. Nothing fails, and the
  endpoint is silently missing from `/docs` forever.
- An annotation can outlive the route it described, leaving documentation that
  promises an endpoint that no longer exists.
- Consumers have no machine readable artefact to generate clients from without
  booting the service against a live database.

Documentation therefore drifts away from the code, and the drift is only
discovered by whoever is misled by it.

## 2. User story

> As a backend engineer on the Bank API, I want the committed API documentation
> to be regenerated from the source and verified automatically, so that a route
> can never reach the default branch undocumented or described incorrectly.

### Acceptance criteria

1. Running one command regenerates the committed documentation from the source.
2. Running one command verifies the committed documentation without changing it,
   and exits non-zero when it is wrong.
3. Continuous integration runs that verification on every push and pull request.
4. A route added without an `@openapi` annotation fails the build, and the
   failure names the method, the path and the file.

## 3. Functional requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-01 | Discover every HTTP route the Express application registers, including routes mounted through a router barrel and routes declared directly on the app. | Must |
| FR-02 | Resolve each route to its full path, translating Express parameters (`:id`) into OpenAPI placeholders (`{id}`). | Must |
| FR-03 | Build the OpenAPI document from the `@openapi` annotations in the TypeScript sources. | Must |
| FR-04 | Write the specification to `docs/openapi.json` as a committed artefact. | Must |
| FR-05 | Render a human readable Markdown reference to `docs/api-reference.md` covering summary, description, parameters, request body, responses and examples. | Must |
| FR-06 | Report *undocumented* routes — registered in code, absent from the specification. | Must |
| FR-07 | Report *orphaned* operations — present in the specification, absent from the code. | Must |
| FR-08 | Provide a `--check` mode that verifies the artefacts without writing them and exits non-zero on failure. | Must |
| FR-09 | Fail the check on drift (FR-06) in preference to staleness, because regenerating cannot fix a missing annotation. | Must |
| FR-10 | Only write a file when its content actually changed, and report `updated` or `up-to-date`. | Should |
| FR-11 | Publish a documentation coverage summary inside the generated reference. | Should |
| FR-12 | Render an explicit `Not Found` marker wherever an annotation omits a field, rather than leaving a blank cell. | Should |
| FR-13 | Serve the runtime Swagger UI from the same definition the generator uses, so the two cannot diverge. | Must |

## 4. Non-functional requirements

| ID | Category | Requirement |
| --- | --- | --- |
| NFR-01 | Determinism | Output contains no timestamps, absolute paths, or other volatile data. Re-running without source changes must produce byte-identical files. |
| NFR-02 | Portability | The check must pass on Windows and Linux. Artefacts are written with `LF`; comparison normalises `CRLF` because Git may check them out with Windows endings. |
| NFR-03 | Isolation | The check must run without a database, network access, or a running server. |
| NFR-04 | Security | Source and output locations come from constructor configuration only. No caller-supplied filesystem path is ever accepted, so the tool cannot be used to read or write arbitrary files. |
| NFR-05 | Observability | Failures are typed (`SOURCE_NOT_FOUND`, `DOCUMENTATION_DRIFT`, `DOCUMENTATION_STALE`) and list the offending routes or files. |
| NFR-06 | Maintainability | Route discovery, specification building, coverage analysis and rendering are separate modules, each independently testable. |
| NFR-07 | Performance | A full check completes in under five seconds on a developer machine. |

## 5. Edge cases that must be handled

| Case | Expected behaviour |
| --- | --- |
| No routes directory | Fail with `SOURCE_NOT_FOUND` naming the missing directory — never emit an empty document silently. |
| No documented endpoints | Render an explicit "no documented endpoints were found" section with guidance, not a blank file. |
| Annotation missing a summary, tag or response | Render `Not Found` in that position. |
| A path that appears only inside an annotation comment | Must not be mistaken for a real route registration. |
| Artefacts checked out with `CRLF` | Treated as up to date, not stale. |
| Artefacts deleted | Treated as stale, not as "nothing to compare". |

## 6. Out of scope

- Automatically committing regenerated documentation back to the branch. The
  pipeline *detects* drift; a human resolves it. This keeps CI from pushing to
  protected branches.
- Deriving schemas from the Zod validators. The `@openapi` annotations remain
  the single authoring surface; inferring from Zod is a possible follow-up.
- Publishing the documentation to an external site.
- Runtime behaviour of the banking endpoints themselves.
