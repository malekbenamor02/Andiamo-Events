'use strict';

const { fetchAmbassadorSocialLinkFromApplications } = require('./ambassador-social-link.cjs');
const { applyVilleCoverageFilter } = require('./ambassador-extra-villes.cjs');
const {
  fetchAmbassadorSelectionSettings,
  isAmbassadorCityWide,
} = require('./ambassador-selection-settings.cjs');

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * GET /api/ambassadors/active — approved ambassadors for COD checkout by city/ville.
 */
async function handleActiveAmbassadorsRequest(dbClient, { city, ville }) {
  if (!city) {
    return { status: 400, body: { error: 'City parameter is required' } };
  }

  const normalizedCity = String(city).trim();
  const normalizedVille =
    ville && String(ville).trim() !== '' ? String(ville).trim() : null;

  const selectionSettings = await fetchAmbassadorSelectionSettings(dbClient);
  const cityWide = isAmbassadorCityWide(normalizedCity, selectionSettings);

  let query = dbClient
    .from('ambassadors')
    .select('id, full_name, phone, email, city, ville, status, extra_villes')
    .eq('status', 'approved')
    .eq('city', normalizedCity);

  if (!cityWide) {
    query = applyVilleCoverageFilter(query, normalizedVille);
  }

  const { data: ambassadors, error } = await query;

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  const shuffledAmbassadors = shuffleArray(ambassadors || []);

  const ambassadorsWithSocial = await Promise.all(
    shuffledAmbassadors.map(async (ambassador) => {
      const social_link = await fetchAmbassadorSocialLinkFromApplications(
        dbClient,
        ambassador.phone
      );
      const { extra_villes: _extra, ...publicFields } = ambassador;
      return {
        ...publicFields,
        social_link: social_link || null,
      };
    })
  );

  return {
    status: 200,
    body: { success: true, data: ambassadorsWithSocial },
  };
}

module.exports = {
  handleActiveAmbassadorsRequest,
  shuffleArray,
};
