'use strict';

const KNOWN_CITIES = [
  'Kairouan',
  'Mahdia',
  'Monastir',
  'Nabeul',
  'Sfax',
  'Sousse',
  'Tunis',
];

function normalizeAmbassadorSelectionSettings(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const rawCityWide =
    o.cityWide && typeof o.cityWide === 'object' ? o.cityWide : {};

  const cityWide = {};
  for (const city of KNOWN_CITIES) {
    if (rawCityWide[city] === true) {
      cityWide[city] = true;
    }
  }

  return { cityWide };
}

function isAmbassadorCityWide(city, settings) {
  if (!city || !settings) return false;
  const normalized = String(city).trim();
  return settings.cityWide[normalized] === true;
}

async function fetchAmbassadorSelectionSettings(dbClient) {
  const defaults = normalizeAmbassadorSelectionSettings({});

  if (!dbClient) {
    return defaults;
  }

  try {
    const { data, error } = await dbClient
      .from('site_content')
      .select('content')
      .eq('key', 'ambassador_selection_settings')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching ambassador selection settings:', error);
      return defaults;
    }

    if (data?.content) {
      return normalizeAmbassadorSelectionSettings(data.content);
    }

    return defaults;
  } catch (e) {
    console.error('Error fetching ambassador selection settings:', e);
    return defaults;
  }
}

module.exports = {
  KNOWN_CITIES,
  normalizeAmbassadorSelectionSettings,
  isAmbassadorCityWide,
  fetchAmbassadorSelectionSettings,
};
