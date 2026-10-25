import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import { Express } from 'express';
import { API_SOURCE_GLOBS, swaggerOptions } from '../docs/specOptions.js';

export function mountSwagger(app: Express) {
  const spec = swaggerJSDoc({
    definition: swaggerOptions.definition,
    apis: API_SOURCE_GLOBS
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
}
