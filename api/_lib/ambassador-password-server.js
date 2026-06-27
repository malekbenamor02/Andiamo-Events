/**
 * Server-side ambassador password utilities (re-export for misc.js imports).
 */
export {
  generateTemporaryPassword,
  hashPasswordServerSide,
  looksLikeBcryptHash,
  resolveAmbassadorPasswordFromBody,
} from './admin-data-route-helpers.js';
