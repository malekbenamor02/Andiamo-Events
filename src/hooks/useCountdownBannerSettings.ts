import { useQuery } from "@tanstack/react-query";
import {
  COUNTDOWN_BANNER_SETTINGS_KEY,
  fetchCountdownBannerSettings,
} from "@/lib/countdownBannerSettings";

/**
 * Public read of countdown banner settings (site_content). Short stale time so admin changes show up reasonably soon.
 */
export function useCountdownBannerSettings() {
  return useQuery({
    queryKey: ["site_content", COUNTDOWN_BANNER_SETTINGS_KEY],
    queryFn: fetchCountdownBannerSettings,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
