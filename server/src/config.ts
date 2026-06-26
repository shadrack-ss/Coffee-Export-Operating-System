/* Environment configuration. Secrets come from env vars, never hardcoded. */

const isProd = process.env.NODE_ENV === "production";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required env var ${name}`);
  if (isProd && fallback !== undefined && v === fallback) {
    throw new Error(`${name} must be set explicitly in production`);
  }
  return v;
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required(
    "DATABASE_URL",
    "postgres://ceos:ceos@localhost:5432/ceos",
  ),
  jwtSecret: required("JWT_SECRET", "dev-only-insecure-secret-change-me"),
  corsOrigin: process.env.CORS_ORIGIN ?? (isProd ? (() => { throw new Error("CORS_ORIGIN must be set in production"); })() : /^http:\/\/localhost:\d+$/),
};
