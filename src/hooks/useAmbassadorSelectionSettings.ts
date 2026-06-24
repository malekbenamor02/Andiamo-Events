import { useQuery } from "@tanstack/react-query";
import {
  AMBASSADOR_SELECTION_SETTINGS_KEY,
  fetchAmbassadorSelectionSettings,
} from "@/lib/ambassadorSelectionSettings";

/**
 * Public read of ambassador selection settings (site_content).
 */
export function useAmbassadorSelectionSettings() {
  return useQuery({
    queryKey: ["site_content", AMBASSADOR_SELECTION_SETTINGS_KEY],
    queryFn: fetchAmbassadorSelectionSettings,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
