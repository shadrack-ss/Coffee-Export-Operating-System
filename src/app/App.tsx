import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { AppShell } from "@/app/AppShell";
import { useAuth, type Permission } from "@/core/auth";
import { EmptyState } from "@/shared/components/states";
import { ShieldAlert } from "lucide-react";

import { Dashboard } from "@/features/dashboard";
import { Batches, BatchDetail } from "@/features/batches";
import { NewGRN } from "@/features/quality";
import { Expenses } from "@/features/costing";
import { Approvals } from "@/features/approvals";
import { Processing } from "@/features/processing";
import { Forex } from "@/features/forex";
import { Traceability } from "@/features/traceability";
import { Shipments } from "@/features/shipments";
import { Clients, CatalogPrint } from "@/features/crm";
import { Suppliers } from "@/features/suppliers";
import { Documents, DocumentPrint } from "@/features/documents";
import { Notifications } from "@/features/notifications";
import { Settings } from "@/features/settings";
import { Audit } from "@/features/audit";
import { Users } from "@/features/users";

/** Route-level permission gate — mirrors RLS; blocks cross-role access (§3). */
function Require({
  perm,
  children,
}: {
  perm: Permission;
  children: ReactNode;
}) {
  const { can } = useAuth();
  if (!can(perm)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No access"
        description="Your role doesn't have permission to view this page."
      />
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone print views — full page, no app chrome */}
        <Route path="/documents/print/:type/:entityId" element={<DocumentPrint />} />
        <Route path="/clients/catalog" element={<CatalogPrint />} />

        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="batches" element={<Batches />} />
          <Route
            path="batches/new"
            element={
              <Require perm="grn.create">
                <NewGRN />
              </Require>
            }
          />
          <Route path="batches/:id" element={<BatchDetail />} />
          <Route path="processing" element={<Processing />} />
          <Route
            path="expenses"
            element={
              <Require perm="costing.view">
                <Expenses />
              </Require>
            }
          />
          <Route
            path="approvals"
            element={
              <Require perm="payment.approve">
                <Approvals />
              </Require>
            }
          />
          <Route path="forex" element={<Forex />} />
          <Route path="traceability" element={<Traceability />} />
          <Route
            path="shipments"
            element={
              <Require perm="payment.approve">
                <Shipments />
              </Require>
            }
          />
          <Route path="clients" element={<Clients />} />
          <Route
            path="suppliers"
            element={
              <Require perm="suppliers.manage">
                <Suppliers />
              </Require>
            }
          />
          <Route path="documents" element={<Documents />} />
          <Route path="notifications" element={<Notifications />} />
          <Route
            path="audit"
            element={
              <Require perm="audit.view">
                <Audit />
              </Require>
            }
          />
          <Route
            path="settings"
            element={
              <Require perm="settings.edit">
                <Settings />
              </Require>
            }
          />
          <Route
            path="users"
            element={
              <Require perm="users.manage">
                <Users />
              </Require>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
