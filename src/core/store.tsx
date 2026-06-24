/*
 * Core data store for CE-OS (production / API-only).
 *
 * This is intentionally THIN: it holds the raw collections + settings hydrated
 * from the backend, plus a generic `update` (optimistic in-memory patch) and a
 * `refresh` (re-pull GET /state). Each feature owns its own write-logic in its
 * `api.ts` (e.g. quality/useCreateGrn, forex/useLockRate), which calls the live
 * API and then refreshes — so features don't depend on each other through a God
 * object.
 *
 * Components read through `useData()` and never touch raw arrays. The provider
 * is only mounted once authenticated (see AuthGate), so it can always assume a
 * live session and hydrate from the API.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ForexSnapshot, DataState } from "@/shared/types";
import { api } from "./api";

export type { DataState };

export interface Store extends DataState {
  /** Commit a partial state patch (optimistic, in-memory only). */
  update: (patch: Partial<DataState>) => void;
  /** re-pull the snapshot from the API */
  refresh: () => Promise<void>;
  /** live USD/UGX rate (the global ticker snapshot, batch_id === null) */
  liveRate: ForexSnapshot | undefined;
}

const DataContext = createContext<Store | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hydrate = async () => {
    setError(null);
    try {
      const snapshot = await api.state();
      setState(snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    }
  };

  useEffect(() => {
    void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<Store | null>(() => {
    if (!state) return null;

    const update = (patch: Partial<DataState>) =>
      setState((prev) => ({ ...(prev as DataState), ...patch }));

    const liveRate = state.forex
      .filter((f) => f.batch_id === null)
      .sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];

    return { ...state, update, refresh: hydrate, liveRate };
  }, [state]);

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {error ? (
          <div className="space-y-2 text-center">
            <p className="text-danger">Couldn't load data from the API.</p>
            <p className="text-xs">{error}</p>
            <button
              className="rounded-md border border-border px-3 py-1.5 text-foreground"
              onClick={() => void hydrate()}
            >
              Retry
            </button>
          </div>
        ) : (
          "Loading live data…"
        )}
      </div>
    );
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): Store {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within <DataProvider>");
  return ctx;
}
