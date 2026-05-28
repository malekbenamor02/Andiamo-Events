'use strict';

const DEFAULT_ACADEMY_ONLINE_FEE_RATE = 0.05;
const MAX_ACADEMY_ONLINE_FEE_RATE = 0.5;

function parseAcademyOnlineFeeRate(raw) {
  if (raw == null || raw === '') return DEFAULT_ACADEMY_ONLINE_FEE_RATE;
  const n = Number.parseFloat(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return DEFAULT_ACADEMY_ONLINE_FEE_RATE;
  return Math.min(MAX_ACADEMY_ONLINE_FEE_RATE, n);
}

module.exports = {
  DEFAULT_ACADEMY_ONLINE_FEE_RATE,
  MAX_ACADEMY_ONLINE_FEE_RATE,
  parseAcademyOnlineFeeRate,
};
