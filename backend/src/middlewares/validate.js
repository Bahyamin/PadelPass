import { ValidationError } from '../utils/errors.js';

// Checks req.body against a Zod schema (SDD 3.2). On success req.body is
// replaced by the cleaned data (trimmed strings, lower-case email...).
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return next(new ValidationError(result.error.issues[0].message));
    }
    req.body = result.data;
    next();
  };
}
