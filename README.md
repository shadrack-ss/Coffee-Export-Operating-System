# CE-OS — Coffee Export Operating System

Production-grade ERP for Ugandan coffee exporters. Turns raw deliveries into an
accurate, traceable landed cost per kilo and protects margin against USD/UGX
swings. "Linear/Stripe, but for coffee."

## Status

**All 5 build phases complete.** Frontend-first, with a typed in-memory data
layer standing in for Supabase. The financial math is implemented exactly to
spec and verified against the acceptance criteria. Phase 2: New GRN live quality
calculator; Phase 3: Expenses (live landed-cost build-up) + Processing (yield +
child-batch re-cost chain); Phase 4: live forex feed (manual fallback + per-batch
rate locking) + state-derived alerts; Phase 5: full farmer→container→buyer
traceability with the reverse query, the branded PDF document set + buyer
catalogue, and CRM greeting templates.

## Stack

React 19 · Vite · TypeScript (strict) · Tailwind v4 · shadcn-style components ·
Recharts · React Router · TanStack Query.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run typecheck
npm run lint:arch  # enforce module boundaries (dependency-cruiser)
npm run check:schema  # assert db/schema.sql enums+seeds match the frontend
```

The **backend** lives in [server/](server/README.md) (Fastify + PostgreSQL,
self-hosted) and reuses this app's `shared/calc` and `shared/authz` unchanged.

**Run live (frontend ↔ API).** By default the app runs in in-memory **demo mode**.
To drive it against the real backend, start the API (see [server/](server/README.md)),
then create `.env.local` with `VITE_API_URL=http://localhost:4000` and `npm run dev`.
A "Sign in to API" option appears in the top bar. Once signed in:
- **Writes:** the **New GRN** flow posts to `POST /grn` and persists to Postgres
  (browser → CORS preflight → JWT → RBAC → shared `computeQuality` server-side →
  transactional write of batch + quality + audit + alert).
- **Reads:** the store hydrates from `GET /state` (full snapshot mapped into the shared
  types), so **every read screen — Batches list, Batch detail, dashboard, traceability —
  renders live Postgres data through the same selectors**. Create a GRN and it appears in
  the list and detail immediately.

**All write flows are wired to the API** (each with validation + RBAC + audit, in a
transaction; the frontend re-pulls the snapshot after a write so derived figures
recompute): **New GRN**, **Expenses** (add/delete + allocation-group resolution),
**Processing** (creates the child batch + record, advances the parent), **Forex**
(global rate snapshots + per-batch rate locks — a persisted rate lights up the
dashboard P/L), **Settings** (standards saved via a "Save to server" action), and
**Approvals** (one-click cash sign-off → writes the approval, advances the batch to
`approved`, logs the audit trail; admin-only via `payment.approve`).

## Architecture — feature modules (vertical slices)

Organised by **feature**, not by technical layer, with a strict dependency
direction enforced by `npm run lint:arch`:

```
app      -> features, core, shared        (composition: routes, shell)
features -> core, shared                   (+ other features ONLY via index.ts)
core     -> shared                         (store primitive, auth, seed, settings)
shared   -> (leaf)                         (ui, lib/money+utils, calc, types, components)
```

| Concern | Location |
| --- | --- |
| Shared kernel (no app deps) | `src/shared/` — `ui/`, `lib/`, `calc/`, `types/`, `components/` |
| **Financial engine** (pure) | `src/shared/calc/` — `quality`, `costing`, `processing`, `forex` |
| **Core data primitive** (backend seam) | `src/core/store.tsx` — thin: state + `update` + `reset` |
| Auth + RLS-mirror permissions | `src/core/auth.tsx` |
| Seed data / default standards | `src/core/seed.ts`, `src/core/settings.ts` |
| A feature (e.g. quality) | `src/features/quality/` — `NewGrnPage.tsx`, `api.ts`, `index.ts` |
| Per-feature read models | `src/features/batches/selectors.ts`, `src/features/traceability/selectors.ts` |
| App shell / routes | `src/app/` |

**Each feature owns its slice**: page(s), write-logic (`api.ts` hooks like
`useCreateGrn`, `useLockRate`), view-types, and a public `index.ts` barrel.
Features never reach into each other's internals — cross-feature use goes through
the barrel (e.g. `notifications` → `@/features/batches`), enforced by
dependency-cruiser ([.dependency-cruiser.cjs](.dependency-cruiser.cjs)).

