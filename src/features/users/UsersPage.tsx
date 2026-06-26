import { useState } from "react";
import { useData } from "@/core/store";
import { useAuth, ROLE_LABELS } from "@/core/auth";
import { PageHeader } from "@/shared/components/states";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  useCreateUserApi,
  useUpdateUserApi,
  useDeactivateUserApi,
  useResetUserPasswordApi,
} from "./api";
import { UserPlus, Pencil, UserX } from "lucide-react";
import type { Role } from "@/shared/types";

const ROLES: Role[] = ["grader", "accountant", "admin", "auditor"];

interface UserForm { name: string; email: string; phone: string; role: Role; temp_password: string }
interface EditForm { name: string; role: Role; new_password: string }

export function Users() {
  const store = useData();
  const { user: me, can } = useAuth();
  const { users } = store;

  const createUserApi = useCreateUserApi();
  const updateUserApi = useUpdateUserApi();
  const deactivateUserApi = useDeactivateUserApi();
  const resetUserPasswordApi = useResetUserPasswordApi();

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState<UserForm>({
    name: "", email: "", phone: "", role: "grader", temp_password: "",
  });
  const [editForm, setEditForm] = useState<EditForm>({ name: "", role: "grader", new_password: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await createUserApi({ ...form, phone: form.phone.trim() || null });
      await store.refresh();
      setShowCreate(false);
      setForm({ name: "", email: "", phone: "", role: "grader", temp_password: "" });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to create user");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (id: string) => {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    setEditForm({ name: u.name, role: u.role, new_password: "" });
    setEditTarget(id);
    setErr(null);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    const newPassword = editForm.new_password.trim();
    if (newPassword && newPassword.length < 8) {
      setErr("New password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await updateUserApi(editTarget, { name: editForm.name, role: editForm.role });
      if (newPassword) {
        await resetUserPasswordApi(editTarget, newPassword);
      }
      await store.refresh();
      setEditTarget(null);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to update user");
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Deactivate this user? They will no longer be able to log in.")) return;
    setBusy(true);
    try {
      await deactivateUserApi(id);
      await store.refresh();
    } catch (ex) {
      alert(ex instanceof Error ? ex.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const canManage = can("users.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Staff accounts and roles. Role matrix is enforced by the API."
        action={
          canManage ? (
            <Button onClick={() => { setShowCreate(true); setErr(null); }}>
              <UserPlus className="size-4" /> Invite user
            </Button>
          ) : undefined
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-3 py-2.5 font-medium">Email / Phone</th>
              <th className="px-3 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              {canManage && <th className="px-4 py-2.5 font-medium" />}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-3 py-3 text-muted-foreground">
                  <div>{u.email}</div>
                  {u.phone && <div className="text-xs">{u.phone}</div>}
                </td>
                <td className="px-3 py-3">
                  <Badge variant="primary">{ROLE_LABELS[u.role]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={u.active ? "success" : "default"}>
                    {u.active ? "Active" : "Disabled"}
                  </Badge>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(u.id)}
                        title="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {u.active && u.id !== me.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeactivate(u.id)}
                          disabled={busy}
                          title="Deactivate"
                          className="text-danger hover:text-danger"
                        >
                          <UserX className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      {/* Create user dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Name">
              <input
                className="input w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className="input w-full"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </Field>
            <Field label="Phone number (optional — can be used to sign in)">
              <input
                type="tel"
                className="input w-full"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+256700000000"
              />
            </Field>
            <Field label="Role">
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as Role })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Temporary password">
              <input
                type="password"
                className="input w-full"
                value={form.temp_password}
                onChange={(e) => setForm({ ...form, temp_password: e.target.value })}
                required
                minLength={8}
                placeholder="Min. 8 characters"
              />
            </Field>
            {err && <p className="text-xs text-danger">{err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create user"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <Field label="Name">
              <input
                className="input w-full"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
                minLength={2}
              />
            </Field>
            <Field label="Role">
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm({ ...editForm, role: v as Role })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reset password (optional)">
              <input
                type="password"
                className="input w-full"
                value={editForm.new_password}
                onChange={(e) => setEditForm({ ...editForm, new_password: e.target.value })}
                minLength={8}
                placeholder="Leave blank to keep current password"
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Sets a new temporary password. Share it with the user — they can change it themselves after signing in.
              </p>
            </Field>
            {err && <p className="text-xs text-danger">{err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
