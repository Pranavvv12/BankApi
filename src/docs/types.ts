/** Minimal structural types for the subset of OpenAPI 3.0 this project emits. */

export interface JsonSchema {
  type?: string;
  format?: string;
  description?: string;
  example?: unknown;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
}

export interface OpenApiParameter {
  in: string;
  name: string;
  required?: boolean;
  description?: string;
  schema?: JsonSchema;
  example?: unknown;
}

export interface OpenApiMediaType {
  schema?: JsonSchema;
}

export interface OpenApiRequestBody {
  required?: boolean;
  description?: string;
  content?: Record<string, OpenApiMediaType>;
}

export interface OpenApiResponse {
  description?: string;
  content?: Record<string, OpenApiMediaType>;
}

export interface OpenApiOperation {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses?: Record<string, OpenApiResponse>;
}

export interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: { url: string; description?: string }[];
  paths: Record<string, Record<string, OpenApiOperation>>;
}

/** A route registration discovered by statically scanning the Express sources. */
export interface DiscoveredRoute {
  /** Upper-case HTTP method, e.g. `GET`. */
  method: string;
  /** OpenAPI-style path, e.g. `/accounts/{id}/balance`. */
  path: string;
  /** Repository-relative file the registration was found in. */
  source: string;
}

/** An operation present in the generated specification. */
export interface DocumentedOperation {
  method: string;
  path: string;
  operation: OpenApiOperation;
}

export interface CoverageReport {
  /** Routes that exist in code and are documented. */
  covered: DiscoveredRoute[];
  /** Routes registered in code but missing an `@openapi` annotation. */
  undocumented: DiscoveredRoute[];
  /** Operations documented in the spec with no matching route registration. */
  orphaned: { method: string; path: string }[];
  totalRoutes: number;
  totalDocumented: number;
}

export type SyncStatus = 'updated' | 'up-to-date';

export interface SyncResult {
  status: SyncStatus;
  specPath: string;
  referencePath: string;
  coverage: CoverageReport;
}
