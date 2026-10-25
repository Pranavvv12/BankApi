import process from 'node:process';
import path from 'node:path';
import { DocumentationSyncService } from '../docs/documentationSync.js';
import { isDocumentationError } from '../docs/errors.js';
import type { CoverageReport } from '../docs/types.js';

function reportCoverage(coverage: CoverageReport): void {
  console.log(
    `Routes: ${coverage.totalRoutes} | documented operations: ${coverage.totalDocumented} | ` +
      `undocumented: ${coverage.undocumented.length} | orphaned: ${coverage.orphaned.length}`
  );
  for (const route of coverage.undocumented) {
    console.log(`  undocumented  ${route.method} ${route.path} (${route.source})`);
  }
  for (const entry of coverage.orphaned) {
    console.log(`  orphaned      ${entry.method} ${entry.path}`);
  }
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes('--check');
  const projectRoot = process.cwd();
  const service = new DocumentationSyncService({ projectRoot });

  try {
    const result = checkOnly ? await service.check() : await service.sync();
    reportCoverage(result.coverage);

    if (checkOnly) {
      console.log('Documentation is up to date.');
      return;
    }

    const relative = (target: string) => path.relative(projectRoot, target).replace(/\\/g, '/');
    console.log(
      result.status === 'updated'
        ? `Updated ${relative(result.specPath)} and ${relative(result.referencePath)}.`
        : 'Documentation already up to date; nothing was written.'
    );

    if (result.coverage.undocumented.length > 0) {
      console.warn(
        'Warning: undocumented routes were recorded in the reference. ' +
          'Add an @openapi annotation for each one before committing.'
      );
    }
  } catch (error) {
    if (isDocumentationError(error)) {
      console.error(`${error.code}: ${error.message}`);
      for (const detail of error.details) console.error(`  - ${detail}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
