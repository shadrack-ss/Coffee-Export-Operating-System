/*
 * Quality feature write-logic — creating a GRN against the live API, plus the
 * reference-data fetch (suppliers + districts + grades) the form needs.
 */

import { useEffect, useState } from "react";
import {
  api,
  type ReferenceData,
  type ApiGrnInput,
  type GrnResult,
} from "@/core/api";

/** Fetch the GRN reference data (suppliers + districts + grades) from the API. */
export function useApiReference() {
  const [data, setData] = useState<ReferenceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .reference()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e?.message ?? "failed to load reference"));
    return () => {
      alive = false;
    };
  }, []);
  return { data, error };
}

/** Submit a GRN to the live API. */
export function useCreateGrnApi() {
  return (input: ApiGrnInput): Promise<GrnResult> => api.createGrn(input);
}
