/**
 * Supabase Edge Function — scheduled marketing email tick (primary scheduler; Vercel Cron is not used).
 *
 * Dashboard: Edge Functions → marketing-email-tick → Schedules → e.g. every 15 minutes (cron: * /15 * * * *)
 *
 * Secrets (Project Settings → Edge Functions):
 *   MARKETING_CRON_URL  — full URL, e.g. https://www.andiamoevents.com/api/marketing/cron/email-campaigns
 *   CRON_SECRET         — must match server CRON_SECRET
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

Deno.serve(async () => {
  const url = Deno.env.get('MARKETING_CRON_URL');
  const secret = Deno.env.get('CRON_SECRET');
  if (!url || !secret) {
    return new Response(
      JSON.stringify({ success: false, error: 'Set MARKETING_CRON_URL and CRON_SECRET on the function' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': secret
    },
    body: JSON.stringify({ secret })
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' }
  });
});
