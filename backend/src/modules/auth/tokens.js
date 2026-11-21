import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export const ACCESS_ISSUER = 'counterflow';

// The JWT carries only the role (plus sub = user id). Nothing else.
export function signAccessToken({ userId, role }) {
  const token = jwt.sign({ role }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL,
    algorithm: 'HS256',
    issuer: ACCESS_ISSUER,
  });
  const { iat, exp } = jwt.decode(token);
  return { token, expiresIn: exp - iat };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: ACCESS_ISSUER,
  });
}
