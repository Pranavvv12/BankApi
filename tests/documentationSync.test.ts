import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentationSyncService } from '../src/docs/documentationSync.js';
import { isDocumentationError } from '../src/docs/errors.js';
import { createFixture, type Fixture } from './fixtures.js';

describe('DocumentationSyncService', () => {
  let fixture: Fixture;
  let service: DocumentationSyncService;

  beforeEach(async () => {
    fixture = await createFixture();
    service = new DocumentationSyncService({ projectRoot: fixture.root });
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  async function expectCode(promise: Promise<unknown>, code: string): Promise<string[]> {
    try {
      await promise;
    } catch (error) {
      expect(isDocumentationError(error)).toBe(true);
      if (isDocumentationError(error)) {
        expect(error.code).toBe(code);
        return error.details;
      }
    }
    return expect.fail(`expected the operation to fail with ${code}`);
  }

  it('writes both artefacts on the first run', async () => {
    const result = await service.sync();

    expect(result.status).toBe('updated');
    expect(result.coverage.undocumented).toEqual([]);
    expect(result.coverage.orphaned).toEqual([]);

    const spec = JSON.parse(await fs.readFile(result.specPath, 'utf8'));
    expect(Object.keys(spec.paths).sort()).toEqual(['/healthz', '/widgets', '/widgets/{id}']);

    const markdown = await fs.readFile(result.referencePath, 'utf8');
    expect(markdown).toContain('### `POST` `/widgets`');
    expect(markdown).toContain('Every registered route is documented');
  });

  it('reports up-to-date and rewrites nothing on a repeated run', async () => {
    await service.sync();
    const before = await fs.stat(service.referencePath);

    const result = await service.sync();

    expect(result.status).toBe('up-to-date');
    expect((await fs.stat(service.referencePath)).mtimeMs).toBe(before.mtimeMs);
  });

  it('passes the check once the artefacts are in sync', async () => {
    await service.sync();
    await expect(service.check()).resolves.toMatchObject({ status: 'up-to-date' });
  });

  it('fails the check when the committed reference is edited by hand', async () => {
    await service.sync();
    await fs.appendFile(service.referencePath, '\nHand written note.\n', 'utf8');

    const details = await expectCode(service.check(), 'DOCUMENTATION_STALE');
    expect(details.join(' ')).toContain('api-reference.md');
  });

  it('fails the check when the specification is missing entirely', async () => {
    await service.sync();
    await fs.rm(service.specPath);

    const details = await expectCode(service.check(), 'DOCUMENTATION_STALE');
    expect(details.join(' ')).toContain('openapi.json');
  });

  it('fails the check when a route has no annotation', async () => {
    await service.sync();
    await fixture.write(
      'src/routes/widgets.routes.ts',
      [
        "import { Router } from 'express';",
        'const r = Router();',
        "r.post('/', createWidget);",
        "r.get('/:id', getWidget);",
        "r.delete('/:id', removeWidget);",
        'export default r;'
      ].join('\n')
    );

    const details = await expectCode(service.check(), 'DOCUMENTATION_DRIFT');
    expect(details.join(' ')).toContain('DELETE /widgets/{id}');
  });

  it('records a newly annotated route after regeneration', async () => {
    await service.sync();
    await fixture.write(
      'src/routes/widgets.routes.ts',
      [
        "import { Router } from 'express';",
        'const r = Router();',
        '/**',
        ' * @openapi',
        ' * /widgets/{id}:',
        ' *   delete:',
        ' *     summary: Delete a widget',
        ' *     tags:',
        ' *       - Widgets',
        ' *     responses:',
        ' *       204:',
        ' *         description: Widget deleted',
        ' */',
        "r.delete('/:id', removeWidget);",
        'export default r;'
      ].join('\n')
    );

    const result = await service.sync();

    expect(result.status).toBe('updated');
    expect(result.coverage.undocumented).toEqual([]);
    expect(await fs.readFile(result.referencePath, 'utf8')).toContain('Delete a widget');
  });

  it('tolerates artefacts checked out with Windows line endings', async () => {
    await service.sync();

    for (const target of [service.specPath, service.referencePath]) {
      const content = await fs.readFile(target, 'utf8');
      await fs.writeFile(target, content.replace(/\n/g, '\r\n'), 'utf8');
    }

    await expect(service.check()).resolves.toMatchObject({ status: 'up-to-date' });
  });

  it('surfaces a typed error when the source tree is absent', async () => {
    const broken = new DocumentationSyncService({
      projectRoot: fixture.root,
      routesDir: 'src/missing'
    });

    await expectCode(broken.sync(), 'SOURCE_NOT_FOUND');
  });

  it('writes the artefacts into the configured output directory', async () => {
    const custom = new DocumentationSyncService({
      projectRoot: fixture.root,
      outputDir: path.join('build', 'reference')
    });

    const result = await custom.sync();

    expect(result.referencePath).toContain(path.join('build', 'reference'));
    await expect(fs.stat(result.referencePath)).resolves.toBeDefined();
  });
});
