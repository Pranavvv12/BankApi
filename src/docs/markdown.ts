import { listDocumentedOperations } from './coverage.js';
import type {
  CoverageReport,
  DiscoveredRoute,
  JsonSchema,
  OpenApiOperation,
  OpenApiParameter,
  OpenApiSpec
} from './types.js';

/** Placeholder used wherever an annotation omits a field. */
export const NOT_FOUND = 'Not Found';

const UNGROUPED_TAG = 'Other';

function cell(value: string | undefined): string {
  if (value === undefined || value.trim() === '') return NOT_FOUND;
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function literal(value: unknown): string {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Renders a human readable type such as `string (email)` or `array of object`. */
function describeType(schema: JsonSchema | undefined): string {
  if (!schema) return NOT_FOUND;
  if (schema.type === 'array') return `array of ${describeType(schema.items)}`;
  const base = schema.type ?? NOT_FOUND;
  return schema.format ? `${base} (${schema.format})` : base;
}

function describeConstraints(schema: JsonSchema | undefined): string {
  if (!schema) return '';
  const parts: string[] = [];
  if (schema.minimum !== undefined) parts.push(`min: ${schema.minimum}`);
  if (schema.maximum !== undefined) parts.push(`max: ${schema.maximum}`);
  if (schema.default !== undefined) parts.push(`default: ${literal(schema.default)}`);
  if (schema.enum) parts.push(`one of: ${schema.enum.map(literal).join(', ')}`);
  return parts.join(', ');
}

/** Synthesises a sample payload from the `example` and `default` annotations. */
export function exampleFromSchema(schema: JsonSchema | undefined): unknown {
  if (!schema) return undefined;
  if (schema.example !== undefined) return schema.example;
  if (schema.type === 'object' && schema.properties) {
    const sample: Record<string, unknown> = {};
    for (const [name, child] of Object.entries(schema.properties)) {
      const value = exampleFromSchema(child);
      if (value !== undefined) sample[name] = value;
    }
    return Object.keys(sample).length > 0 ? sample : undefined;
  }
  if (schema.type === 'array') {
    const item = exampleFromSchema(schema.items);
    return item === undefined ? undefined : [item];
  }
  return schema.default;
}

function jsonSchemaOf(content: Record<string, { schema?: JsonSchema }> | undefined) {
  if (!content) return undefined;
  return (content['application/json'] ?? Object.values(content)[0])?.schema;
}

function renderParameters(parameters: OpenApiParameter[]): string[] {
  if (parameters.length === 0) return [];
  const lines = [
    '**Parameters**',
    '',
    '| In | Name | Type | Required | Description | Example |',
    '| --- | --- | --- | --- | --- | --- |'
  ];
  const sorted = [...parameters].sort(
    (a, b) => a.in.localeCompare(b.in) || a.name.localeCompare(b.name)
  );
  for (const parameter of sorted) {
    const example = parameter.example ?? parameter.schema?.example;
    const constraints = describeConstraints(parameter.schema);
    const description = [parameter.description, constraints].filter(Boolean).join(' — ');
    lines.push(
      `| ${cell(parameter.in)} | \`${parameter.name}\` | ${cell(describeType(parameter.schema))} | ${
        parameter.required ? 'Yes' : 'No'
      } | ${cell(description)} | ${example === undefined ? NOT_FOUND : `\`${literal(example)}\``} |`
    );
  }
  lines.push('');
  return lines;
}

function renderSchemaTable(schema: JsonSchema): string[] {
  const properties = schema.properties ?? {};
  const names = Object.keys(properties).sort();
  if (names.length === 0) return [];

  const required = new Set(schema.required ?? []);
  const lines = [
    '| Field | Type | Required | Description | Example |',
    '| --- | --- | --- | --- | --- |'
  ];
  for (const name of names) {
    const property = properties[name];
    const constraints = describeConstraints(property);
    const description = [property.description, constraints].filter(Boolean).join(' — ');
    lines.push(
      `| \`${name}\` | ${cell(describeType(property))} | ${required.has(name) ? 'Yes' : 'No'} | ${cell(
        description
      )} | ${property.example === undefined ? NOT_FOUND : `\`${literal(property.example)}\``} |`
    );
  }
  lines.push('');
  return lines;
}

function renderJsonBlock(value: unknown): string[] {
  return ['```json', JSON.stringify(value, null, 2), '```', ''];
}

function renderRequestBody(operation: OpenApiOperation): string[] {
  const body = operation.requestBody;
  if (!body) return [];

  const schema = jsonSchemaOf(body.content);
  const lines = [`**Request body** (${body.required ? 'required' : 'optional'})`, ''];
  if (body.description) lines.push(body.description, '');
  if (!schema) {
    lines.push(`Schema: ${NOT_FOUND}`, '');
    return lines;
  }

  lines.push(...renderSchemaTable(schema));
  const example = exampleFromSchema(schema);
  if (example !== undefined) {
    lines.push('Example request:', '');
    lines.push(...renderJsonBlock(example));
  }
  return lines;
}

function renderResponses(operation: OpenApiOperation): string[] {
  const responses = operation.responses ?? {};
  const codes = Object.keys(responses).sort();
  const lines = ['**Responses**', ''];

  if (codes.length === 0) {
    lines.push(`No documented responses — ${NOT_FOUND}`, '');
    return lines;
  }

  lines.push('| Status | Description |', '| --- | --- |');
  for (const code of codes) {
    lines.push(`| \`${code}\` | ${cell(responses[code]?.description)} |`);
  }
  lines.push('');

  for (const code of codes) {
    const schema = jsonSchemaOf(responses[code]?.content);
    const example = exampleFromSchema(schema);
    if (example === undefined) continue;
    lines.push(`Example response \`${code}\`:`, '');
    lines.push(...renderJsonBlock(example));
  }
  return lines;
}

