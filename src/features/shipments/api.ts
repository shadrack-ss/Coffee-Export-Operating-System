import { api } from "@/core/api";
import type { ApiCreateShipmentInput, ApiAllocateBatchInput } from "@/core/api";

export function useCreateShipmentApi() {
  return (input: ApiCreateShipmentInput) => api.createShipment(input);
}

export function useAllocateBatchApi() {
  return (shipment_id: string, input: ApiAllocateBatchInput) =>
    api.allocateBatch(shipment_id, input);
}
