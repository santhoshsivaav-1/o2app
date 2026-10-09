import argon2 from "argon2";

/** Argon2id with OWASP-ish defaults for an interactive login workload. */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

/** Never throws — returns false on mismatch or malformed hash. */
export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password).catch(() => false);
}

export function assertPasswordPolicy(password: string): void {
  if (password.length < 10) throw new Error("Password must be at least 10 characters");
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
    throw new Error("Password must contain at least one letter and one number");
}
