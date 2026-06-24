import { api } from "@/core/api";
import type { ApiCreateClientInput } from "@/core/api";

export function useCreateClientApi() {
  return (input: ApiCreateClientInput) => api.createClient(input);
}

export function useUpdateClientApi() {
  return (id: string, input: Partial<ApiCreateClientInput>) => api.updateClient(id, input);
}
