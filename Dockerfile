# syntax=docker/dockerfile:1
#
# CE-OS API — multi-stage build.
# Build context: repo root (required because server/src imports from src/shared/).
#
# Stage 1 — install production dependencies only
# Stage 2 — lean runtime image

# ── deps ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
# ci installs exactly what the lock file specifies; --omit=dev skips test tools.
# tsx is a production dependency (it's the runtime) so it IS included here.
RUN npm ci --omit=dev

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Production node_modules from the deps stage
COPY --from=deps /app/server/node_modules ./server/node_modules

# Shared kernel — server/src/domain.ts re-exports from src/shared/
COPY src/shared ./src/shared

# Server source, config, and migration assets
COPY server/src        ./server/src
COPY server/scripts    ./server/scripts
COPY server/migrations ./server/migrations
COPY server/tsconfig.json ./server/tsconfig.json

# Non-root user for least-privilege execution
RUN addgroup -S ceos && adduser -S ceos -G ceos
USER ceos

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

WORKDIR /app/server

# tsx is the production runtime — no separate compile step needed.
CMD ["node", "--import", "tsx/esm", "src/server.ts"]
