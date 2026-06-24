import { api } from "@/core/api";
import type { ApiCreateUserInput, ApiUpdateUserInput } from "@/core/api";

export function useCreateUserApi() {
  return (input: ApiCreateUserInput) => api.createUser(input);
}

export function useUpdateUserApi() {
  return (id: string, input: ApiUpdateUserInput) => api.updateUser(id, input);
}

export function useDeactivateUserApi() {
  return (id: string) => api.deactivateUser(id);
}

export function useResetUserPasswordApi() {
  return (id: string, temp_password: string) =>
    api.resetUserPassword(id, temp_password);
}
