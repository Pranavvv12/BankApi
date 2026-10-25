import path from 'node:path';
import swaggerJSDoc from 'swagger-jsdoc';
import { DOC_SOURCE_GLOBS, swaggerOptions } from './specOptions.js';
import type { OpenApiSpec } from './types.js';

/** `glob` requires POSIX separators, which Windows paths do not use. */
function toGlobPath(projectRoot: string, pattern: string): string {
  return path.resolve(projectRoot, pattern).split(path.sep).join('/');
}

/** Produces a copy of the spec with deterministically ordered path keys. */
function withSortedPaths(spec: OpenApiSpec): OpenApiSpec {
  const paths: OpenApiSpec['paths'] = {};
  for (const key of Object.keys(spec.paths ?? {}).sort()) {
    paths[key] = spec.paths[key];
  }
  return { ...spec, paths };
}

/**
 * Builds the OpenAPI document from the `@openapi` annotations in the source.
 *
 * The result is deterministic so that re-running the generator without source
 * changes produces byte-identical output.
 */
export function buildSpec(projectRoot: string, globs: string[] = DOC_SOURCE_GLOBS): OpenApiSpec {
  const spec = swaggerJSDoc({
    definition: swaggerOptions.definition,
    apis: globs.map((pattern) => toGlobPath(projectRoot, pattern))
  }) as OpenApiSpec;

  return withSortedPaths({ ...spec, paths: spec.paths ?? {} });
}
