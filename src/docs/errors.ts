/**
 * Error codes raised by the documentation sync pipeline.
 *
 * `DOCUMENTATION_DRIFT` is reported before `DOCUMENTATION_STALE` because drift
 * is the root cause: regenerating the files cannot fix a missing annotation.
 */
export type DocumentationErrorCode =
  | 'SOURCE_NOT_FOUND'
  | 'DOCUMENTATION_DRIFT'
  | 'DOCUMENTATION_STALE';

export class DocumentationError extends Error {
  readonly code: DocumentationErrorCode;
  readonly details: string[];

  constructor(code: DocumentationErrorCode, message: string, details: string[] = []) {
    super(message);
    this.name = 'DocumentationError';
    this.code = code;
    this.details = details;
  }
}

export function isDocumentationError(error: unknown): error is DocumentationError {
  return error instanceof DocumentationError;
}
