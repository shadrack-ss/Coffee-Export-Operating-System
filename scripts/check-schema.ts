/*
 * Schema ⇄ frontend drift check.
 *
 * The DB (db/schema.sql) and the frontend domain are deliberately shaped
 * differently (normalised vs. denormalised view model), so this does NOT do a
 * column-by-column type comparison. It pins the contracts where drift actually
 * causes bugs:
 *
 *   1. Postgres ENUMs  ===  frontend const unions (exact set, per enum).
 *   2. Lookup seeds (districts, expense_categories)  ===  DEFAULT_SETTINGS lists.
 *   3. coffee_grades seed  ⊇  DEFAULT_SETTINGS.coffee_grades (all sellable) AND
 *      ⊇  every value recommendGrade() can return.
 *
 * Run:  npm run check:schema   (exits 1 on any mismatch)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  ROLES,
  SUPPLIER_TYPES,
  BATCH_STATUSES,
  DEFECT_HANDLING_MODES,
  EXPENSE_BASES,
  PROCESS_TYPES,
  SEVERITIES,
  FM_BASES,
} from "../src/shared/types/index.ts";
import { DEFAULT_SETTINGS } from "../src/core/settings.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(join(root, "db/schema.sql"), "utf8");
const qualitySrc = readFileSync(
  join(root, "src/shared/calc/quality.ts"),
  "utf8",
);

const failures: string[] = [];
const fail = (m: string) => failures.push(m);

/** Extract quoted string literals from a SQL fragment. */
const quoted = (s: string): string[] =>
  [...s.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));

function dbEnum(name: string): string[] {
  const re = new RegExp(`CREATE TYPE\\s+${name}\\s+AS ENUM\\s*\\(([^)]*)\\)`, "i");
  const m = sql.match(re);
  if (!m) {
    fail(`DB enum '${name}' not found in schema.sql`);
    return [];
  }
  return quoted(m[1]);
}

/** Extract the value list of an `INSERT INTO <table> ... VALUES ...;`, first column. */
function seedFirstCol(table: string): string[] {
  const re = new RegExp(`INSERT INTO ${table}[^;]*VALUES([^;]*);`, "i");
  const m = sql.match(re);
  if (!m) {
    fail(`Seed INSERT for '${table}' not found in schema.sql`);
    return [];
  }
  // first quoted literal in each (...) tuple
  return [...m[1].matchAll(/\(\s*'((?:[^']|'')*)'/g)].map((x) =>
    x[1].replace(/''/g, "'"),
  );
}

function sameSet(label: string, a: readonly string[], b: readonly string[]) {
  const sa = new Set(a);
  const sb = new Set(b);
  const missing = [...sa].filter((x) => !sb.has(x));
  const extra = [...sb].filter((x) => !sa.has(x));
  if (missing.length || extra.length) {
    fail(
      `${label} mismatch:` +
        (missing.length ? ` frontend-only [${missing.join(", ")}]` : "") +
        (extra.length ? ` db-only [${extra.join(", ")}]` : ""),
    );
  }
}

function subset(label: string, sub: readonly string[], sup: readonly string[]) {
  const ss = new Set(sup);
  const missing = [...new Set(sub)].filter((x) => !ss.has(x));
  if (missing.length) {
    fail(`${label}: not in DB coffee_grades [${missing.join(", ")}]`);
  }
}

// 1. enums
sameSet("role_type", ROLES, dbEnum("role_type"));
sameSet("supplier_type", SUPPLIER_TYPES, dbEnum("supplier_type"));
sameSet("batch_status", BATCH_STATUSES, dbEnum("batch_status"));
sameSet("defect_handling_mode", DEFECT_HANDLING_MODES, dbEnum("defect_handling_mode"));
sameSet("expense_basis", EXPENSE_BASES, dbEnum("expense_basis"));
sameSet("process_type", PROCESS_TYPES, dbEnum("process_type"));
sameSet("severity_type", SEVERITIES, dbEnum("severity_type"));
sameSet("fm_base_type", FM_BASES, dbEnum("fm_base_type"));

// 2. managed-list seeds (exact)
sameSet("districts", DEFAULT_SETTINGS.districts, seedFirstCol("districts"));
sameSet(
  "expense_categories",
  DEFAULT_SETTINGS.expense_categories,
  seedFirstCol("expense_categories"),
);

// 3. coffee_grades (DB ⊇ frontend grades ∪ recommendGrade outputs)
const dbGrades = seedFirstCol("coffee_grades");
subset("settings coffee_grades", DEFAULT_SETTINGS.coffee_grades, dbGrades);
const recommendOutputs = [
  ...qualitySrc.matchAll(/return\s+"([^"]+)"/g),
].map((m) => m[1]);
subset("recommendGrade outputs", recommendOutputs, dbGrades);

// report
if (failures.length) {
  console.error("✗ schema/frontend drift detected:\n");
  for (const f of failures) console.error("  - " + f);
  console.error(`\n${failures.length} mismatch(es).`);
  process.exit(1);
}
console.log(
  "✔ schema ⇄ frontend in sync (8 enums, 3 managed lists, recommendGrade outputs).",
);
