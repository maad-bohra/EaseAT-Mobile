/** Errors whose message is safe to show to the student as-is. */
export class AppError extends Error {
  constructor(message, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }

  static badRequest(message) {
    return new AppError(message, 'BAD_REQUEST');
  }

  static notFound(message = 'That item was not found') {
    return new AppError(message, 'NOT_FOUND');
  }

  static conflict(message) {
    return new AppError(message, 'CONFLICT');
  }
}

/** Turns anything thrown into a short message for the screen. */
export function messageOf(error) {
  if (error instanceof AppError) return error.message;
  if (error && typeof error.message === 'string' && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}
