import { describe, expect, it } from 'vitest';
import { buildCoverageReport, listDocumentedOperations } from '../src/docs/coverage.js';
import type { DiscoveredRoute, OpenApiSpec } from '../src/docs/types.js';

const spec: OpenApiSpec = {
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/widgets': { post: { summary: 'Create a widget' } },
    '/legacy': { get: { summary: 'Removed endpoint' } }
  }
};

const routes: DiscoveredRoute[] = [
  { method: 'POST', path: '/widgets', source: 'src/routes/widgets.routes.ts' },
  { method: 'GET', path: '/widgets/{id}', source: 'src/routes/widgets.routes.ts' }
];

describe('listDocumentedOperations', () => {
  it('flattens the specification in a deterministic order', () => {
    const operations = listDocumentedOperations(spec);
    expect(operations.map((entry) => `${entry.method} ${entry.path}`)).toEqual([
      'GET /legacy',
      'POST /widgets'
    ]);
  });
});

describe('buildCoverageReport', () => {
  it('flags routes that have no annotation', () => {
    const report = buildCoverageReport(routes, spec);

    expect(report.undocumented).toEqual([
      { method: 'GET', path: '/widgets/{id}', source: 'src/routes/widgets.routes.ts' }
    ]);
    expect(report.covered).toHaveLength(1);
  });

  it('flags annotations that no longer have a route', () => {
    const report = buildCoverageReport(routes, spec);
    expect(report.orphaned).toEqual([{ method: 'GET', path: '/legacy' }]);
  });

  it('reports full coverage when code and annotations agree', () => {
    const alignedSpec: OpenApiSpec = {
      ...spec,
      paths: {
        '/widgets': { post: { summary: 'Create a widget' } },
        '/widgets/{id}': { get: { summary: 'Fetch a widget' } }
      }
    };

    const report = buildCoverageReport(routes, alignedSpec);

    expect(report.undocumented).toEqual([]);
    expect(report.orphaned).toEqual([]);
    expect(report.totalRoutes).toBe(2);
    expect(report.totalDocumented).toBe(2);
  });
});
