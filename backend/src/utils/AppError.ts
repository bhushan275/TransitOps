/**
 * Application-level error carrying an HTTP status code.
 * Thrown by services when a business rule is violated so controllers/the
 * error handler can translate it into a clean HTTP response.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, message, details);
  }
  static unauthorized(message = 'Unauthorized') {
    return new AppError(401, message);
  }
  static forbidden(message = 'Forbidden') {
    return new AppError(403, message);
  }
  static notFound(message = 'Not found') {
    return new AppError(404, message);
  }
  static conflict(message: string) {
    return new AppError(409, message);
  }
  static unprocessable(message: string, details?: unknown) {
    return new AppError(422, message, details);
  }
}
