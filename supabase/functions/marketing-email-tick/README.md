# marketing-email-tick

**This project uses Supabase schedules for marketing email sends (no Vercel Cron).**  
The function calls `POST {MARKETING_CRON_URL}` with `CRON_SECRET` so your app runs `/api/marketing/cron/email-campaigns`.

1. Deploy: `supabase functions deploy marketing-email-tick`
2. Secrets: `supabase secrets set MARKETING_CRON_URL=https://your-domain.com/api/marketing/cron/email-campaigns CRON_SECRET=...` (same `CRON_SECRET` as your server / Vercel env)
3. Schedule: Supabase Dashboard → Edge Functions → **marketing-email-tick** → **Schedules** → e.g. `*/15 * * * *` (every 15 minutes)

Server must have `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` set.

Sending behaviour (batch size, delay between emails, max milliseconds per tick, daily cap at launch, etc.) is defined in **application code** (`api/misc.js` and the launch API), not in Supabase secrets. Only `MARKETING_CRON_URL` and `CRON_SECRET` are required on the Edge Function.
