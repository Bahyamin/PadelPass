import { ValidationError } from '../utils/errors.js';

// Checks req.body against a Zod schema (SDD 3.2). On success req.body is
// replaced by the cleaned data (trimmed strings, lower-case email...).
// The error names the invalid field of the body (error.field), if any.
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const { message, path } = result.error.issues[0];
      const field = typeof path[0] === 'string' ? path[0] : undefined;
      return next(new ValidationError(message, undefined, field));
    }
    req.body = result.data;
    next();
  };
}
