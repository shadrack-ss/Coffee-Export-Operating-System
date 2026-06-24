/**
 * CE-OS database migration runner.
 *
 * Applies every *.sql file in server/migrations/ in alphabetical (semver) order.
 * Applied migrations are tracked in the schema_migrations table so each file
 * runs exactly once.
 *
 * Usage:
 *   npm run migrate           — apply all pending migrations
 *   npm run migrate:status    — print applied / pending status without running anything
 */

import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dir, "..", "migrations");

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://ceos:ceos@localhost:5432/ceos";

const statusOnly = process.argv.includes("--status");

async function run() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  try {
    // Ensure the tracking table exists (idempotent).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Collect applied migrations.
    const { rows: applied } = await pool.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations ORDER BY filename",
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    // Collect all migration files, sorted lexicographically.
    let files: string[];
    try {
      files = (await readdir(MIGRATIONS_DIR))
        .filter((f) => f.endsWith(".sql"))
        .sort();
    } catch {
      console.error(`No migrations directory found at ${MIGRATIONS_DIR}`);
      process.exit(1);
    }

    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }

    // Status-only mode: print table and exit.
    if (statusOnly) {
      for (const f of files) {
        const mark = appliedSet.has(f) ? "✓ applied" : "  pending";
        console.log(`  ${mark}  ${f}`);
      }
      return;
    }

    // Apply pending migrations, each in its own transaction.
    let applied_count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf-8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        console.log(`  ✓  ${file}`);
        applied_count++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  ✗  ${file} — migration failed, rolled back`);
        throw err;
      } finally {
        client.release();
      }
    }

    if (applied_count === 0) {
      console.log("Database is up to date — no migrations pending.");
    } else {
      console.log(`\n${applied_count} migration(s) applied.`);
    }
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Migration error:", err.message ?? err);
  process.exit(1);
});
