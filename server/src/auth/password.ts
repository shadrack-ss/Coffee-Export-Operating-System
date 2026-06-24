/*
 * Password hashing using Node's built-in scrypt — no native dependency to build
 * on Windows/CI. Format: scrypt$<saltHex>$<hashHex>. Swap for argon2id in prod
 * if you prefer; the column (users.password_hash) stays the same.
 */

import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
