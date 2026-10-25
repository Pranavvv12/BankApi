/**
 * Shared OpenAPI source definition.
 *
 * This module is the single source of truth for the generated specification so
 * that the runtime Swagger UI and the committed documentation artefacts can
 * never disagree with each other.
 */
export interface OpenApiServer {
  url: string;
  description?: string;
}

export interface SwaggerDefinition {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: OpenApiServer[];
}

export interface SwaggerOptions {
  definition: SwaggerDefinition;
  apis: string[];
}

/**
 * Globs scanned for `@openapi` annotations. `src/app.ts` is included because
 * application level routes such as `/healthz` are annotated there.
 */
export const API_SOURCE_GLOBS = [
  './src/app.ts',
  './src/routes/*.ts',
  './dist/src/app.js',
  './dist/src/routes/*.js'
];

/**
 * Globs used when generating the committed artefacts. Only the TypeScript
 * sources are scanned so the output never depends on whether `dist/` happens
 * to be present or stale.
 */
export const DOC_SOURCE_GLOBS = ['./src/app.ts', './src/routes/*.ts'];

export const swaggerOptions: SwaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bank API',
      version: '1.0.0',
      description: 'REST API for bank backoffice operations'
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development server' },
      { url: 'http://localhost:3001', description: 'Docker container' }
    ]
  },
  apis: API_SOURCE_GLOBS
};
