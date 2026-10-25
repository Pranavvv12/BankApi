import type { CoverageReport, DiscoveredRoute, DocumentedOperation, OpenApiSpec } from './types.js';

const HTTP_METHOD_ORDER = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

function key(method: string, routePath: string): string {
  return `${method.toUpperCase()} ${routePath}`;
}

/** Flattens the spec into a deterministically ordered list of operations. */
export function listDocumentedOperations(spec: OpenApiSpec): DocumentedOperation[] {
  const operations: DocumentedOperation[] = [];
  for (const [routePath, methods] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(methods ?? {})) {
      operations.push({ method: method.toUpperCase(), path: routePath, operation });
    }
  }
  return operations.sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      HTTP_METHOD_ORDER.indexOf(a.method) - HTTP_METHOD_ORDER.indexOf(b.method)
  );
}

/**
 * Compares the routes registered in code against the generated specification.
 *
 * This is the drift detector: a route added without an `@openapi` annotation
 * shows up as `undocumented`, and an annotation left behind after a route was
 * deleted shows up as `orphaned`.
 */
export function buildCoverageReport(
  routes: DiscoveredRoute[],
  spec: OpenApiSpec
): CoverageReport {
  const documented = listDocumentedOperations(spec);
  const documentedKeys = new Set(documented.map((entry) => key(entry.method, entry.path)));
  const routeKeys = new Set(routes.map((route) => key(route.method, route.path)));

  const covered = routes.filter((route) => documentedKeys.has(key(route.method, route.path)));
  const undocumented = routes.filter((route) => !documentedKeys.has(key(route.method, route.path)));
  const orphaned = documented
    .filter((entry) => !routeKeys.has(key(entry.method, entry.path)))
    .map((entry) => ({ method: entry.method, path: entry.path }));

  return {
    covered,
    undocumented,
    orphaned,
    totalRoutes: routes.length,
    totalDocumented: documented.length
  };
}
