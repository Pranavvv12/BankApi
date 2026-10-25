import fs from 'node:fs/promises';
import path from 'node:path';
import { DocumentationError } from './errors.js';
import type { DiscoveredRoute } from './types.js';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

const ROUTE_CALL_PATTERN = new RegExp(
  String.raw`\b[A-Za-z_$][\w$]*\s*\.\s*(${HTTP_METHODS.join('|')})\s*\(\s*['"\`]([^'"\`]*)['"\`]`,
  'g'
);

const DEFAULT_IMPORT_PATTERN = /import\s+(\w+)\s+from\s+['"]\.\/([^'"]+)['"]/g;
const MOUNT_PATTERN = /\.use\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\s*\)/g;

export interface RouteScannerOptions {
  /** Absolute path to the repository root. */
  projectRoot: string;
  /** Repository-relative path to the Express application factory. */
  appFile?: string;
  /** Repository-relative path to the directory holding the route modules. */
  routesDir?: string;
}

/**
 * Removes comments so that the `@openapi` JSDoc blocks cannot be mistaken for
 * real route registrations.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Joins a mount prefix with a router sub-path and converts `:id` to `{id}`. */
export function toOpenApiPath(prefix: string, segment: string): string {
  const joined = `${prefix}${segment.startsWith('/') ? segment : `/${segment}`}`.replace(
    /\/{2,}/g,
    '/'
  );
  const trimmed = joined.length > 1 ? joined.replace(/\/+$/, '') : joined;
  return (trimmed === '' ? '/' : trimmed).replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

async function readIfPresent(absolutePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(absolutePath, 'utf8');
  } catch {
    return undefined;
  }
}

function extractRouteCalls(source: string, prefix: string, sourceLabel: string): DiscoveredRoute[] {
  const cleaned = stripComments(source);
  const routes: DiscoveredRoute[] = [];
  for (const match of cleaned.matchAll(ROUTE_CALL_PATTERN)) {
    routes.push({
      method: match[1].toUpperCase(),
      path: toOpenApiPath(prefix, match[2]),
      source: sourceLabel
    });
  }
  return routes;
}

/**
 * Resolves the mount prefix of every router module by reading the router
 * barrel file, e.g. `router.use('/accounts', accounts)` combined with
 * `import accounts from './accounts.routes.js'` yields `accounts.routes -> /accounts`.
 */
function resolveMountPrefixes(indexSource: string): Map<string, string> {
  const cleaned = stripComments(indexSource);
  const identifierToModule = new Map<string, string>();

  for (const match of cleaned.matchAll(DEFAULT_IMPORT_PATTERN)) {
    identifierToModule.set(match[1], match[2].replace(/\.js$/, ''));
  }

  const moduleToPrefix = new Map<string, string>();
  for (const match of cleaned.matchAll(MOUNT_PATTERN)) {
    const moduleName = identifierToModule.get(match[2]);
    if (moduleName) moduleToPrefix.set(moduleName, match[1]);
  }
  return moduleToPrefix;
}

/**
 * Statically discovers every HTTP route the application registers.
 *
 * A static scan is used instead of booting Express so the check can run in CI
 * without a database or any other runtime dependency.
 */
export async function scanRoutes(options: RouteScannerOptions): Promise<DiscoveredRoute[]> {
  const { projectRoot, appFile = 'src/app.ts', routesDir = 'src/routes' } = options;
  const absoluteRoutesDir = path.join(projectRoot, routesDir);

  let entries: string[];
  try {
    entries = await fs.readdir(absoluteRoutesDir);
  } catch {
    throw new DocumentationError(
      'SOURCE_NOT_FOUND',
      `Unable to read the routes directory "${routesDir}".`,
      [absoluteRoutesDir]
    );
  }

  const routes: DiscoveredRoute[] = [];

  const appSource = await readIfPresent(path.join(projectRoot, appFile));
  if (appSource) {
    routes.push(...extractRouteCalls(appSource, '', appFile));
  }

  const indexSource = await readIfPresent(path.join(absoluteRoutesDir, 'index.ts'));
  const prefixes = indexSource ? resolveMountPrefixes(indexSource) : new Map<string, string>();

  const routeModules = entries
    .filter((entry) => entry.endsWith('.ts') && entry !== 'index.ts')
    .sort();

  for (const entry of routeModules) {
    const moduleName = entry.replace(/\.ts$/, '');
    const source = await fs.readFile(path.join(absoluteRoutesDir, entry), 'utf8');
    const label = `${routesDir}/${entry}`;
    routes.push(...extractRouteCalls(source, prefixes.get(moduleName) ?? '', label));
  }

  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}
