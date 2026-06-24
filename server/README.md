# CE-OS API (Fastify + PostgreSQL)

Self-hosted backend for CE-OS. TypeScript end-to-end — it reuses the **same pure
financial engine** (`src/shared/calc`) and **the same RBAC matrix** (`src/shared/authz`)
as the frontend, so business rules can't drift between client and server.

## Architecture

```
routes/      HTTP endpoints (thin) — validate (zod) → call domain/repo → respond
auth/        JWT verification + RBAC preHandlers (the real authorization gate)
repos/       parameterised SQL over the pg pool
domain.ts    re-exports the shared kernel (calc + types + authz) unchanged
db.ts        pg pool + withTx() transaction helper
config.ts    env (DATABASE_URL, JWT_SECRET, …) — secrets never hardcoded
```

**Authorization lives here**, not in Postgres RLS: the API connects as one DB role
and enforces `ROLE_PERMISSIONS` per request (`app.requirePermission('grn.create')`).
UI gating is convenience only.

## Run it

```bash
# 1. create the database and load the schema (from repo root)
createdb ceos
psql ceos -f db/schema.sql

# 2. configure + install
cd server
cp .env.example .env          # set DATABASE_URL + a real JWT_SECRET
npm install

# 3. create an admin to log in with
npm run seed:admin -- admin@ceos.ug "a-strong-password"

# 4. start
npm run dev                   # http://localhost:4000
npm run typecheck
```

## Endpoints (current slice)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET  | `/health`      | — | DB ping |
| POST | `/auth/login`  | — | `{email,password}` → `{token,user}` |
| GET  | `/auth/me`     | JWT | current user from token |
| GET  | `/batches`     | JWT | list |
| GET  | `/batches/:id` | JWT | one |
| POST | `/grn`         | JWT + `grn.create` | reuses `computeQuality`/`recommendGrade`; writes batch+quality+audit+alerts in one transaction; returns the batch + derivation steps |

```bash
TOKEN=$(curl -s localhost:4000/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@ceos.ug","password":"a-strong-password"}' | jq -r .token)
curl localhost:4000/batches -H "authorization: Bearer $TOKEN"
```

## What's a skeleton vs. done

**Done & proven:** DB pool + transactions, JWT auth, shared-matrix RBAC, the shared
calc running server-side, the full GRN write slice end-to-end, and security hardening:
- **Default-deny auth** — a global hook authenticates every request unless the route
  declares `config: { public: true }`, so a forgotten guard can't leak an endpoint.
- **Rate limiting** — global 100/min per IP; `/auth/login` tightened to 5/min to blunt
  credential brute-forcing (verified → 429). Floods are dropped before any DB/crypto work.
- **Security headers** (helmet), strict **CORS**, **256 KB body limit**, request/connection
  **timeouts**, **auth-header redaction** in logs, and a **non-leaky error handler**
  (500s never expose internals).

**To extend (same patterns):** expenses, processing, forex (lock/feed), traceability
reads, documents, approvals, CRM; per-route JSON response schemas; migrations tool
(e.g. node-pg-migrate) instead of the single `schema.sql`; automated tests.
