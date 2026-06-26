/*
 * Role-based access control — the single source of truth shared by the frontend
 * (UI gating in core/auth) and the API (Fastify RBAC middleware). Pure, no deps.
 *
 * Keeping ONE matrix avoids the dangerous failure mode where client and server
 * authorization rules drift apart. New roles/permissions slot in here.
 */

import type { Role } from "./types";

export type Permission =
  | "grn.create"
  | "quality.edit"
  | "expense.edit"
  | "costing.view"
  | "payment.approve"
  | "users.manage"
  | "settings.edit"
  | "clients.manage"
  | "suppliers.manage"
  | "audit.view"
  | "forex.manage"
  | "batches.void";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  grader: ["grn.create", "quality.edit"],
  accountant: ["expense.edit", "costing.view", "forex.manage"],
  admin: [
    "grn.create",
    "quality.edit",
    "expense.edit",
    "costing.view",
    "payment.approve",
    "users.manage",
    "settings.edit",
    "clients.manage",
    "suppliers.manage",
    "audit.view",
    "forex.manage",
    "batches.void",
  ],
  auditor: ["costing.view", "audit.view"],
};

export function can(role: Role, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(perm);
}

export const ROLE_LABELS: Record<Role, string> = {
  grader: "Quality Grader",
  accountant: "Accountant",
  admin: "Admin / Owner",
  auditor: "Auditor",
};
