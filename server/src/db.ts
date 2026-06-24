/* PostgreSQL connection pool + a small transaction helper. */

import pg from "pg";
import { config } from "./config.ts";

// Return BIGINT (int8, oid 20) as a JS number. UGX amounts stay well within
// Number.MAX_SAFE_INTEGER (~9e15), and money is always whole UGX.
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
// NUMERIC (oid 1700) → number for weights/percentages.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export async function withTx<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
