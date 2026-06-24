/*
 * Bootstrap an admin user so you can log in. The bootstrap admin has created_by
 * NULL (allowed by the schema). Usage:
 *   npm run seed:admin -- admin@ceos.ug "a-strong-password"
 */

import { pool } from "../db.ts";
import { hashPassword } from "../auth/password.ts";

const email = process.argv[2] ?? "admin@ceos.ug";
const password = process.argv[3] ?? "changeme123";
const name = process.argv[4] ?? "Bootstrap Admin";

const hash = hashPassword(password);
await pool.query(
  `INSERT INTO users (name, email, role, password_hash)
   VALUES ($1, $2, 'admin', $3)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, active = true`,
  [name, email, hash],
);
console.log(`✔ admin ready: ${email}`);
await pool.end();
