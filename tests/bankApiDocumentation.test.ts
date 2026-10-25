import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DocumentationSyncService } from '../src/docs/documentationSync.js';
import { scanRoutes } from '../src/docs/routeScanner.js';
import { buildSpec } from '../src/docs/buildSpec.js';
import { buildCoverageReport } from '../src/docs/coverage.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Guards the real repository rather than a fixture: these assertions fail the
 * build whenever a Bank API route drifts away from its documentation.
 */
describe('Bank API documentation', () => {
  it('discovers every route the application registers', async () => {
    const routes = await scanRoutes({ projectRoot });

    expect(routes.map((route) => `${route.method} ${route.path}`)).toEqual([
      'POST /accounts',
      'GET /accounts/{id}/balance',
      'GET /accounts/{id}/transactions',
      'POST /customers',
      'GET /healthz',
      'POST /transfers'
    ]);
  });

  it('documents every registered route', async () => {
    const routes = await scanRoutes({ projectRoot });
    const coverage = buildCoverageReport(routes, buildSpec(projectRoot));

    expect(coverage.undocumented).toEqual([]);
    expect(coverage.orphaned).toEqual([]);
  });

  it('includes application level routes annotated outside the routes directory', async () => {
    const spec = buildSpec(projectRoot);
    expect(spec.paths['/healthz']?.get?.summary).toBe('Health check endpoint');
  });

  it('keeps the committed artefacts in sync with the source', async () => {
    const service = new DocumentationSyncService({ projectRoot });
    await expect(service.check()).resolves.toMatchObject({ status: 'up-to-date' });
  });
});
