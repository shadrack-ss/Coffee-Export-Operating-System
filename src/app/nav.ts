import {
  LayoutDashboard,
  Boxes,
  Cog,
  Receipt,
  TrendingUp,
  GitBranch,
  Users2,
  FileText,
  Bell,
  Settings as SettingsIcon,
  ShieldCheck,
  BadgeCheck,
  Container,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/core/auth";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** if set, item only shows when the user has this permission */
  perm?: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/batches", label: "Batches", icon: Boxes },
  { to: "/processing", label: "Processing", icon: Cog },
  { to: "/expenses", label: "Expenses", icon: Receipt, perm: "costing.view" },
  { to: "/approvals", label: "Approvals", icon: BadgeCheck, perm: "payment.approve" },
  { to: "/shipments", label: "Shipments", icon: Container, perm: "payment.approve" },
  { to: "/forex", label: "Forex", icon: TrendingUp },
  { to: "/traceability", label: "Traceability", icon: GitBranch },
  { to: "/clients", label: "Clients / CRM", icon: Users2 },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/audit", label: "Audit trail", icon: ShieldCheck, perm: "audit.view" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, perm: "settings.edit" },
  { to: "/users", label: "Users", icon: Users2, perm: "users.manage" },
];
