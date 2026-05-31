import jwt from 'jsonwebtoken';

const AUTH_SECRET = process.env.AUTH_SECRET || 'secret';

export function generateAccessToken(userId: string, role: 'user' | 'admin' | 'superadmin'): string {
  return jwt.sign(
    { sub: userId, role },
    AUTH_SECRET,
    { expiresIn: 900 } // 15 minutes in seconds
  );
}

import crypto from 'crypto';

export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, jti: crypto.randomUUID() },
    AUTH_SECRET,
    { expiresIn: 604800 } // 7 days in seconds
  );
}

export function verifyAccessToken(token: string): any {
  if (token === null || token === undefined) {
    throw new Error('Token cannot be null');
  }
  return jwt.verify(token, AUTH_SECRET);
}