function renderCoverage(coverage: CoverageReport): string[] {
  const lines = [
    '## Documentation coverage',
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| Routes registered in code | ${coverage.totalRoutes} |`,
    `| Operations documented in OpenAPI | ${coverage.totalDocumented} |`,
    `| Undocumented routes | ${coverage.undocumented.length} |`,
    `| Documented without a route | ${coverage.orphaned.length} |`,
    ''
  ];

  if (coverage.undocumented.length > 0) {
    lines.push(
      'The following routes are registered but have no `@openapi` annotation:',
      '',
      '| Method | Path | Source |',
      '| --- | --- | --- |'
    );
    for (const route of coverage.undocumented) {
      lines.push(`| \`${route.method}\` | \`${route.path}\` | \`${route.source}\` |`);
    }
    lines.push('');
  }

  if (coverage.orphaned.length > 0) {
    lines.push(
      'The following operations are documented but no matching route was found:',
      '',
      '| Method | Path |',
      '| --- | --- |'
    );
    for (const entry of coverage.orphaned) {
      lines.push(`| \`${entry.method}\` | \`${entry.path}\` |`);
    }
    lines.push('');
  }

  if (coverage.undocumented.length === 0 && coverage.orphaned.length === 0) {
    lines.push('Every registered route is documented and every documented operation exists.', '');
  }

  return lines;
}

/**
 * Renders the full Markdown API reference.
 *
 * The output is intentionally free of timestamps and other volatile data so it
 * can be committed and diffed in pull requests.
 */
export function renderMarkdown(
  spec: OpenApiSpec,
  routes: DiscoveredRoute[],
  coverage: CoverageReport
): string {
  const operations = listDocumentedOperations(spec);
  const sourceByKey = new Map(routes.map((route) => [`${route.method} ${route.path}`, route.source]));

  const lines: string[] = [
    `# ${spec.info.title} — API Reference`,
    '',
    '> Generated from the `@openapi` annotations in the source by `npm run docs:sync`.',
    '> Do not edit this file by hand; your changes will be overwritten.',
    '',
    '| Property | Value |',
    '| --- | --- |',
    `| API version | ${cell(spec.info.version)} |`,
    `| OpenAPI version | ${cell(spec.openapi)} |`,
    `| Machine readable spec | [\`docs/openapi.json\`](./openapi.json) |`,
    ''
  ];

  if (spec.info.description) lines.push(spec.info.description, '');

  lines.push('## Servers', '');
  if (spec.servers && spec.servers.length > 0) {
    lines.push('| URL | Description |', '| --- | --- |');
    for (const server of spec.servers) {
      lines.push(`| \`${server.url}\` | ${cell(server.description)} |`);
    }
  } else {
    lines.push(NOT_FOUND);
  }
  lines.push('');

  lines.push(...renderCoverage(coverage));

  lines.push('## Endpoints', '');
  if (operations.length === 0) {
    lines.push(
      `No documented endpoints were found — ${NOT_FOUND}.`,
      '',
      'Add an `@openapi` annotation above a route registration to populate this section.',
      ''
    );
    return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
  }

  lines.push('| Method | Path | Summary | Tag |', '| --- | --- | --- | --- |');
  for (const entry of operations) {
    lines.push(
      `| \`${entry.method}\` | \`${entry.path}\` | ${cell(entry.operation.summary)} | ${cell(
        entry.operation.tags?.[0]
      )} |`
    );
  }
  lines.push('');

  const grouped = new Map<string, typeof operations>();
  for (const entry of operations) {
    const tag = entry.operation.tags?.[0]?.trim() || UNGROUPED_TAG;
    const bucket = grouped.get(tag) ?? [];
    bucket.push(entry);
    grouped.set(tag, bucket);
  }

  for (const tag of [...grouped.keys()].sort()) {
    lines.push(`## ${tag}`, '');
    for (const entry of grouped.get(tag) ?? []) {
      const { operation } = entry;
      lines.push(`### \`${entry.method}\` \`${entry.path}\``, '');
      lines.push(cell(operation.summary), '');
      if (operation.description) lines.push(operation.description, '');
      lines.push(
        `Registered in: \`${sourceByKey.get(`${entry.method} ${entry.path}`) ?? NOT_FOUND}\``,
        ''
      );
      lines.push(...renderParameters(operation.parameters ?? []));
      lines.push(...renderRequestBody(operation));
      lines.push(...renderResponses(operation));
    }
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
