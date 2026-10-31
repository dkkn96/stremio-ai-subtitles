export class AppError extends Error {
  constructor(code, message, status = 502, options) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export function publicError(error) {
  return error instanceof AppError
    ? { code: error.code, message: error.message }
    : { code: 'INTERNAL_ERROR', message: 'Operation failed. Check the server.' };
}
