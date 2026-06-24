import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useData } from "@/core/store";
import { useAuth } from "@/core/auth";
import { useGenerateDocument } from "./api";
import { DOC_TYPES, docTypeByKey, type DocScope } from "./docTypes";
import { PageHeader, EmptyState } from "@/shared/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { FileText, FilePlus2, Download } from "lucide-react";
import { apiEnabled } from "@/core/api";

export function Documents() {
  const data = useData();
  const generateDocument = useGenerateDocument();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [scope, setScope] = useState<DocScope>("batch");
  const [docTypeKey, setDocTypeKey] = useState("grn");
  const [entityId, setEntityId] = useState(data.batches[0]?.id ?? "");

  const typesForScope = DOC_TYPES.filter((d) => d.scope === scope);

  const onScope = (s: DocScope) => {
    setScope(s);
    setDocTypeKey(DOC_TYPES.find((d) => d.scope === s)!.key);
    setEntityId(
      s === "batch" ? (data.batches[0]?.id ?? "") : (data.shipments[0]?.id ?? ""),
    );
  };

  const generate = () => {
    if (!entityId) return;
    generateDocument(
      {
        type: docTypeKey,
        batch_id: scope === "batch" ? entityId : null,
        shipment_id: scope === "shipment" ? entityId : null,
      },
      user.id,
    );
    navigate(`/documents/print/${docTypeKey}/${entityId}`);
  };

  const entityLabel = (d: { batch_id: string | null; shipment_id: string | null }) => {
    if (d.batch_id)
      return data.batches.find((b) => b.id === d.batch_id)?.batch_code ?? d.batch_id;
    if (d.shipment_id)
      return (
        data.shipments.find((s) => s.id === d.shipment_id)?.container_no ??
        d.shipment_id
      );
    return "—";
  };

  const generated = useMemo(
    () =>
      [...data.documents].sort((a, b) =>
        b.generated_at.localeCompare(a.generated_at),
      ),
    [data.documents],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        subtitle="Generate branded GRNs, invoices and the full export set. Re-openable any time."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FilePlus2 className="size-4 text-primary" /> Generate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <div className="flex gap-2">
                <Button
                  variant={scope === "batch" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => onScope("batch")}
                >
                  Batch
                </Button>
                <Button
                  variant={scope === "shipment" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => onScope("shipment")}
                >
                  Shipment
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{scope === "batch" ? "Batch" : "Container"}</Label>
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {scope === "batch"
                    ? data.batches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.batch_code} · {b.coffee_grade}
                        </SelectItem>
                      ))
                    : data.shipments.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.container_no} → {s.destination_country}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Document type</Label>
              <Select value={docTypeKey} onValueChange={setDocTypeKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typesForScope.map((d) => (
                    <SelectItem key={d.key} value={d.key}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={generate} disabled={!entityId} className="w-full">
              <FileText className="size-4" /> Generate &amp; open
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Generated documents</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {generated.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No documents yet"
                description="Generate a document on the left — it'll be listed here and stay re-openable."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-2 font-medium">Document</th>
                      <th className="px-3 py-2 font-medium">Source</th>
                      <th className="px-3 py-2 font-medium">Generated</th>
                      <th className="px-5 py-2 text-right font-medium">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generated.map((d) => (
                      <tr
                        key={d.id}
                        className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-5 py-2.5 font-medium">
                          {docTypeByKey(d.type)?.label ?? d.type}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {entityLabel(d)}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {new Date(d.generated_at).toLocaleString("en-UG", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              to={`/documents/print/${d.type}/${d.batch_id ?? d.shipment_id}`}
                              className="text-primary hover:underline text-sm"
                            >
                              View / print
                            </Link>
                            {apiEnabled() && (
                              <a
                                href={`${import.meta.env.VITE_API_URL}/documents/${d.type}/${d.batch_id ?? d.shipment_id}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                                title="Download PDF"
                              >
                                <Download className="size-3.5" /> PDF
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
