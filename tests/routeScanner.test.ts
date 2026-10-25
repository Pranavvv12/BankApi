import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanRoutes, toOpenApiPath } from '../src/docs/routeScanner.js';
import { isDocumentationError } from '../src/docs/errors.js';
import { createFixture, type Fixture } from './fixtures.js';

describe('toOpenApiPath', () => {
  it('converts Express parameters to OpenAPI placeholders', () => {
    expect(toOpenApiPath('/accounts', '/:id/balance')).toBe('/accounts/{id}/balance');
  });

  it('collapses the router root path onto its mount prefix', () => {
    expect(toOpenApiPath('/customers', '/')).toBe('/customers');
  });

  it('keeps unmounted application routes at the root', () => {
    expect(toOpenApiPath('', '/healthz')).toBe('/healthz');
  });
});

describe('scanRoutes', () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await createFixture();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  it('discovers application and mounted router registrations', async () => {
    const routes = await scanRoutes({ projectRoot: fixture.root });

    expect(routes).toEqual([
      { method: 'GET', path: '/healthz', source: 'src/app.ts' },
      { method: 'POST', path: '/widgets', source: 'src/routes/widgets.routes.ts' },
      { method: 'GET', path: '/widgets/{id}', source: 'src/routes/widgets.routes.ts' }
    ]);
  });

  it('ignores paths that only appear inside annotation comments', async () => {
    await fixture.write(
      'src/routes/widgets.routes.ts',
      [
        "import { Router } from 'express';",
        'const r = Router();',
        '/**',
        ' * @openapi',
        ' * /widgets/decoy:',
        ' *   delete:',
        ' *     summary: Not a real registration',
        ' */',
        "r.post('/', createWidget);",
        'export default r;'
      ].join('\n')
    );

    const routes = await scanRoutes({ projectRoot: fixture.root });
    const paths = routes.map((route) => `${route.method} ${route.path}`);

    expect(paths).toContain('POST /widgets');
    expect(paths).not.toContain('DELETE /widgets/decoy');
  });

  it('reports a typed error when the routes directory is missing', async () => {
    const promise = scanRoutes({ projectRoot: fixture.root, routesDir: 'src/not-here' });

    await expect(promise).rejects.toThrow(/routes directory/);
    await promise.catch((error) => {
      expect(isDocumentationError(error)).toBe(true);
      if (isDocumentationError(error)) expect(error.code).toBe('SOURCE_NOT_FOUND');
    });
  });
});
