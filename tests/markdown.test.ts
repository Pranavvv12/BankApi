import { describe, expect, it } from 'vitest';
import { buildCoverageReport } from '../src/docs/coverage.js';
import { NOT_FOUND, exampleFromSchema, renderMarkdown } from '../src/docs/markdown.js';
import type { DiscoveredRoute, OpenApiSpec } from '../src/docs/types.js';

const routes: DiscoveredRoute[] = [
  { method: 'POST', path: '/widgets', source: 'src/routes/widgets.routes.ts' }
];

const spec: OpenApiSpec = {
  openapi: '3.0.0',
  info: { title: 'Widget API', version: '2.1.0', description: 'Widget management' },
  servers: [{ url: 'http://localhost:3000', description: 'Development server' }],
  paths: {
    '/widgets': {
      post: {
        summary: 'Create a widget',
        description: 'Creates a brand new widget',
        tags: ['Widgets'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', description: 'Widget name', example: 'Sprocket' },
                  size: { type: 'integer', minimum: 1, default: 3 }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Widget created',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { id: { type: 'integer', example: 7 } } }
              }
            }
          }
        }
      }
    }
  }
};

function render(target: OpenApiSpec, discovered: DiscoveredRoute[] = routes): string {
  return renderMarkdown(target, discovered, buildCoverageReport(discovered, target));
}

describe('exampleFromSchema', () => {
  it('builds a sample object from nested property examples', () => {
    expect(
      exampleFromSchema({
        type: 'object',
        properties: { error: { type: 'object', properties: { message: { example: 'Boom' } } } }
      })
    ).toEqual({ error: { message: 'Boom' } });
  });

  it('falls back to the declared default', () => {
    expect(exampleFromSchema({ type: 'integer', default: 3 })).toBe(3);
  });

  it('returns undefined when nothing can be inferred', () => {
    expect(exampleFromSchema({ type: 'string', format: 'date-time' })).toBeUndefined();
  });
});

describe('renderMarkdown', () => {
  it('documents metadata, servers and the endpoint index', () => {
    const markdown = render(spec);

    expect(markdown).toContain('# Widget API — API Reference');
    expect(markdown).toContain('| API version | 2.1.0 |');
    expect(markdown).toContain('| `http://localhost:3000` | Development server |');
    expect(markdown).toContain('| `POST` | `/widgets` | Create a widget | Widgets |');
  });

  it('renders request body fields, constraints and an example payload', () => {
    const markdown = render(spec);

    expect(markdown).toContain('**Request body** (required)');
    expect(markdown).toContain('| `name` | string | Yes | Widget name | `Sprocket` |');
    expect(markdown).toContain('| `size` | integer | No | min: 1, default: 3 | ' + NOT_FOUND + ' |');
    expect(markdown).toContain('"name": "Sprocket"');
  });

  it('renders response codes with their examples', () => {
    const markdown = render(spec);

    expect(markdown).toContain('| `201` | Widget created |');
    expect(markdown).toContain('Example response `201`:');
    expect(markdown).toContain('"id": 7');
  });

  it('records the source file each operation is registered in', () => {
    expect(render(spec)).toContain('Registered in: `src/routes/widgets.routes.ts`');
  });

  it('marks missing annotation fields as Not Found', () => {
    const sparse: OpenApiSpec = {
      openapi: '3.0.0',
      info: { title: 'Sparse API', version: '1.0.0' },
      paths: { '/widgets': { post: {} } }
    };

    const markdown = render(sparse);

    expect(markdown).toContain(`| \`POST\` | \`/widgets\` | ${NOT_FOUND} | ${NOT_FOUND} |`);
    expect(markdown).toContain(`No documented responses — ${NOT_FOUND}`);
  });

  it('explains the empty case instead of emitting a blank document', () => {
    const empty: OpenApiSpec = {
      openapi: '3.0.0',
      info: { title: 'Empty API', version: '1.0.0' },
      paths: {}
    };

    const markdown = renderMarkdown(empty, [], buildCoverageReport([], empty));

    expect(markdown).toContain(`No documented endpoints were found — ${NOT_FOUND}.`);
    expect(markdown).toContain('Add an `@openapi` annotation');
  });

  it('lists undocumented routes in the coverage section', () => {
    const markdown = render(spec, [
      ...routes,
      { method: 'DELETE', path: '/widgets/{id}', source: 'src/routes/widgets.routes.ts' }
    ]);

    expect(markdown).toContain('| Undocumented routes | 1 |');
    expect(markdown).toContain('| `DELETE` | `/widgets/{id}` | `src/routes/widgets.routes.ts` |');
  });

  it('is deterministic across runs', () => {
    expect(render(spec)).toBe(render(spec));
  });
});