## The rules that matter

1. **Money is never a float.** Stored as integer UGX. All division rounds
   explicitly via `shared/lib/money`. Tabular numerals (`.tnum`) on every figure.
2. **Financial logic is centralised in `shared/calc`** as pure functions emitting
   a step-by-step derivation (`DerivationStep[]`) so every number can "show its
   working." Nothing in the UI computes money directly.
3. **The God store is gone.** `core/store.tsx` is a thin primitive (state +
   `update`); each feature's write-logic lives in its own `api.ts` hook composed
   over it, so features don't couple through one shared object. When the backend
   lands, the core primitive becomes TanStack Query over Postgres RPC and feature
   hooks call RPC; shapes and module boundaries are unchanged.

## Verified against spec §8

- Quality: 1,000 kg @ 20% MC → **940 kg** (6% deduction). ✓ (batch `MBR-2026-0008`)
- Allocation: 2,000,000 ÷ group kg → correct per-kg split. ✓ (batch `KSE-2026-0011`)
- Yield: output ÷ input × 100 = 85%. ✓ (`computeProcessing`)
- Role gating: as Grader, admin nav hidden and `/settings` blocked. ✓
- No console errors; loading/empty/error states present; responsive to ~380 px.

## Roadmap

- **Phase 2** — Batches list + New GRN live quality calculator. **Done:**
  `src/pages/NewGRN.tsx` (live "show working", defect breakdown, weight-vs-discount
  toggle, inline threshold explainers, validation, POS-friendly). Save writes batch
  (→ `graded`) + quality + audit + high-moisture/defect alerts via `createGRN` in
  `src/data/store.tsx`. Batch codes auto-generate per district (e.g. `SIP-2026-0001`).
- **Phase 3** — **Done:** Expenses (`src/pages/Expenses.tsx`) — per-kg + allocated
  lines, live build-up, USD-linked gunny-bags recompute prompt; Processing
  (`src/pages/Processing.tsx`) — live yield/loss, creates a child batch and re-costs
  via the **inherited-cost chain** in `src/data/selectors.ts` (`is_child` path).
  Store actions `addExpense`/`deleteExpense`/`recordProcessing`.
- **Phase 4** — **Done:** live USD/UGX feed (`src/lib/forex.ts`, key-less
  ExchangeRate-API open endpoint, graceful fallback) + manual override + per-batch
  rate locking (`src/pages/Forex.tsx`, store `setLiveRate`/`lockRate`); P/L, break-even
  and risk flags surfaced; live state-derived alerts (`deriveAlerts` in selectors —
  forex risk / negative margin / pending approval) feeding the bell and Notifications.
- **Phase 5** — **Done:** Traceability (`src/pages/Traceability.tsx`,
  `src/data/traceability.ts`) — forward chain + the reverse container query
  (`containerContributions`, traces processed children back to root intake);
  Documents (`src/pages/Documents.tsx` + `DocumentPrint.tsx`, `src/data/docTypes.ts`)
  — branded printable GRN/receipt/invoice/proforma/quality-cert + export set, stored
  as records, re-openable; buyer catalogue (`CatalogPrint.tsx`); CRM greeting
  templates (`src/pages/Clients.tsx`). Print views are standalone routes with
  `@media print` CSS.
- **Backend** — **in progress:** self-hosted PostgreSQL ([db/schema.sql](db/schema.sql),
  hardened + PG17-validated) + Fastify API ([server/](server/README.md)). The API reuses
  `shared/calc` and the `shared/authz` RBAC matrix unchanged; auth + role checks enforced
  server-side. The GRN write slice is built and tested end-to-end; remaining write slices
  (expenses, processing, forex, approvals, traceability reads, documents) follow the same
  pattern. Frontend `core/store` then swaps from in-memory to API calls.

## Open business rules to confirm with the exporter

Wired as Settings so they flip without code changes: FM deduction base
(`fm_base`), defect handling default (`default_defect_handling`), URA tax basis,
which expenses are allocated vs per-kg, and whether EUR/GBP are needed.
