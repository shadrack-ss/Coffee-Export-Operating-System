import { useEffect, useState } from "react";
import { api, type ApiCreateSupplierInput, type ReferenceData } from "@/core/api";

export function useSupplierReference() {
  const [data, setData] = useState<ReferenceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .reference()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e?.message ?? "failed to load reference"));
    return () => { alive = false; };
  }, []);
  return { data, error };
}

export function useCreateSupplierApi() {
  return (input: ApiCreateSupplierInput) => api.createSupplier(input);
}

export function useUpdateSupplierApi() {
  return (id: string, input: Partial<ApiCreateSupplierInput>) => api.updateSupplier(id, input);
}
