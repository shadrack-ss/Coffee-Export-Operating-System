import { useData } from "@/core/store";
import { PageHeader, EmptyState } from "@/shared/components/states";
import { Card } from "@/shared/ui/card";

export function Audit() {
  const { audit, users } = useData();
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const rows = [...audit].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit trail"
        subtitle="Every change to money, quality and stock records. Read-only."
      />
      {rows.length === 0 ? (
        <EmptyState title="No audit entries yet" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-3 py-2.5 font-medium">Actor</th>
                  <th className="px-3 py-2.5 font-medium">Action</th>
                  <th className="px-3 py-2.5 font-medium">Entity</th>
                  <th className="px-3 py-2.5 font-medium">Field</th>
                  <th className="px-3 py-2.5 font-medium">Old → New</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(a.at).toLocaleString("en-UG", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{name(a.actor)}</td>
                    <td className="px-3 py-2.5">{a.action.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{a.entity}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {a.field ?? "—"}
                    </td>
                    <td className="tnum px-3 py-2.5 tabular-nums">
                      {a.old_value || a.new_value ? (
                        <span>
                          <span className="text-muted-foreground">
                            {a.old_value ?? "∅"}
                          </span>
                          {" → "}
                          <span className="font-medium">{a.new_value ?? "∅"}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
