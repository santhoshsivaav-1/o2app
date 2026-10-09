import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_SEC = 7 * 24 * 3600;

export interface AccessClaims {
  sub: string;
  sid: string;
  jti: string;
}

export function newSessionId(): string {
  return randomUUID();
}

export function signAccess(sessionId: string, userId: string, secret: string): string {
  const payload: AccessClaims = { sub: userId, sid: sessionId, jti: randomUUID() };
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TTL_SEC });
}

export function signRefresh(sessionId: string, userId: string, secret: string): string {
  return jwt.sign({ sub: userId, sid: sessionId }, secret, { expiresIn: REFRESH_TTL_SEC });
}

export function verifyAccess(token: string, secret: string): AccessClaims {
  return jwt.verify(token, secret) as AccessClaims;
}

export function verifyRefresh(token: string, secret: string): { sub: string; sid: string } {
  return jwt.verify(token, secret) as { sub: string; sid: string };
}

/** Store only the hash of refresh tokens server-side. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Stateless double-submit CSRF token bound to the session id. */
export function csrfForSession(sessionId: string, csrfSecret: string): string {
  return createHmac("sha256", csrfSecret).update(sessionId).digest("hex");
}

export function newCsrfCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}
