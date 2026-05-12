import { supabase } from "@/integrations/supabase/client";

export const COUNTDOWN_BANNER_SETTINGS_KEY = "countdown_banner_settings" as const;

export const COUNTDOWN_LABEL_DEFAULT_EN = "Limited time unveiling";
export const COUNTDOWN_LABEL_DEFAULT_FR = "Dévoilement à durée limitée";

export interface CountdownBannerSettings {
  enabled: boolean;
  label_en: string;
  label_fr: string;
}

function normalizeCountdownBannerContent(raw: unknown): CountdownBannerSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const en =
    typeof o.label_en === "string" && o.label_en.trim().length > 0
      ? o.label_en.trim()
      : COUNTDOWN_LABEL_DEFAULT_EN;
  const fr =
    typeof o.label_fr === "string" && o.label_fr.trim().length > 0
      ? o.label_fr.trim()
      : COUNTDOWN_LABEL_DEFAULT_FR;
  return {
    enabled: o.enabled === true,
    label_en: en,
    label_fr: fr,
  };
}

export async function fetchCountdownBannerSettings(): Promise<CountdownBannerSettings> {
  try {
    const { data, error } = await supabase
      .from("site_content")
      .select("content")
      .eq("key", COUNTDOWN_BANNER_SETTINGS_KEY)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching countdown banner settings:", error);
      return normalizeCountdownBannerContent({});
    }

    if (data?.content) {
      return normalizeCountdownBannerContent(data.content);
    }

    return normalizeCountdownBannerContent({});
  } catch (e) {
    console.error("Error fetching countdown banner settings:", e);
    return normalizeCountdownBannerContent({});
  }
}

export async function upsertCountdownBannerSettings(
  settings: CountdownBannerSettings
): Promise<void> {
  const normalized = normalizeCountdownBannerContent(settings);
  const { error } = await supabase.from("site_content").upsert(
    {
      key: COUNTDOWN_BANNER_SETTINGS_KEY,
      content: {
        enabled: normalized.enabled,
        label_en: normalized.label_en,
        label_fr: normalized.label_fr,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    if (error.code === "42501" || error.message?.includes("policy")) {
      throw new Error(
        "Permission denied. Ensure site_content admin policies allow this key."
      );
    }
    throw error;
  }
}
