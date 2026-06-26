import { useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/core/store";
import { useAuth } from "@/core/auth";
import { PageHeader } from "@/shared/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Copy, Check, BookOpen, Send, Plus } from "lucide-react";
import { useCreateClientApi } from "./api";

const TEMPLATES: { key: string; label: string; body: string }[] = [
  {
    key: "eid",
    label: "Eid greetings",
    body: "Dear {{name}},\n\nEid Mubarak from all of us at CE-OS Coffee Exporters. We deeply value our partnership with {{company}} and wish you and your team a joyful celebration. We look forward to another season of excellent Ugandan coffee together.\n\nWarm regards,\nCE-OS Coffee Exporters",
  },
  {
    key: "christmas",
    label: "Season's greetings",
    body: "Dear {{name}},\n\nSeason's greetings from CE-OS Coffee Exporters. Thank you for your trust in our coffee throughout the year. May the festive season bring you rest and prosperity, and we look forward to serving {{company}} in the new year.\n\nWarm regards,\nCE-OS Coffee Exporters",
  },
  {
    key: "newyear",
    label: "New Year wishes",
    body: "Dear {{name}},\n\nHappy New Year from CE-OS Coffee Exporters! We're grateful for our partnership with {{company}} and excited about the coffee we'll share this year. Wishing you health and success ahead.\n\nWarm regards,\nCE-OS Coffee Exporters",
  },
];

interface ClientForm { name: string; country: string; email: string; segment: string }

export function Clients() {
  const store = useData();
  const { can } = useAuth();
  const { clients } = store;
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [templateKey, setTemplateKey] = useState(TEMPLATES[0].key);
  const [copied, setCopied] = useState(false);

  const createClientApi = useCreateClientApi();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<ClientForm>({ name: "", country: "", email: "", segment: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await createClientApi(form);
      await store.refresh();
      setShowCreate(false);
      setForm({ name: "", country: "", email: "", segment: "" });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to add buyer");
    } finally {
      setBusy(false);
    }
  };

  const canManage = can("clients.manage");

  const client = clients.find((c) => c.id === clientId);
  const template = TEMPLATES.find((t) => t.key === templateKey)!;
  const message = template.body
    .replace(/\{\{name\}\}/g, client?.name.split(" ")[0] ?? "there")
    .replace(/\{\{company\}\}/g, client?.name ?? "your company");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients / CRM"
        subtitle="Buyers, reusable greeting templates, and the branded buyer catalog."
        action={
          <div className="flex gap-2">
            {canManage && (
              <Button onClick={() => { setShowCreate(true); setErr(null); }}>
                <Plus className="size-4" /> Add buyer
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/clients/catalog">
                <BookOpen className="size-4" /> Buyer catalog
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Buyers</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Country</th>
                  <th className="px-5 py-2 font-medium">Segment</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-5 py-2.5">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.email}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {c.country}
                    </td>
                    <td className="px-5 py-2.5">
                      <Badge variant="outline">{c.segment}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Greeting templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Buyer</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Template</Label>
                <Select value={templateKey} onValueChange={setTemplateKey}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm">
              {message}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={copy} className="flex-1">
                {copied ? (
                  <>
                    <Check className="size-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-4" /> Copy message
                  </>
                )}
              </Button>
              <Button disabled title="External channels (email / WhatsApp / SMS) land later">
                <Send className="size-4" /> Send
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Copy to send now via your channel of choice. Direct email / WhatsApp /
              SMS sending arrives with the backend.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add buyer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Company name</Label>
              <input
                className="input w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Country</Label>
              <input
                className="input w-full"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <input
                type="email"
                className="input w-full"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Segment</Label>
              <input
                className="input w-full"
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value })}
                placeholder="e.g. Specialty, Commercial"
                required
              />
            </div>
            {err && <p className="text-xs text-danger">{err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Add buyer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
