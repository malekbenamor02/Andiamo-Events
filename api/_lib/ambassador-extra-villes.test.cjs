'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  normalizeExtraVilles,
  formatPostgrestFilterValue,
  buildVilleCoverageOrFilter,
} = require('./ambassador-extra-villes.cjs');

const SOUSSE = ['Sahloul', 'Khezama', 'Kalaa Kebira', 'Hammam-Sousse'];

test('normalizeExtraVilles dedupes, strips primary, and drops invalid', () => {
  const result = normalizeExtraVilles({
    primaryVille: 'Sahloul',
    extraVilles: ['Khezama', 'Khezama', 'Sahloul', 'Invalid', 'Akouda'],
    allowedVilles: SOUSSE,
  });

  assert.deepStrictEqual(result, ['Khezama']);
});

test('normalizeExtraVilles returns sorted stable output', () => {
  const result = normalizeExtraVilles({
    primaryVille: 'Sahloul',
    extraVilles: ['Kalaa Kebira', 'Hammam-Sousse', 'Khezama'],
    allowedVilles: SOUSSE,
  });

  assert.deepStrictEqual(result, ['Hammam-Sousse', 'Kalaa Kebira', 'Khezama']);
});

test('normalizeExtraVilles handles empty input', () => {
  assert.deepStrictEqual(
    normalizeExtraVilles({
      primaryVille: 'Sahloul',
      extraVilles: null,
      allowedVilles: SOUSSE,
    }),
    []
  );
});

test('formatPostgrestFilterValue quotes values with spaces', () => {
  assert.strictEqual(formatPostgrestFilterValue('Sahloul'), 'Sahloul');
  assert.strictEqual(formatPostgrestFilterValue('Kalaa Kebira'), '"Kalaa Kebira"');
  assert.strictEqual(formatPostgrestFilterValue('Centre Ville'), '"Centre Ville"');
});

test('buildVilleCoverageOrFilter covers primary and array contains', () => {
  assert.strictEqual(
    buildVilleCoverageOrFilter('Sahloul'),
    'ville.eq.Sahloul,extra_villes.cs.{Sahloul}'
  );
  assert.strictEqual(
    buildVilleCoverageOrFilter('Kalaa Kebira'),
    'ville.eq."Kalaa Kebira",extra_villes.cs.{"Kalaa Kebira"}'
  );
  assert.strictEqual(
    buildVilleCoverageOrFilter('Hammam-Sousse'),
    'ville.eq.Hammam-Sousse,extra_villes.cs.{Hammam-Sousse}'
  );
});
