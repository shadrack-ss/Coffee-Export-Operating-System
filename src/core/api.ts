/*
 * Frontend API client for the CE-OS Fastify backend.
 *
 * The app always runs against this live backend (configured via VITE_API_URL);
 * feature hooks call these methods and the store hydrates from GET /state.
 */

import { getToken, clearSession, type Session, type SessionUser } from "./session";
import type {
  DefectHandlingMode,
  ExpenseBasis,
  ProcessType,
  Settings,
  DataState,
} from "@/shared/types";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export function apiEnabled(): boolean {
  return BASE.length > 0;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    // A 401 on a request we authenticated means the session expired or was
    // revoked. Clear it and bounce to the login screen. (A 401 without a token
    // is a failed login attempt — let LoginScreen surface that itself.)
    if (res.status === 401 && token) {
      clearSession();
      if (window.location.pathname !== "/") window.location.assign("/");
      else window.location.reload();
    }
    const msg = body?.message ?? body?.error ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

export interface SupplierRef {
  id: string;
  name: string;
  type: string;
  district_id: number;
}
export interface LookupRow {
  id: number;
  name: string;
}
export interface ReferenceData {
  suppliers: SupplierRef[];
  districts: LookupRow[];
  grades: LookupRow[];
}

export interface ApiGrnInput {
  supplier_id: string;
  district_id: number;
  grade_id: number;
  buyer_id: string | null;
  market_price_per_kg: number;
  gross_weight_kg: number;
  tare_weight_kg: number;
  moisture_pct: number;
  fallen_matter_pct: number;
  defect_breakdown: {
    black_beans_pct: number;
    broken_pct: number;
    husks_pct: number;
    insect_damage_pct: number;
    foreign_matter_pct: number;
  };
  defect_handling_mode: DefectHandlingMode;
}

export interface GrnResult {
  batch: { id: string; batch_code: string; net_payable_weight_kg: number };
  recommended_grade: string;
  derivation: { label: string; rule: string; weight_kg: number; delta_kg: number }[];
}

export const api = {
  enabled: apiEnabled,

  async login(identifier: string, password: string): Promise<Session> {
    const data = await req<{ token: string; user: SessionUser }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ identifier, password }) },
    );
    return { token: data.token, user: data.user };
  },

  changePassword(current_password: string, new_password: string): Promise<{ ok: boolean }> {
    return req("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    });
  },

  resetUserPassword(id: string, temp_password: string): Promise<{ ok: boolean }> {
    return req(`/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ temp_password }),
    });
  },

  reference(): Promise<ReferenceData> {
    return req<ReferenceData>("/reference");
  },

  /** Full read snapshot — the store hydrates from this in API mode. */
  state(): Promise<DataState> {
    return req<DataState>("/state");
  },

  createGrn(input: ApiGrnInput): Promise<GrnResult> {
    return req<GrnResult>("/grn", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  addExpense(input: ApiExpenseInput): Promise<{ id: string }> {
    return req<{ id: string }>("/expenses", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  deleteExpense(id: string): Promise<{ ok: boolean }> {
    return req<{ ok: boolean }>(`/expenses/${id}`, { method: "DELETE" });
  },

  recordProcessing(
    input: ApiProcessingInput,
  ): Promise<{ child_batch_id: string; batch_code: string }> {
    return req("/processing", { method: "POST", body: JSON.stringify(input) });
  },

  syncUraRate(): Promise<{ ok: boolean; rate?: number; date?: string; error?: string }> {
    return req("/forex/sync-ura", { method: "POST", body: JSON.stringify({}) });
  },

  setLiveRate(rate: number, source: string): Promise<{ ok: boolean }> {
    return req("/forex/rate", {
      method: "POST",
      body: JSON.stringify({ rate, source }),
    });
  },

  lockRate(
    batch_id: string,
    rate: number,
    source: string,
  ): Promise<{ ok: boolean }> {
    return req("/forex/lock", {
      method: "POST",
      body: JSON.stringify({ batch_id, rate, source }),
    });
  },

  updateSettings(patch: SettingsPatch): Promise<Settings> {
    return req<Settings>("/settings", {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  },

  approve(batch_id: string): Promise<{ batch_id: string; amount_ugx: number }> {
    return req("/approvals", {
      method: "POST",
      body: JSON.stringify({ batch_id }),
    });
  },

  createUser(input: ApiCreateUserInput): Promise<{ id: string; name: string; email: string; role: string }> {
    return req("/users", { method: "POST", body: JSON.stringify(input) });
  },

  updateUser(id: string, input: ApiUpdateUserInput): Promise<{ id: string; name: string; email: string; role: string }> {
    return req(`/users/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },

  deactivateUser(id: string): Promise<{ ok: boolean }> {
    return req(`/users/${id}`, { method: "DELETE" });
  },

  createClient(input: ApiCreateClientInput): Promise<{ id: string }> {
    return req("/clients", { method: "POST", body: JSON.stringify(input) });
  },

  updateClient(id: string, input: Partial<ApiCreateClientInput>): Promise<{ id: string }> {
    return req(`/clients/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },

  createSupplier(input: ApiCreateSupplierInput): Promise<{ id: string }> {
    return req("/suppliers", { method: "POST", body: JSON.stringify(input) });
  },

  updateSupplier(id: string, input: Partial<ApiCreateSupplierInput>): Promise<{ id: string }> {
    return req(`/suppliers/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },

  createShipment(input: ApiCreateShipmentInput): Promise<{ id: string }> {
    return req("/shipments", { method: "POST", body: JSON.stringify(input) });
  },

  allocateBatch(shipment_id: string, input: ApiAllocateBatchInput): Promise<{ id: string }> {
    return req(`/shipments/${shipment_id}/allocations`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export interface ApiCreateUserInput {
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  temp_password: string;
}

export interface ApiUpdateUserInput {
  name?: string;
  role?: string;
}

export interface ApiCreateClientInput {
  name: string;
  country: string;
  email: string;
  segment: string;
}

export interface ApiCreateSupplierInput {
  name: string;
  type: string;
  district_id: number;
  contact: string;
  gps_lat?: number | null;
  gps_lng?: number | null;
}

export interface ApiCreateShipmentInput {
  container_no: string;
  seal_no: string;
  buyer_id: string;
  destination_country: string;
}

export interface ApiAllocateBatchInput {
  batch_id: string;
  qty_kg: number;
}

export interface ApiProcessingInput {
  input_batch_id: string;
  input_kg: number;
  output_kg: number;
  process_type: ProcessType;
}

export type SettingsPatch = Omit<
  Settings,
  "coffee_grades" | "districts" | "expense_categories"
>;

export interface ApiExpenseInput {
  batch_id: string;
  category: string;
  amount_ugx: number;
  basis: ExpenseBasis;
  allocation_group_label: string | null;
  note?: string;
}
