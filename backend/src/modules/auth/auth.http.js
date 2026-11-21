export const noStore = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

export const clientMeta = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });
