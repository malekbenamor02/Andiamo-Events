/**
 * Microsoft Clarity – session recordings, heatmaps, and insights.
 * Uses the official @microsoft/clarity NPM package.
 * Only loads when VITE_CLARITY_PROJECT_ID is set; typically enabled in production.
 * @see https://clarity.microsoft.com/
 */

import Clarity from '@microsoft/clarity';

const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined;
const isProduction = import.meta.env.PROD;

export function initClarity(): void {
  if (!projectId?.trim()) {
    if (isProduction) {
      console.warn('[Clarity] VITE_CLARITY_PROJECT_ID not set – analytics disabled');
    }
    return;
  }

  try {
    Clarity.init(projectId.trim());
  } catch (e) {
    if (isProduction) {
      console.warn('[Clarity] Failed to initialize:', e);
    }
  }
}
