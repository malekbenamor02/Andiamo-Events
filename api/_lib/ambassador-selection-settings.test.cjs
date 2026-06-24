'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeAmbassadorSelectionSettings,
  isAmbassadorCityWide,
} = require('./ambassador-selection-settings.cjs');
const {
  ambassadorCoversVille,
  validateAmbassadorCashLocation,
} = require('./ambassador-extra-villes.cjs');

test('normalizeAmbassadorSelectionSettings defaults to empty cityWide', () => {
  const settings = normalizeAmbassadorSelectionSettings(null);
  assert.deepEqual(settings, { cityWide: {} });
});

test('normalizeAmbassadorSelectionSettings keeps only true flags for known cities', () => {
  const settings = normalizeAmbassadorSelectionSettings({
    cityWide: {
      Sousse: true,
      Tunis: false,
      Unknown: true,
      Sfax: 'yes',
    },
  });
  assert.deepEqual(settings.cityWide, { Sousse: true });
});

test('isAmbassadorCityWide is false when city missing or flag unset', () => {
  const settings = normalizeAmbassadorSelectionSettings({ cityWide: { Sousse: true } });
  assert.equal(isAmbassadorCityWide('Sousse', settings), true);
  assert.equal(isAmbassadorCityWide('Tunis', settings), false);
  assert.equal(isAmbassadorCityWide('  Sousse  ', settings), true);
  assert.equal(isAmbassadorCityWide('Sousse', undefined), false);
});

test('ambassadorCoversVille matches primary or extra_villes', () => {
  const ambassador = {
    ville: 'Akouda',
    extra_villes: ['Sahloul', 'Msaken'],
  };
  assert.equal(ambassadorCoversVille(ambassador, 'Akouda'), true);
  assert.equal(ambassadorCoversVille(ambassador, 'Sahloul'), true);
  assert.equal(ambassadorCoversVille(ambassador, 'Enfidha'), false);
  assert.equal(ambassadorCoversVille(ambassador, null), true);
});

test('validateAmbassadorCashLocation requires city match always', () => {
  const ambassador = { city: 'Sousse', ville: 'Akouda', extra_villes: [] };
  const mismatch = validateAmbassadorCashLocation({
    ambassador,
    customerCity: 'Tunis',
    customerVille: 'Akouda',
    cityWide: false,
  });
  assert.equal(mismatch.ok, false);

  const match = validateAmbassadorCashLocation({
    ambassador,
    customerCity: 'Sousse',
    customerVille: 'Akouda',
    cityWide: false,
  });
  assert.equal(match.ok, true);
});

test('validateAmbassadorCashLocation skips ville check when cityWide', () => {
  const ambassador = { city: 'Sousse', ville: 'Akouda', extra_villes: [] };
  const result = validateAmbassadorCashLocation({
    ambassador,
    customerCity: 'Sousse',
    customerVille: 'Enfidha',
    cityWide: true,
  });
  assert.equal(result.ok, true);
});

test('validateAmbassadorCashLocation enforces ville coverage when not cityWide', () => {
  const ambassador = { city: 'Sousse', ville: 'Akouda', extra_villes: ['Sahloul'] };
  const fail = validateAmbassadorCashLocation({
    ambassador,
    customerCity: 'Sousse',
    customerVille: 'Enfidha',
    cityWide: false,
  });
  assert.equal(fail.ok, false);

  const pass = validateAmbassadorCashLocation({
    ambassador,
    customerCity: 'Sousse',
    customerVille: 'Sahloul',
    cityWide: false,
  });
  assert.equal(pass.ok, true);
});
