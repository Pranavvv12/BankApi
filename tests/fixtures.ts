import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Annotated application file exposing `GET /healthz`. */
export const APP_SOURCE = `import express from 'express';
import routes from './routes/index.js';

export function buildApp() {
  const app = express();

  /**
   * @openapi
   * /healthz:
   *   get:
   *     summary: Health check endpoint
   *     tags:
   *       - Health
   *     responses:
   *       200:
   *         description: API is healthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: "ok"
   */
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  app.use(routes);
  return app;
}
`;

export const ROUTES_INDEX_SOURCE = `import { Router } from 'express';
import widgets from './widgets.routes.js';

const router = Router();
router.use('/widgets', widgets);
export default router;
`;

/** Router exposing `POST /widgets` and `GET /widgets/:id`. */
export const WIDGETS_ROUTES_SOURCE = `import { Router } from 'express';

const r = Router();

/**
 * @openapi
 * /widgets:
 *   post:
 *     summary: Create a widget
 *     description: Creates a brand new widget
 *     tags:
 *       - Widgets
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Widget name
 *                 example: "Sprocket"
 *               size:
 *                 type: integer
 *                 minimum: 1
 *                 default: 3
 *     responses:
 *       201:
 *         description: Widget created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 7
 */
r.post('/', createWidget);

/**
 * @openapi
 * /widgets/{id}:
 *   get:
 *     summary: Fetch a widget
 *     tags:
 *       - Widgets
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Widget ID
 *         example: 7
 *     responses:
 *       200:
 *         description: The widget
 */
r.get('/:id', getWidget);

export default r;
`;

export interface Fixture {
  root: string;
  write(relativePath: string, contents: string): Promise<void>;
  cleanup(): Promise<void>;
}

/** Creates a throwaway project that mirrors the repository's route layout. */
export async function createFixture(): Promise<Fixture> {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'bankapi-docs-'));
  // Resolve symlinks (macOS/Windows temp dirs) so glob patterns match.
  const root = await fs.realpath(base);

  const write = async (relativePath: string, contents: string) => {
    const target = path.join(root, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents, 'utf8');
  };

  await write('src/app.ts', APP_SOURCE);
  await write('src/routes/index.ts', ROUTES_INDEX_SOURCE);
  await write('src/routes/widgets.routes.ts', WIDGETS_ROUTES_SOURCE);

  return {
    root,
    write,
    cleanup: () => fs.rm(base, { recursive: true, force: true })
  };
}
