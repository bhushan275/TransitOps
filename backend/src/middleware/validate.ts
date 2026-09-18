import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny, z } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates and coerces request parts against Zod schemas. Parsed values
 * replace the originals so downstream code gets typed, sanitized input.
 * Throws ZodError (handled centrally) on failure.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) {
      const parsed = schemas.query.parse(req.query);
      // req.query is read-only in Express 5+, so assign per-key defensively.
      Object.assign(req.query, parsed);
      (req as unknown as { validatedQuery: unknown }).validatedQuery = parsed;
    }
    if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
    next();
  };
}

/** Helper to read validated query (falls back to req.query). */
export function getQuery<T>(req: Request): T {
  return ((req as unknown as { validatedQuery?: T }).validatedQuery ?? req.query) as T;
}

export { z };
