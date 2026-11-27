// Typed errors thrown by services. The error handler turns them into
// { error: { code, message, requestId } } with the matching HTTP status.
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// field: the name of the invalid field of the body, when there is one, so
// that a form can show the message next to that field.
export class ValidationError extends AppError {
  constructor(message, code = 'VALIDATION_ERROR', field) {
    super(400, code, message);
    if (field) this.field = field;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(code, message) {
    super(409, code, message);
  }
}
