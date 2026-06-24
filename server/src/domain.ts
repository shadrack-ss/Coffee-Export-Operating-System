/*
 * Bridge to the shared domain kernel — the SAME pure code the frontend uses.
 * The financial engine and types are imported unchanged (no rewrite), which is
 * the whole reason the backend is TypeScript too.
 */

export * from "../../src/shared/calc/index.ts";
export * from "../../src/shared/types/index.ts";
export {
  ROLE_PERMISSIONS,
  can,
  ROLE_LABELS,
  type Permission,
} from "../../src/shared/authz.ts";
