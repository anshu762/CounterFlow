// Validates req.body with a Zod schema. Errors go to the shared error handler (400).
export const validate = (schema) => (req, _res, next) => {
  req.body = schema.parse(req.body ?? {});
  next();
};