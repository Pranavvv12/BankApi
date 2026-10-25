import fs from 'node:fs/promises';
import path from 'node:path';
import { buildSpec } from './buildSpec.js';
import { buildCoverageReport } from './coverage.js';
import { DocumentationError } from './errors.js';
import { renderMarkdown } from './markdown.js';
import { scanRoutes } from './routeScanner.js';
import type { CoverageReport, OpenApiSpec, SyncResult } from './types.js';

export interface DocumentationSyncOptions {
  /** Absolute path to the repository root. */
  projectRoot: string;
  /** Repository-relative directory the artefacts are written to. */
  outputDir?: string;
  appFile?: string;
  routesDir?: string;
  docGlobs?: string[];
}

interface GeneratedDocumentation {
  spec: OpenApiSpec;
  specJson: string;
  markdown: string;
  coverage: CoverageReport;
}

const SPEC_FILE = 'openapi.json';
const REFERENCE_FILE = 'api-reference.md';

/**
 * Keeps the committed API documentation in step with the Express sources.
 *
 * Paths are taken from constructor configuration only; nothing accepts a
 * caller supplied filesystem location, so the HTTP surface cannot be used to
 * read or write arbitrary files.
 */
export class DocumentationSyncService {
  private readonly projectRoot: string;
  private readonly outputDir: string;
  private readonly appFile: string;
  private readonly routesDir: string;
  private readonly docGlobs?: string[];

  constructor(options: DocumentationSyncOptions) {
    this.projectRoot = options.projectRoot;
    this.outputDir = options.outputDir ?? 'docs';
    this.appFile = options.appFile ?? 'src/app.ts';
    this.routesDir = options.routesDir ?? 'src/routes';
    this.docGlobs = options.docGlobs;
  }

  get specPath(): string {
    return path.join(this.projectRoot, this.outputDir, SPEC_FILE);
  }

  get referencePath(): string {
    return path.join(this.projectRoot, this.outputDir, REFERENCE_FILE);
  }

  /** Writes the artefacts, reporting whether anything actually changed. */
  async sync(): Promise<SyncResult> {
    const generated = await this.generate();
    await fs.mkdir(path.dirname(this.specPath), { recursive: true });

    const specChanged = (await this.readOutput(this.specPath)) !== generated.specJson;
    const referenceChanged = (await this.readOutput(this.referencePath)) !== generated.markdown;

    if (specChanged) await fs.writeFile(this.specPath, generated.specJson, 'utf8');
    if (referenceChanged) await fs.writeFile(this.referencePath, generated.markdown, 'utf8');

    return {
      status: specChanged || referenceChanged ? 'updated' : 'up-to-date',
      specPath: this.specPath,
      referencePath: this.referencePath,
      coverage: generated.coverage
    };
  }

  /**
   * Verifies the committed artefacts without modifying them.
   *
   * Drift is reported before staleness because a missing annotation cannot be
   * resolved by regenerating the files.
   */
  async check(): Promise<SyncResult> {
    const generated = await this.generate();

    if (generated.coverage.undocumented.length > 0) {
      throw new DocumentationError(
        'DOCUMENTATION_DRIFT',
        'Routes are registered without an @openapi annotation.',
        generated.coverage.undocumented.map(
          (route) => `${route.method} ${route.path} (${route.source})`
        )
      );
    }

    const stale: string[] = [];
    if ((await this.readOutput(this.specPath)) !== generated.specJson) {
      stale.push(path.join(this.outputDir, SPEC_FILE));
    }
    if ((await this.readOutput(this.referencePath)) !== generated.markdown) {
      stale.push(path.join(this.outputDir, REFERENCE_FILE));
    }

    if (stale.length > 0) {
      throw new DocumentationError(
        'DOCUMENTATION_STALE',
        'Committed documentation is out of date. Run `npm run docs:sync`.',
        stale
      );
    }

    return {
      status: 'up-to-date',
      specPath: this.specPath,
      referencePath: this.referencePath,
      coverage: generated.coverage
    };
  }

  private async generate(): Promise<GeneratedDocumentation> {
    const routes = await scanRoutes({
      projectRoot: this.projectRoot,
      appFile: this.appFile,
      routesDir: this.routesDir
    });

    const spec = buildSpec(this.projectRoot, this.docGlobs);
    const coverage = buildCoverageReport(routes, spec);

    return {
      spec,
      specJson: `${JSON.stringify(spec, null, 2)}\n`,
      markdown: renderMarkdown(spec, routes, coverage),
      coverage
    };
  }

  /**
   * Reads a generated file, normalising CRLF to LF.
   *
   * Git checks the artefacts out with CRLF on Windows while the generator
   * always emits LF, so a raw byte comparison would report false staleness.
   */
  private async readOutput(filePath: string): Promise<string | undefined> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content.replace(/\r\n/g, '\n');
    } catch {
      return undefined;
    }
  }
}
