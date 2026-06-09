/** Order API failure with stable public error code for UI mapping. */
export class PublicOrderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PublicOrderError';
    this.code = code;
  }
}

export function isPublicOrderError(err: unknown): err is PublicOrderError {
  return err instanceof PublicOrderError;
}
