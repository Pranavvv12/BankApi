import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectDocumentationChanges } from '../src/docs/changeContext.js';
import { DocumentationSyncService } from '../src/docs/documentationSync.js';
import { createFixture, WIDGETS_ROUTES_SOURCE, type Fixture } from './fixtures.js';

const execute = promisify(execFile);

describe('documentation change discovery', () => {
  let fixture: Fixture;

  async function git(...args: string[]): Promise<string> {
    const { stdout } = await execute('git', args, { cwd: fixture.root });
    return stdout.trim();
  }

  beforeEach(async () => {
    fixture = await createFixture();
    await git('init', '-q');
    await git('config', 'user.name', 'Documentation tests');
    await git('config', 'user.email', 'tests@example.invalid');
    await git('config', 'commit.gpgsign', 'false');
    await git('config', 'core.hooksPath', '.disabled-test-hooks');
    await git('add', '.');
    await git('commit', '-qm', 'fixture baseline');
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  it('reports no changes for a clean tree', async () => {
    const context = await collectDocumentationChanges(fixture.root);
    expect(context.changedFiles).toEqual([]);
    expect(context.baseCommit).toBe(await git('rev-parse', 'HEAD'));
  });

  it('includes staged, unstaged and new sources without reading ignored secrets', async () => {
    await fixture.write('src/app.ts', '// staged change\n');
    await git('add', 'src/app.ts');
    await fixture.write('src/routes/index.ts', '// unstaged change\n');
    await fixture.write('src/services/new service.ts', 'export const limit = 3;\n');
    await fixture.write('.gitignore', '.env\n');
    await fixture.write('.env', 'PRIVATE_VALUE=do-not-read\n');

    const context = await collectDocumentationChanges(fixture.root);
    expect(context.sourceFiles).toEqual([
      'src/app.ts', 'src/routes/index.ts', 'src/services/new service.ts'
    ]);
    expect(context.changedFiles).not.toContain('.env');
  });

  it('retains deleted and renamed paths so removed endpoints can be investigated', async () => {
    await git('mv', 'src/app.ts', 'src/renamed app.ts');
    await fs.unlink(path.join(fixture.root, 'src/routes/widgets.routes.ts'));
    const context = await collectDocumentationChanges(fixture.root);
    expect(context.sourceFiles).toContain('src/app.ts');
    expect(context.sourceFiles).toContain('src/renamed app.ts');
    expect(context.sourceFiles).toContain('src/routes/widgets.routes.ts');
  });

  it('uses an explicit base to include changes already committed', async () => {
    const base = await git('rev-parse', 'HEAD');
    await fixture.write('src/app.ts', '// committed behaviour change\n');
    await git('add', '.');
    await git('commit', '-qm', 'changed implementation');
    expect((await collectDocumentationChanges(fixture.root)).sourceFiles).toEqual([]);
    expect((await collectDocumentationChanges(fixture.root, base)).sourceFiles)
      .toEqual(['src/app.ts']);
  });

  it('rejects an invalid base instead of reporting a clean tree', async () => {
    await expect(collectDocumentationChanges(fixture.root, 'missing-ref')).rejects.toThrow();
  });

  it('discovers semantic source changes even when the generator check passes', async () => {
    const service = new DocumentationSyncService({ projectRoot: fixture.root });
    await service.sync();
    await git('add', '.');
    await git('commit', '-qm', 'generated baseline');
    await fixture.write(
      'src/schemas/widgets.schema.ts',
      "import { z } from 'zod';\nexport const name = z.string().min(3);\n"
    );

    await expect(service.check()).resolves.toMatchObject({ status: 'up-to-date' });
    expect((await collectDocumentationChanges(fixture.root)).sourceFiles)
      .toContain('src/schemas/widgets.schema.ts');

    // This models the authoring step; it does not invoke or test an AI model.
    await fixture.write(
      'src/routes/widgets.routes.ts',
      WIDGETS_ROUTES_SOURCE.replace(
        'description: Widget name',
        'minLength: 3\n *                 description: Widget name (at least 3 characters)'
      )
    );
    await service.sync();
    const spec = JSON.parse(await fs.readFile(service.specPath, 'utf8'));
    expect(
      spec.paths['/widgets'].post.requestBody.content['application/json'].schema.properties.name
        .minLength
    ).toBe(3);
    expect(await fs.readFile(service.referencePath, 'utf8'))
      .toContain('Widget name (at least 3 characters)');
    await expect(service.check()).resolves.toMatchObject({ status: 'up-to-date' });
  });
});
