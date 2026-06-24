import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/core/store";
import { allBatchFinancials, indicativeUsdPerKg } from "@/features/batches";
import { Button } from "@/shared/ui/button";
import { fmtKg, fmtUsd } from "@/shared/lib/money";
import { ArrowLeft, Printer } from "lucide-react";

export function CatalogPrint() {
  const data = useData();
  const liveRate = data.liveRate?.usd_ugx_rate ?? 0;

  // available, sellable coffee: graded+ and not yet exported
  const offerings = useMemo(() => {
    const fin = allBatchFinancials(data, liveRate);
    // a batch already transformed into a child is no longer itself available
    const processedInputs = new Set(
      data.processing.map((p) => p.input_batch_id),
    );
    const byGrade = new Map<
      string,
      { grade: string; kg: number; districts: Set<string> }
    >();
    for (const f of fin) {
      if (["received", "exported"].includes(f.batch.status)) continue;
      if (processedInputs.has(f.batch.id)) continue;
      const g = byGrade.get(f.batch.coffee_grade) ?? {
        grade: f.batch.coffee_grade,
        kg: 0,
        districts: new Set<string>(),
      };
      g.kg += f.quantity_kg;
      g.districts.add(f.batch.origin_district);
      byGrade.set(f.batch.coffee_grade, g);
    }
    return [...byGrade.values()].sort(
      (a, b) => indicativeUsdPerKg(b.grade) - indicativeUsdPerKg(a.grade),
    );
  }, [data, liveRate]);

  return (
    <div className="min-h-screen bg-muted/40 py-6">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 no-print">
        <Button asChild variant="ghost">
          <Link to="/clients">
            <ArrowLeft className="size-4" /> Clients
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> Print / Save PDF
        </Button>
      </div>

      <div className="print-sheet mx-auto max-w-3xl rounded-lg border border-border bg-white p-10 text-stone-900 shadow-sm">
        <div className="flex items-center gap-3 border-b-2 border-stone-800 pb-4">
          <div className="flex size-12 items-center justify-center rounded-md bg-[#B45309] text-white">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2v2M14 2v2M6 2v2" />
              <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
            </svg>
          </div>
          <div>
            <div className="text-xl font-bold">CE-OS Coffee Exporters</div>
            <div className="text-sm text-stone-500">
              Buyer catalogue · {new Date().toLocaleDateString("en-UG", { year: "numeric", month: "long" })}
            </div>
          </div>
        </div>

        <p className="py-5 text-sm text-stone-600">
          Available Ugandan coffee, by grade. Indicative FOB prices in USD/kg;
          firm offers on request. Full farmer-to-container traceability provided
          with every lot.
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-300 text-left text-stone-500">
              <th className="py-2 font-medium">Grade</th>
              <th className="py-2 font-medium">Origin districts</th>
              <th className="py-2 text-right font-medium">Available</th>
              <th className="py-2 text-right font-medium">Indicative FOB</th>
            </tr>
          </thead>
          <tbody>
            {offerings.map((o) => (
              <tr key={o.grade} className="border-b border-stone-100">
                <td className="py-2.5 font-medium">{o.grade}</td>
                <td className="py-2.5 text-stone-600">
                  {[...o.districts].join(", ")}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {fmtKg(o.kg)} kg
                </td>
                <td className="py-2.5 text-right font-medium tabular-nums">
                  ${fmtUsd(indicativeUsdPerKg(o.grade))}/kg
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-10 text-center text-[10px] text-stone-400">
          CE-OS Coffee Exporters · Kampala, Uganda · UCDA Lic. UG-EXP-0042 ·
          export@ceos.ug
        </p>
      </div>
    </div>
  );
}
