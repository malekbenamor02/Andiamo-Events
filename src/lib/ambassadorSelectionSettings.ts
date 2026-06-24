import { supabase } from "@/integrations/supabase/client";
import { upsertSiteContentViaApi } from "@/lib/adminSiteContent";
import { CITIES, type City } from "@/lib/constants";

export const AMBASSADOR_SELECTION_SETTINGS_KEY = "ambassador_selection_settings" as const;

/** Cities where neighborhood (ville) filtering applies at checkout. */
export const AMBASSADOR_NEIGHBORHOOD_CITIES = ["Sousse", "Tunis"] as const satisfies readonly City[];

export type AmbassadorNeighborhoodCity = (typeof AMBASSADOR_NEIGHBORHOOD_CITIES)[number];

export interface AmbassadorSelectionSettings {
  cityWide: Partial<Record<City, boolean>>;
}

export function normalizeAmbassadorSelectionSettings(raw: unknown): AmbassadorSelectionSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawCityWide =
    o.cityWide && typeof o.cityWide === "object" ? (o.cityWide as Record<string, unknown>) : {};

  const cityWide: Partial<Record<City, boolean>> = {};
  for (const city of CITIES) {
    if (rawCityWide[city] === true) {
      cityWide[city] = true;
    }
  }

  return { cityWide };
}

export function isAmbassadorCityWide(
  city: string,
  settings: AmbassadorSelectionSettings | undefined
): boolean {
  if (!city || !settings) return false;
  const normalized = city.trim();
  return settings.cityWide[normalized as City] === true;
}

export async function fetchAmbassadorSelectionSettings(): Promise<AmbassadorSelectionSettings> {
  try {
    const { data, error } = await supabase
      .from("site_content")
      .select("content")
      .eq("key", AMBASSADOR_SELECTION_SETTINGS_KEY)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching ambassador selection settings:", error);
      return normalizeAmbassadorSelectionSettings({});
    }

    if (data?.content) {
      return normalizeAmbassadorSelectionSettings(data.content);
    }

    return normalizeAmbassadorSelectionSettings({});
  } catch (e) {
    console.error("Error fetching ambassador selection settings:", e);
    return normalizeAmbassadorSelectionSettings({});
  }
}

export async function upsertAmbassadorSelectionSettings(
  settings: AmbassadorSelectionSettings
): Promise<void> {
  const normalized = normalizeAmbassadorSelectionSettings(settings);
  await upsertSiteContentViaApi(AMBASSADOR_SELECTION_SETTINGS_KEY, {
    cityWide: normalized.cityWide,
  });
}
