/* Settings feature write-logic — persist standards to the API. */

import { api, type SettingsPatch } from "@/core/api";

export function useUpdateSettingsApi() {
  return (patch: SettingsPatch) => api.updateSettings(patch);
}
